export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface BodyData {
  id: BodyId;
  name: string;
  kind: 'star' | 'planet';
  /** Volumetric mean radius. */
  radiusM: number;
  massKg: number;
  /** Sidereal rotation period in hours; negative means retrograde. Info panel only. */
  rotationPeriodH: number;
  /** Obliquity to orbit in degrees (Sun: to the ecliptic). Info panel only. */
  axialTiltDeg: number;
  surfaceGravity: number;
  meanTempK: number;
  tempNote?: string;
  /** File stem in public/textures (without .jpg). */
  texture: string;
  /** CSS colour used for the flat fallback, sprites and orbit lines. */
  color: string;
  source: string;
}

const PLANET_SOURCE = 'NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet)';

export const BODIES: readonly BodyData[] = [
  {
    id: 'sun', name: 'Sun', kind: 'star', radiusM: 695_700_000, massKg: 1.9885e30, rotationPeriodH: 609.12,
    axialTiltDeg: 7.25, surfaceGravity: 274.0, meanTempK: 5772, tempNote: 'effective temperature of the photosphere',
    texture: '2k_sun', color: '#ffd27a', source: 'NASA Sun Fact Sheet; IAU 2015 nominal solar values',
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', radiusM: 2_439_400, massKg: 3.30e23, rotationPeriodH: 1407.6,
    axialTiltDeg: 0.034, surfaceGravity: 3.7, meanTempK: 440.15, texture: '2k_mercury', color: '#a8a29e', source: PLANET_SOURCE,
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', radiusM: 6_051_800, massKg: 4.87e24, rotationPeriodH: -5832.5,
    axialTiltDeg: 177.4, surfaceGravity: 8.9, meanTempK: 737.15, texture: '2k_venus_surface', color: '#e3c07a', source: PLANET_SOURCE,
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', radiusM: 6_371_000, massKg: 5.97e24, rotationPeriodH: 23.9345,
    axialTiltDeg: 23.4, surfaceGravity: 9.8, meanTempK: 288.15, texture: '2k_earth_daymap', color: '#4f86d6', source: PLANET_SOURCE,
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', radiusM: 3_389_500, massKg: 6.42e23, rotationPeriodH: 24.6229,
    axialTiltDeg: 25.2, surfaceGravity: 3.7, meanTempK: 208.15, texture: '2k_mars', color: '#c1440e', source: PLANET_SOURCE,
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', radiusM: 69_911_000, massKg: 1.898e27, rotationPeriodH: 9.925,
    axialTiltDeg: 3.1, surfaceGravity: 23.1, meanTempK: 163.15, tempNote: 'at the 1 bar level',
    texture: '2k_jupiter', color: '#c99b6d', source: PLANET_SOURCE,
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', radiusM: 58_232_000, massKg: 5.68e26, rotationPeriodH: 10.656,
    axialTiltDeg: 26.7, surfaceGravity: 9.0, meanTempK: 133.15, tempNote: 'at the 1 bar level',
    texture: '2k_saturn', color: '#e0c98f', source: PLANET_SOURCE,
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', radiusM: 25_362_000, massKg: 8.68e25, rotationPeriodH: -17.24,
    axialTiltDeg: 97.8, surfaceGravity: 8.7, meanTempK: 78.15, tempNote: 'at the 1 bar level',
    texture: '2k_uranus', color: '#9fd8e0', source: PLANET_SOURCE,
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', radiusM: 24_622_000, massKg: 1.02e26, rotationPeriodH: 16.11,
    axialTiltDeg: 28.3, surfaceGravity: 11.0, meanTempK: 73.15, tempNote: 'at the 1 bar level',
    texture: '2k_neptune', color: '#4a6fe0', source: PLANET_SOURCE,
  },
];

export const BODY_IDS: readonly BodyId[] = BODIES.map((b) => b.id);

const BY_ID = new Map<BodyId, BodyData>(BODIES.map((b) => [b.id, b]));

export function getBody(id: BodyId): BodyData {
  const body = BY_ID.get(id);
  if (!body) throw new Error(`unknown body: ${id}`);
  return body;
}
