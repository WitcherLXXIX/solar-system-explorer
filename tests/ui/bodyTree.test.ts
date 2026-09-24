import { describe, expect, it } from 'vitest';
import { buildBodyTree, splitNearbyStars, visibleRows, type TreeInput } from '../../src/ui/bodyTree';

type Id = 'sun' | 'earth' | 'moon' | 'mars' | 'phobos' | 'deimos' | 'pluto' | 'charon' | 'ceres';
const BODIES: TreeInput<Id>[] = [
  { id: 'sun', parent: null, kind: 'star' },
  { id: 'earth', parent: 'sun', kind: 'planet' },
  { id: 'mars', parent: 'sun', kind: 'planet' },
  { id: 'moon', parent: 'earth', kind: 'moon' },
  { id: 'phobos', parent: 'mars', kind: 'moon' },
  { id: 'deimos', parent: 'mars', kind: 'moon' },
  { id: 'pluto', parent: 'sun', kind: 'dwarf' },
  { id: 'charon', parent: 'pluto', kind: 'moon' },
  { id: 'ceres', parent: 'sun', kind: 'dwarf' },
];

describe('buildBodyTree', () => {
  it('keeps the Sun, planets and dwarf planets at the top level, in input order', () => {
    expect(buildBodyTree(BODIES).map((n) => n.id)).toEqual(['sun', 'earth', 'mars', 'pluto', 'ceres']);
  });
  it('nests moons under their parent in input order, including a moon of a dwarf planet', () => {
    const tree = buildBodyTree(BODIES);
    expect(tree.find((n) => n.id === 'mars')!.children.map((n) => n.id)).toEqual(['phobos', 'deimos']);
    expect(tree.find((n) => n.id === 'earth')!.children.map((n) => n.id)).toEqual(['moon']);
    expect(tree.find((n) => n.id === 'pluto')!.children.map((n) => n.id)).toEqual(['charon']);
    expect(tree.find((n) => n.id === 'ceres')!.children).toEqual([]);
  });
  it('places every body exactly once', () => {
    const seen: string[] = [];
    const walk = (nodes: { id: string; children: unknown[] }[]): void => {
      for (const n of nodes) { seen.push(n.id); walk(n.children as { id: string; children: unknown[] }[]); }
    };
    walk(buildBodyTree(BODIES));
    expect(seen.sort()).toEqual(BODIES.map((b) => b.id).sort());
  });
  it('throws when a moon names a parent that is not in the list', () => {
    expect(() => buildBodyTree<Id>([{ id: 'moon', parent: 'earth', kind: 'moon' }])).toThrow();
  });
});

describe('visibleRows', () => {
  const tree = buildBodyTree(BODIES);
  it('shows only top-level rows when nothing is expanded, flagging the ones with moons', () => {
    const rows = visibleRows(tree, new Set<Id>());
    expect(rows.map((r) => r.id)).toEqual(['sun', 'earth', 'mars', 'pluto', 'ceres']);
    expect(rows.map((r) => r.hasChildren)).toEqual([false, true, true, true, false]);
    expect(rows.every((r) => r.depth === 0 && !r.expanded)).toBe(true);
  });
  it('lists the moons right after an expanded parent, one level deeper', () => {
    const rows = visibleRows(tree, new Set<Id>(['mars']));
    expect(rows.map((r) => r.id)).toEqual(['sun', 'earth', 'mars', 'phobos', 'deimos', 'pluto', 'ceres']);
    expect(rows.map((r) => r.depth)).toEqual([0, 0, 0, 1, 1, 0, 0]);
    expect(rows.find((r) => r.id === 'mars')!.expanded).toBe(true);
  });
  it('ignores expansion of a body with no children', () => {
    expect(visibleRows(tree, new Set<Id>(['ceres'])).map((r) => r.id)).toEqual(['sun', 'earth', 'mars', 'pluto', 'ceres']);
  });
});

describe('splitNearbyStars', () => {
  it('splits the nearby stars off in their own group and keeps everything else, in order', () => {
    const bodies = [
      { id: 'sun', kind: 'star' as const }, { id: 'earth', kind: 'planet' as const },
      { id: 'proxima', kind: 'nearstar' as const }, { id: 'moon', kind: 'moon' as const }, { id: 'siriusa', kind: 'nearstar' as const },
    ];
    const { main, stars } = splitNearbyStars(bodies);
    expect(main.map((b) => b.id)).toEqual(['sun', 'earth', 'moon']);
    expect(stars.map((b) => b.id)).toEqual(['proxima', 'siriusa']);
  });
});
