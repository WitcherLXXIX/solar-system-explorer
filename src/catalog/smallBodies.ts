import { G } from '../units';
import type { BodyData } from './bodies';

const SBDB_PHYS = 'JPL Small-Body Database API (ssd-api.jpl.nasa.gov/sbdb.api, phys-par=1), read 2026-09-23';
/** Mass from a published GM in km^3/s^2. */
const massFromGm = (gmKm3S2: number): number => (gmKm3S2 * 1e9) / G;
const gravity = (massKg: number, radiusM: number): number => (G * massKg) / radiusM ** 2;

const VESTA_MASS = massFromGm(17.2882844);
const PALLAS_MASS = massFromGm(13.63);
const HYGIEA_MASS = massFromGm(7);

/** Named asteroids (and, from Task 6, comets) drawn as plain-colour bodies; colours are appearance choices, not measurements. */
export const SMALL_BODIES: readonly BodyData[] = [
  {
    id: 'vesta', name: 'Vesta', kind: 'asteroid', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 1325.389042911101, radiusM: 522.77 * 500, massKg: VESTA_MASS, rotationPeriodH: 5.3421276322,
    axialTiltDeg: null, surfaceGravity: gravity(VESTA_MASS, 522.77 * 500), meanTempK: null, maps: {}, color: '#a39f96',
    source: `${SBDB_PHYS}: diameter 522.77 km (Park 2025) halved, GM 17.2882844 km^3/s^2, rot_per 5.3421276322 h`,
  },
  {
    id: 'pallas', name: 'Pallas', kind: 'asteroid', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 1683.504809564834, radiusM: 513 * 500, massKg: PALLAS_MASS, rotationPeriodH: 7.8132214,
    axialTiltDeg: null, surfaceGravity: gravity(PALLAS_MASS, 513 * 500), meanTempK: null, maps: {}, color: '#8e8a84',
    source: `${SBDB_PHYS}: diameter 513 km (Marsset 2020) halved, GM 13.63 km^3/s^2, rot_per 7.8132214 h`,
  },
  {
    id: 'hygiea', name: 'Hygiea', kind: 'asteroid', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 2042.987283349627, radiusM: 407.12 * 500, massKg: HYGIEA_MASS, rotationPeriodH: 13.828,
    axialTiltDeg: null, surfaceGravity: gravity(HYGIEA_MASS, 407.12 * 500), meanTempK: null, maps: {}, color: '#6f6d6a',
    source: `${SBDB_PHYS}: diameter 407.12 km (IRAS) halved, GM 7 km^3/s^2 (Scholl 1987), rot_per 13.828 h`,
  },
  {
    id: 'juno', name: 'Juno', kind: 'asteroid', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 1594.434579527149, radiusM: 246.596 * 500, massKg: null, rotationPeriodH: 7.21,
    axialTiltDeg: null, surfaceGravity: null, meanTempK: null, maps: {}, color: '#9a948c',
    source: `${SBDB_PHYS}: diameter 246.596 km (NEOWISE) halved, no GM published (mass and gravity null), rot_per 7.21 h`,
  },
];
