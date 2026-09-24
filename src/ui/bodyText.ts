import type { BodyKind } from '../catalog/bodies';
import { formatHours } from '../format/format';
import { HELIO_FADE_LOW_M } from '../render/heliosphereMath';

/** Shown for every nearby star. */
export const STAR_NOTE = 'Position: real right ascension, declination and distance (Gaia DR3 and Hipparcos, via the Wikipedia list of nearest stars), held fixed because the star\'s own motion is invisible over 1700-2300. Radius: a schematic value for the spectral class. Drawn as a plain-colour sphere.';

/** Sirius B only: the table gives it Sirius A's exact position. */
export const SIRIUS_B_NOTE = 'Its catalog position is identical to Sirius A\'s, so it is drawn a schematic 7.5 arcseconds (about 20 AU) north of it.';

/** What the heliosphere and the Oort cloud are: shown as the Deep space toggle's tooltip and in the README. */
export const DEEP_SPACE_NOTE = 'The heliosphere (a translucent shell at the termination shock, about 94 AU, and one at the heliopause, about 120 AU) and the Oort cloud (15,000 statistically placed points between 2,000 and 100,000 AU) are schematic: nothing solid is there, the real bubble is not a sphere, and no individual Oort object has ever been observed. The twelve nearby stars are real.';

/** The line under the toggles while the schematic deep-space layers can be seen: empty when they cannot (toggle off, or too close to the Sun to see the shells). */
export function deepSpaceCaption(altitudeM: number, on: boolean): string {
  return on && altitudeM >= HELIO_FADE_LOW_M ? 'Heliosphere and Oort cloud: schematic, not real objects' : '';
}

/** The info panel's one-line description of a body: its kind and, for a moon, what it orbits. */
export function kindLabel(kind: BodyKind, parentName: string | null, spectralType?: string): string {
  switch (kind) {
    case 'star': return 'Star (G2V)';
    case 'nearstar': return spectralType ? `Nearby star (${spectralType})` : 'Nearby star';
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

/** The info panel's day-length value: a dash when the spin is unknown (Halley, Hale-Bopp and Swift-Tuttle have none published), never NaN. */
export function dayLengthText(rotationPeriodH: number | null): string {
  return rotationPeriodH === null ? '—' : formatHours(rotationPeriodH);
}

/** Shown for every small body: where the orbit comes from and what it leaves out. */
export const SMALL_BODY_NOTE = 'Orbit: JPL Small-Body Database osculating elements, two-body motion from the element epoch (planetary perturbations and comet outgassing are ignored).';

/** Shown for comets: the tail is an effect, not physics. */
export const TAIL_NOTE = 'Tail: a stylised effect that always points away from the Sun and is longest near the Sun; it is not a physical simulation.';

/** Shown for 67P only: its two-body position is measurably off today. */
export const C67P_NOTE = 'Accuracy: Jupiter perturbs this orbit strongly; against JPL Horizons the position drawn today is off by about 1.4 degrees and 6% in distance.';

/** What the belts are: shown as the Belts toggle's tooltip and in the footer. */
export const BELT_NOTE = 'The asteroid and Kuiper belts are schematic: thousands of statistically placed points that orbit in real time, not individual real objects. The named asteroids, dwarf planets and comets are real.';
