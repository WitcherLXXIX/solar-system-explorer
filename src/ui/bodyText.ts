import type { BodyKind } from '../catalog/bodies';
import { formatHours } from '../format/format';

/** The info panel's one-line description of a body: its kind and, for a moon, what it orbits. */
export function kindLabel(kind: BodyKind, parentName: string | null): string {
  switch (kind) {
    case 'star': return 'Star (G2V)';
    case 'planet': return 'Planet';
    case 'dwarf': return 'Dwarf planet';
    case 'moon': return parentName ? `Moon of ${parentName}` : 'Moon';
    case 'asteroid': return 'Asteroid';
    case 'tno': return 'Trans-Neptunian object';
    case 'comet': return 'Comet';
  }
}

/** Credit for every map that does not name its own source in the catalog. */
export const DEFAULT_MAP_CREDIT = 'Solar System Scope (CC BY 4.0)';

/** The info panel's map line: the credit, or an honest statement that the body is drawn in a plain colour. */
export function mapNote(hasMap: boolean, credit?: string): string {
  return hasMap ? `Map: ${credit ?? DEFAULT_MAP_CREDIT}` : 'No global map available: plain colour shown.';
}

/** Surface gravity in m/s² to 3 significant figures, so Deimos (0.00250) does not read 0.00. */
export function formatGravity(metresPerSecondSquared: number): string {
  return `${metresPerSecondSquared.toPrecision(3)} m/s²`;
}

/** The info panel's day-length value: a dash when the spin is unknown (comets and some trans-Neptunian objects), never NaN. */
export function dayLengthText(rotationPeriodH: number | null): string {
  return rotationPeriodH === null ? '—' : formatHours(rotationPeriodH);
}

/** Shown for every small body: where the orbit comes from and what it leaves out. */
export const SMALL_BODY_NOTE = 'Orbit: JPL Small-Body Database osculating elements, two-body motion from the element epoch (planetary perturbations and comet outgassing are ignored).';

/** Shown for comets: the tail is an effect, not physics. */
export const TAIL_NOTE = 'Tail: a stylised effect that always points away from the Sun and is longest near the Sun; it is not a physical simulation.';
