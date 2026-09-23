import type { BodyKind } from '../catalog/bodies';

/** The info panel's one-line description of a body: its kind and, for a moon, what it orbits. */
export function kindLabel(kind: BodyKind, parentName: string | null): string {
  switch (kind) {
    case 'star': return 'Star (G2V)';
    case 'planet': return 'Planet';
    case 'dwarf': return 'Dwarf planet';
    case 'moon': return parentName ? `Moon of ${parentName}` : 'Moon';
  }
}

/** Credit for every map that does not name its own source in the catalog. */
export const DEFAULT_MAP_CREDIT = 'Solar System Scope (CC BY 4.0)';

/** The info panel's map line: the credit, or an honest statement that the body is drawn in a plain colour. */
export function mapNote(hasMap: boolean, credit?: string): string {
  return hasMap ? `Map: ${credit ?? DEFAULT_MAP_CREDIT}` : 'No global map available: plain colour shown.';
}
