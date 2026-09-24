import { G } from '../units';
import type { BodyData } from './bodies';

const SBDB_PHYS = 'JPL Small-Body Database API (ssd-api.jpl.nasa.gov/sbdb.api, phys-par=1), read 2026-09-23';
/** Mass from a published GM in km^3/s^2. */
const massFromGm = (gmKm3S2: number): number => (gmKm3S2 * 1e9) / G;
const gravity = (massKg: number, radiusM: number): number => (G * massKg) / radiusM ** 2;

const VESTA_MASS = massFromGm(17.2882844);
const PALLAS_MASS = massFromGm(13.63);
const HYGIEA_MASS = massFromGm(7);
const C67P_MASS = massFromGm(662.2e-9);

/** Named asteroids and comets drawn as plain-colour bodies; colours are appearance choices, not measurements. */
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
  {
    id: 'halley', name: 'Halley', kind: 'comet', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 27728.04608790421, radiusM: 11.0 * 500, massKg: null, rotationPeriodH: null,
    axialTiltDeg: null, surfaceGravity: null, meanTempK: null, maps: {}, color: '#5c5852',
    source: `${SBDB_PHYS}: nucleus diameter 11.0 km (Lamy 2004) halved (NASA science.nasa.gov: about 11 km), no GM and no rot_per published`,
  },
  {
    id: 'halebopp', name: 'Hale-Bopp', kind: 'comet', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 863279.5034870314, radiusM: 60 * 500, massKg: null, rotationPeriodH: null,
    axialTiltDeg: null, surfaceGravity: null, meanTempK: null, maps: {}, color: '#7a7568',
    source: `${SBDB_PHYS}: nucleus diameter 60 km (Fernandez 2002) halved (NASA science.nasa.gov: about 60 km), no GM and no rot_per published`,
  },
  {
    id: 'c67p', name: '67P/Churyumov-Gerasimenko', kind: 'comet', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 2353.076067903661, radiusM: 3.4 * 500, massKg: C67P_MASS, rotationPeriodH: 12.76129,
    axialTiltDeg: null, surfaceGravity: gravity(C67P_MASS, 3.4 * 500), meanTempK: null, maps: {}, color: '#4d4a46',
    source: `${SBDB_PHYS}: diameter 3.4 km halved, GM 662.2e-9 km^3/s^2, rot_per 12.76129 h`,
  },
  {
    id: 'swifttuttle', name: 'Swift-Tuttle', kind: 'comet', parent: 'sun', orbitSource: 'elements',
    orbitPeriodDays: 48681.19346262312, radiusM: 26 * 500, massKg: null, rotationPeriodH: null,
    axialTiltDeg: null, surfaceGravity: null, meanTempK: null, maps: {}, color: '#5f5b55',
    source: `${SBDB_PHYS}: nucleus diameter 26 km (Lamy 2004) halved (NASA science.nasa.gov: about 26 km across), no GM and no rot_per published`,
  },
];
