import type { BodyData } from './bodies';

const JPL = 'JPL Planetary Satellite Physical Parameters (ssd.jpl.nasa.gov/sats/phys_par): mass from GM, mean radius';
const NSSDC = 'NASA NSSDC satellite fact sheets (nssdc.gsfc.nasa.gov/planetary/factsheet): orbital period, rotation, temperature';
const SBDB = 'JPL Small-Body Database API (ssd-api.jpl.nasa.gov/sbdb.api, phys-par=1, full-prec=1)';
const NSSDC_PLUTO = 'NASA NSSDC Pluto Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html)';
const SCI_NASA = 'NASA Science dwarf-planet page (science.nasa.gov/dwarf-planets)';

/**
 * The 21 moons and 5 dwarf planets. Order matters: every parent precedes its children. Colours are plain fallbacks
 * chosen for appearance (an approximation of each body's overall tint, not a measured value); bodies with a verified
 * global map get it in Task 10. Surface gravity is derived as GM / r^2. Rotation period is the orbital period for
 * every moon (tidally locked), negative when the orbit is retrograde.
 *
 * NOTE (see task-4-report.md for full detail): src/catalog/satellites.ts could not source a mass (GM or otherwise)
 * for Eris, Haumea or Makemake from any of the four allowed domains this session -- JPL's SBDB API and the Horizons
 * "OBJ_DATA" physical-parameters block both explicitly return "GM= n.a." for all three, and neither has a NSSDC
 * fact sheet or a mass figure anywhere on their science.nasa.gov pages (checked the overview, /facts/, /in-depth/,
 * and site search). Per the hard rule against inventing/remembering numbers, and per the controller ruling recorded
 * in task-4-report.md, their `massKg` (and the `surfaceGravity` that depends on it) is left as `null` -- extending
 * the existing nullable-field pattern used by `axialTiltDeg`/`meanTempK` -- rather than `NaN` or a plausible-looking
 * made-up figure; every other field for these three (radius, rotation, orbital period, colour) is genuinely sourced.
 */
