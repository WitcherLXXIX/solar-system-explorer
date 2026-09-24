import type { StarSky } from '../ephemeris/starPosition';
import type { BodyData, BodyId } from './bodies';

/** The Sun's radius in metres (the same figure the Sun body uses). */
export const SOLAR_RADIUS_M = 695_700_000;

export type SpectralClass = 'A' | 'G' | 'K' | 'M' | 'D';

/**
 * Schematic look of each spectral class: radius in solar radii and colour. These are appearance choices (the spec gives no
 * radii and puts stellar physics out of scope): one number per class, not measured for any particular star. D is a white dwarf.
 */
export const STAR_CLASS_STYLE: Record<SpectralClass, { radiusSolar: number; color: string }> = {
  A: { radiusSolar: 1.7, color: '#cad8ff' },
  G: { radiusSolar: 1.1, color: '#fff1d6' },
  K: { radiusSolar: 0.8, color: '#ffcf9e' },
  M: { radiusSolar: 0.25, color: '#ff9d6b' },
  D: { radiusSolar: 0.01, color: '#dfe8ff' },
};

/** The class letter of a spectral type: the first letter, except that every white dwarf ("DA2") is class D. Throws for a class with no style. */
export function spectralClass(type: string): SpectralClass {
  const letter = type.charAt(0);
  if (letter === 'A' || letter === 'G' || letter === 'K' || letter === 'M' || letter === 'D') return letter;
  throw new Error(`no style for spectral class of "${type}"`);
}

export interface NearbyStar extends StarSky {
  id: BodyId;
  name: string;
  spectralType: string;
}

/**
 * The 12 nearest stars. Source (RA, Dec, distance, spectral type): Wikipedia, "List of nearest stars"
 * (https://en.wikipedia.org/wiki/List_of_nearest_stars), itself citing Gaia DR3 and Hipparcos, as fetched 2026-09-23 and
 * embedded in docs/superpowers/specs/2026-09-23-deep-space-design.md. A test compares every value with that table.
 * RA/Dec are equatorial J2000. The stars are fixed: their own motion is invisible over the app's 1700-2300 date range.
 */
export const NEARBY_STARS: readonly NearbyStar[] = [
  { id: 'proxima', name: 'Proxima Centauri', ra: { h: 14, m: 29, s: 43.0 }, dec: { sign: -1, d: 62, m: 40, s: 46 }, distanceLy: 4.2465, spectralType: 'M5.5Ve' },
  { id: 'alphacena', name: 'Alpha Centauri A', ra: { h: 14, m: 39, s: 36.5 }, dec: { sign: -1, d: 60, m: 50, s: 2 }, distanceLy: 4.3441, spectralType: 'G2V' },
  { id: 'alphacenb', name: 'Alpha Centauri B', ra: { h: 14, m: 39, s: 35.1 }, dec: { sign: -1, d: 60, m: 50, s: 14 }, distanceLy: 4.3441, spectralType: 'K1V' },
  { id: 'barnard', name: "Barnard's Star", ra: { h: 17, m: 57, s: 48.5 }, dec: { sign: 1, d: 4, m: 41, s: 36 }, distanceLy: 5.9629, spectralType: 'M4.0Ve' },
  { id: 'wolf359', name: 'Wolf 359', ra: { h: 10, m: 56, s: 29.2 }, dec: { sign: 1, d: 7, m: 0, s: 53 }, distanceLy: 7.856, spectralType: 'M6.0V' },
  { id: 'lalande21185', name: 'Lalande 21185', ra: { h: 11, m: 3, s: 20.2 }, dec: { sign: 1, d: 35, m: 58, s: 12 }, distanceLy: 8.3044, spectralType: 'M2.0V' },
  { id: 'siriusa', name: 'Sirius A', ra: { h: 6, m: 45, s: 8.9 }, dec: { sign: -1, d: 16, m: 42, s: 58 }, distanceLy: 8.7094, spectralType: 'A1V' },
  // The table gives Sirius B exactly Sirius A's position, so it would be invisible and unreachable; a schematic 7.5 arcsecond
  // shift north (about 20 AU at this distance) separates them. It is not part of the sourced columns.
  { id: 'siriusb', name: 'Sirius B', ra: { h: 6, m: 45, s: 8.9 }, dec: { sign: -1, d: 16, m: 42, s: 58 }, distanceLy: 8.7094, spectralType: 'DA2', schematicOffsetNorthArcsec: 7.5 },
  { id: 'ross154', name: 'Ross 154', ra: { h: 18, m: 49, s: 49.4 }, dec: { sign: -1, d: 23, m: 50, s: 10 }, distanceLy: 9.7063, spectralType: 'M3.5Ve' },
  { id: 'epseri', name: 'Epsilon Eridani', ra: { h: 3, m: 32, s: 55.8 }, dec: { sign: -1, d: 9, m: 27, s: 30 }, distanceLy: 10.4749, spectralType: 'K2V' },
  { id: 'ross128', name: 'Ross 128', ra: { h: 11, m: 47, s: 44.4 }, dec: { sign: 1, d: 0, m: 48, s: 16 }, distanceLy: 11.0074, spectralType: 'M4.0Vn' },
  { id: 'cygni61a', name: '61 Cygni A', ra: { h: 21, m: 6, s: 53.9 }, dec: { sign: 1, d: 38, m: 44, s: 58 }, distanceLy: 11.4039, spectralType: 'K5.0V' },
];

const STAR_SOURCE = 'Wikipedia "List of nearest stars" (en.wikipedia.org/wiki/List_of_nearest_stars, citing Gaia DR3 and Hipparcos), fetched 2026-09-23';

/** One catalog body per star. The radius is schematic (set by the spectral class); nothing else about the star is invented. */
export const NEARBY_STAR_BODIES: readonly BodyData[] = NEARBY_STARS.map((star): BodyData => {
  const style = STAR_CLASS_STYLE[spectralClass(star.spectralType)];
  return {
    id: star.id, name: star.name, kind: 'nearstar', parent: null, orbitSource: null,
    radiusM: style.radiusSolar * SOLAR_RADIUS_M, massKg: null, rotationPeriodH: null, axialTiltDeg: null,
    surfaceGravity: null, meanTempK: null, maps: {}, color: style.color, spectralType: star.spectralType,
    source: `${STAR_SOURCE}: RA/Dec (J2000), distance ${star.distanceLy} ly and spectral type ${star.spectralType} as tabulated. Radius is a schematic value for the spectral class, not measured for this star.`,
  };
});
