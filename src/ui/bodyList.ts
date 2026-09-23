import { BODIES, getBody, type BodyId } from '../catalog/bodies';
import { buildBodyTree, visibleRows } from './bodyTree';
import { el } from './dom';

/** The hierarchical body list: the Sun, planets and dwarf planets at the top level; a chevron expands a body's moons. */
export function createBodyList(root: HTMLElement, onSelect: (id: BodyId) => void): { setActive(id: BodyId): void } {
  const tree = buildBodyTree(BODIES);
  const expanded = new Set<BodyId>();
  let active: BodyId | null = null;

  const render = (): void => {
    const lines = visibleRows(tree, expanded).map((row) => {
      const name = getBody(row.id).name;
      const line = el('div', 'body-row');
      line.style.paddingLeft = `${row.depth * 14}px`;
      if (row.hasChildren) {
        const toggle = el('button', 'chevron', row.expanded ? '▾' : '▸');
        toggle.setAttribute('aria-expanded', String(row.expanded));
        toggle.setAttribute('aria-label', `${row.expanded ? 'Collapse' : 'Expand'} the moons of ${name}`);
        toggle.addEventListener('click', () => {
          if (expanded.has(row.id)) expanded.delete(row.id);
          else expanded.add(row.id);
          render();
        });
        line.append(toggle);
      } else {
        line.append(el('span', 'chevron-space'));
      }
      const button = el('button', row.id === active ? 'body-btn active' : 'body-btn', name);
      button.addEventListener('click', () => onSelect(row.id));
      line.append(button);
      return line;
    });
    root.replaceChildren(...lines);
  };
  render();

  return {
    setActive(id) {
      active = id;
      const body = getBody(id);
      if (body.kind === 'moon' && body.parent) expanded.add(body.parent); // show the focused moon's siblings
      render();
    },
  };
}