export const SATELLITE_BODIES: readonly BodyData[] = [
  {
    id: 'moon', name: 'Moon', kind: 'moon', parent: 'earth', orbitSource: 'astronomy-engine',
    radiusM: 1_737_400, massKg: 7.346e22, orbitPeriodDays: 27.3217, rotationPeriodH: 655.721,
    axialTiltDeg: null, surfaceGravity: 1.62, meanTempK: 270.4, tempNote: 'black-body temperature',
    maps: { color: { lo: '2k_moon', hi: '8k_moon' } }, color: '#b5b1a8', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'phobos', name: 'Phobos', kind: 'moon', parent: 'mars', orbitSource: 'elements',
    radiusM: 11_080, massKg: 1.062e16, orbitPeriodDays: 0.31891, rotationPeriodH: 7.654,
    axialTiltDeg: null, surfaceGravity: 0.00577, meanTempK: null,
    maps: {}, color: '#7d7368', source: `${JPL}; ${NSSDC} (Mars fact sheet satellites table)`,
  },
  {
    // Second source (NSSDC) gives mass 2.4e15 kg, ~67% above the JPL-GM-derived 1.441e15 kg -- re-fetched both rows
    // verbatim and confirmed neither is a transcription error; this is a genuine disagreement between an older
    // NSSDC figure and the more recent MAR099-fit JPL GM. massKg is intentionally left out of crossCheck.ts's
    // SECOND_SOURCE for deimos (radius and period, which agree, are kept). See task-4-report.md.
    id: 'deimos', name: 'Deimos', kind: 'moon', parent: 'mars', orbitSource: 'elements',
    radiusM: 6_200, massKg: 1.441e15, orbitPeriodDays: 1.26244, rotationPeriodH: 30.299,
    axialTiltDeg: null, surfaceGravity: 0.00250, meanTempK: null,
    maps: {}, color: '#8a7f73', source: `${JPL}; ${NSSDC} (Mars fact sheet satellites table)`,
  },
  {
    id: 'io', name: 'Io', kind: 'moon', parent: 'jupiter', orbitSource: 'astronomy-engine',
    radiusM: 1_821_490, massKg: 8.930e22, orbitPeriodDays: 1.769138, rotationPeriodH: 42.459,
    axialTiltDeg: null, surfaceGravity: 1.80, meanTempK: null,
    maps: {}, color: '#e0c26a', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'europa', name: 'Europa', kind: 'moon', parent: 'jupiter', orbitSource: 'astronomy-engine',
    radiusM: 1_560_800, massKg: 4.799e22, orbitPeriodDays: 3.551181, rotationPeriodH: 85.228,
    axialTiltDeg: null, surfaceGravity: 1.31, meanTempK: null,
    maps: {}, color: '#d8cbb0', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: 'jupiter', orbitSource: 'astronomy-engine',
    radiusM: 2_631_200, massKg: 1.481e23, orbitPeriodDays: 7.154553, rotationPeriodH: 171.709,
    axialTiltDeg: null, surfaceGravity: 1.43, meanTempK: null,
    maps: {}, color: '#9c9184', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'callisto', name: 'Callisto', kind: 'moon', parent: 'jupiter', orbitSource: 'astronomy-engine',
    radiusM: 2_410_300, massKg: 1.076e23, orbitPeriodDays: 16.689017, rotationPeriodH: 400.536,
    axialTiltDeg: null, surfaceGravity: 1.24, meanTempK: null,
    maps: {}, color: '#6f665c', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'mimas', name: 'Mimas', kind: 'moon', parent: 'saturn', orbitSource: 'elements',
    radiusM: 198_200, massKg: 3.751e19, orbitPeriodDays: 0.9424218, rotationPeriodH: 22.618,
    axialTiltDeg: null, surfaceGravity: 0.0637, meanTempK: null,
    maps: {}, color: '#bdbdbd', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: 'saturn', orbitSource: 'elements',
    radiusM: 252_100, massKg: 1.080e20, orbitPeriodDays: 1.370218, rotationPeriodH: 32.885,
    axialTiltDeg: null, surfaceGravity: 0.113, meanTempK: null,
    maps: {}, color: '#f2f2f2', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'tethys', name: 'Tethys', kind: 'moon', parent: 'saturn', orbitSource: 'elements',
    radiusM: 531_100, massKg: 6.174e20, orbitPeriodDays: 1.887802, rotationPeriodH: 45.307,
    axialTiltDeg: null, surfaceGravity: 0.146, meanTempK: null,
    maps: {}, color: '#d8d8d8', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'dione', name: 'Dione', kind: 'moon', parent: 'saturn', orbitSource: 'elements',
    radiusM: 561_400, massKg: 1.095e21, orbitPeriodDays: 2.736915, rotationPeriodH: 65.686,
    axialTiltDeg: null, surfaceGravity: 0.232, meanTempK: null,
    maps: {}, color: '#cfcfcf', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'rhea', name: 'Rhea', kind: 'moon', parent: 'saturn', orbitSource: 'elements',
    radiusM: 763_500, massKg: 2.306e21, orbitPeriodDays: 4.517500, rotationPeriodH: 108.420,
    axialTiltDeg: null, surfaceGravity: 0.264, meanTempK: null,
    maps: {}, color: '#c4c0b8', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'titan', name: 'Titan', kind: 'moon', parent: 'saturn', orbitSource: 'elements',
    radiusM: 2_574_760, massKg: 1.345e23, orbitPeriodDays: 15.945421, rotationPeriodH: 382.690,
    axialTiltDeg: null, surfaceGravity: 1.35, meanTempK: null,
    maps: {}, color: '#d99a3a', source: `${JPL}; ${NSSDC}`,
    // Titan: a thick orange organic haze reaching several hundred km (0.2 of its radius).
    atmosphere: {
      heightFraction: 0.2, scaleHeightFraction: 0.05, mieScaleHeightFraction: 0.07,
      rayleigh: [0.6, 0.5, 0.3], mie: 6, mieG: 0.6, intensity: 8, tint: [1.0, 0.62, 0.22],
    },
  },
  {
    id: 'iapetus', name: 'Iapetus', kind: 'moon', parent: 'saturn', orbitSource: 'elements',
    radiusM: 734_300, massKg: 1.806e21, orbitPeriodDays: 79.330183, rotationPeriodH: 1903.924,
    axialTiltDeg: null, surfaceGravity: 0.224, meanTempK: null,
    maps: {}, color: '#8c8478', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'miranda', name: 'Miranda', kind: 'moon', parent: 'uranus', orbitSource: 'elements',
    radiusM: 235_800, massKg: 6.443e19, orbitPeriodDays: 1.413479, rotationPeriodH: 33.923,
    axialTiltDeg: null, surfaceGravity: 0.0773, meanTempK: null,
    maps: {}, color: '#a9a9a9', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'ariel', name: 'Ariel', kind: 'moon', parent: 'uranus', orbitSource: 'elements',
    radiusM: 578_900, massKg: 1.251e21, orbitPeriodDays: 2.520379, rotationPeriodH: 60.489,
    axialTiltDeg: null, surfaceGravity: 0.249, meanTempK: null,
    maps: {}, color: '#b8b8b8', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'umbriel', name: 'Umbriel', kind: 'moon', parent: 'uranus', orbitSource: 'elements',
    radiusM: 584_700, massKg: 1.275e21, orbitPeriodDays: 4.144176, rotationPeriodH: 99.460,
    axialTiltDeg: null, surfaceGravity: 0.249, meanTempK: null,
    maps: {}, color: '#7a7a7a', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'titania', name: 'Titania', kind: 'moon', parent: 'uranus', orbitSource: 'elements',
    radiusM: 788_900, massKg: 3.400e21, orbitPeriodDays: 8.705867, rotationPeriodH: 208.941,
    axialTiltDeg: null, surfaceGravity: 0.365, meanTempK: null,
    maps: {}, color: '#a59d94', source: `${JPL}; ${NSSDC}`,
  },
  {
    // Second source (NSSDC) gives mass 2.88e21 kg, ~6.8% below the JPL-GM-derived 3.076e21 kg -- re-fetched both
    // rows verbatim and confirmed neither is a transcription error; both are internally self-consistent with their
    // own stated density, so this is a genuine disagreement between sources (Oberon's GM has one of the larger
    // uncertainties in the JPL table, +/-2.8%). massKg is intentionally left out of crossCheck.ts's SECOND_SOURCE
    // for oberon (radius and period, which agree, are kept). See task-4-report.md.
    id: 'oberon', name: 'Oberon', kind: 'moon', parent: 'uranus', orbitSource: 'elements',
    radiusM: 761_400, massKg: 3.076e21, orbitPeriodDays: 13.463234, rotationPeriodH: 323.118,
    axialTiltDeg: null, surfaceGravity: 0.354, meanTempK: null,
    maps: {}, color: '#8f8579', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'triton', name: 'Triton', kind: 'moon', parent: 'neptune', orbitSource: 'elements',
    radiusM: 1_352_600, massKg: 2.140e22, orbitPeriodDays: 5.876854, rotationPeriodH: -141.044,
    axialTiltDeg: null, surfaceGravity: 0.781, meanTempK: null,
    maps: {}, color: '#d9c9c0', source: `${JPL}; ${NSSDC}`,
  },
  {
    id: 'pluto', name: 'Pluto', kind: 'dwarf', parent: 'sun', orbitSource: 'astronomy-engine',
    radiusM: 1_188_000, massKg: 1.302e22, orbitPeriodDays: 90_560, rotationPeriodH: -153.2928,
    axialTiltDeg: null, surfaceGravity: 0.616, meanTempK: 37.5, tempNote: 'black-body temperature',
    maps: {}, color: '#c9a98a', source: `${JPL} (Pluto/Charon GM table); ${NSSDC_PLUTO}`,
    // Pluto: thin blue haze layers reaching about 0.17 of its radius.
    atmosphere: {
      heightFraction: 0.17, scaleHeightFraction: 0.03, mieScaleHeightFraction: 0.03,
      rayleigh: [1.2, 2.2, 5], mie: 3, mieG: 0.7, intensity: 5, tint: [0.55, 0.75, 1.0],
    },
  },
  {
    id: 'charon', name: 'Charon', kind: 'moon', parent: 'pluto', orbitSource: 'elements',
    radiusM: 606_000, massKg: 1.590e21, orbitPeriodDays: 6.3872, rotationPeriodH: 153.2928,
    axialTiltDeg: null, surfaceGravity: 0.289, meanTempK: null,
    maps: {}, color: '#8d8b88', source: `${JPL}; ${NSSDC_PLUTO}`,
  },
  {
    id: 'ceres', name: 'Ceres', kind: 'dwarf', parent: 'sun', orbitSource: 'elements',
    radiusM: 469_700, massKg: 9.384e20, orbitPeriodDays: 1679.853, rotationPeriodH: 9.074,
    axialTiltDeg: null, surfaceGravity: 0.284, meanTempK: null,
    maps: { color: { lo: '2k_ceres' } }, // NB: the file is named 2k_ceres but is 1024x512 (the USGS 1024 px mosaic); the map is tiny, not 2K.
    mapCredit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn Framing Camera global mosaic, 400 m/pixel)',
    color: '#8c8a86', source: `${SBDB}, sstr=Ceres; ${SCI_NASA}/ceres/facts/`,
  },
  {
    // BLOCKED: no mass figure found on any of the four allowed domains (SBDB phys_par and Horizons OBJ_DATA both
    // return GM= n.a.; science.nasa.gov's Eris pages have no mass anywhere). radiusM/rotationPeriodH/orbitPeriodDays
    // are genuinely sourced; massKg is null rather than an invented number. See task-4-report.md.
    id: 'eris', name: 'Eris', kind: 'dwarf', parent: 'sun', orbitSource: 'elements',
    radiusM: 1_200_000, massKg: null, orbitPeriodDays: 204516.663, rotationPeriodH: 25.9,
    axialTiltDeg: null, surfaceGravity: null, meanTempK: null,
    maps: {}, color: '#e5e5e5', source: `${SBDB}, sstr=Eris; ${SCI_NASA}/eris/ -- mass NOT AVAILABLE, see task-4-report.md`,
  },
  {
    // BLOCKED: no mass figure found on any of the four allowed domains (SBDB phys_par and Horizons OBJ_DATA both
    // return GM= n.a.; science.nasa.gov's Haumea pages have no mass anywhere). radiusM/rotationPeriodH/orbitPeriodDays
    // are genuinely sourced; massKg is null rather than an invented number. See task-4-report.md.
    id: 'haumea', name: 'Haumea', kind: 'dwarf', parent: 'sun', orbitSource: 'elements',
    radiusM: 870_000, massKg: null, orbitPeriodDays: 103208.117, rotationPeriodH: 3.9154,
    axialTiltDeg: null, surfaceGravity: null, meanTempK: null,
    maps: {}, color: '#dcdcdc', source: `${SBDB}, sstr=Haumea; ${SCI_NASA}/haumea/ -- mass NOT AVAILABLE, see task-4-report.md`,
  },
  {
    // BLOCKED: no mass figure found on any of the four allowed domains (SBDB phys_par and Horizons OBJ_DATA both
    // return GM= n.a.; science.nasa.gov's Makemake pages have no mass anywhere). radiusM/rotationPeriodH/orbitPeriodDays
    // are genuinely sourced; massKg is null rather than an invented number. See task-4-report.md.
    id: 'makemake', name: 'Makemake', kind: 'dwarf', parent: 'sun', orbitSource: 'elements',
    radiusM: 715_000, massKg: null, orbitPeriodDays: 112364.807, rotationPeriodH: 22.8266,
    axialTiltDeg: null, surfaceGravity: null, meanTempK: null,
    maps: {}, color: '#b98462', source: `${SBDB}, sstr=Makemake; ${SCI_NASA}/makemake/ -- mass NOT AVAILABLE, see task-4-report.md`,
  },
];
