export type TreeKind = 'star' | 'planet' | 'moon' | 'dwarf';

export interface TreeInput<Id extends string> {
  id: Id;
  parent: Id | null;
  kind: TreeKind;
}

export interface TreeNode<Id extends string> {
  id: Id;
  children: TreeNode<Id>[];
}

/**
 * The body list's hierarchy: the Sun, planets and dwarf planets are all top-level rows (in input order); each moon is
 * nested under its parent (a planet, or Pluto for Charon), also in input order.
 */
export function buildBodyTree<Id extends string>(bodies: readonly TreeInput<Id>[]): TreeNode<Id>[] {
  const nodes = new Map<Id, TreeNode<Id>>(bodies.map((b) => [b.id, { id: b.id, children: [] }]));
  const roots: TreeNode<Id>[] = [];
  for (const body of bodies) {
    const node = nodes.get(body.id)!;
    if (body.kind !== 'moon') {
      roots.push(node);
      continue;
    }
    const parent = body.parent === null ? undefined : nodes.get(body.parent);
    if (!parent) throw new Error(`moon ${body.id} names a parent that is not in the list: ${String(body.parent)}`);
    parent.children.push(node);
  }
  return roots;
}

export interface ListRow<Id extends string> {
  id: Id;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

/** The rows to draw: every top-level node, followed (one level deeper) by the children of each expanded node. */
export function visibleRows<Id extends string>(tree: readonly TreeNode<Id>[], expanded: ReadonlySet<Id>): ListRow<Id>[] {
  const rows: ListRow<Id>[] = [];
  const walk = (nodes: readonly TreeNode<Id>[], depth: number): void => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      const open = hasChildren && expanded.has(node.id);
      rows.push({ id: node.id, depth, hasChildren, expanded: open });
      if (open) walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return rows;
}
