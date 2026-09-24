import type { BodyId } from './bodies';
import type { ElementSet } from './orbits';

const AU_KM = 149_597_870.7;
const SBDB = 'JPL Small-Body Database API (ssd-api.jpl.nasa.gov/sbdb.api, full-prec=1), osculating elements, J2000 ecliptic';

/**
 * JPL Small-Body Database osculating elements (ecliptic J2000, two-body motion from the element epoch, no precession) of the
 * named asteroids and comets. Kept apart from `ELEMENTS` (the satellite mean elements) so that table's tests are untouched;
 * `elementRelative` falls back to this one. Values read 2026-09-23.
 */
export const SMALL_BODY_ELEMENTS: Partial<Record<BodyId, ElementSet>> = {
  vesta: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 2.361365965127599 * AU_KM, e: 0.09020374382834395, iDeg: 7.143925545058711,
      nodeDeg: 103.701293265032, periDeg: 151.4686478221564, meanAnomalyDeg: 81.19015607686903,
      meanMotionDegPerDay: 0.2716183613599909,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=4, epoch JD 2461200.5 TDB`,
  },
  pallas: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 2.769559010737709 * AU_KM, e: 0.2307000995648547, iDeg: 34.93279321851542,
      nodeDeg: 172.8866193357694, periDeg: 310.9699161652136, meanAnomalyDeg: 254.2496521742734,
      meanMotionDegPerDay: 0.2138396029251949,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=2, epoch JD 2461200.5 TDB`,
  },
  hygiea: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 3.150974033963701 * AU_KM, e: 0.1067092741240963, iDeg: 3.829529946447122,
      nodeDeg: 283.1198927508594, periDeg: 312.4242387344704, meanAnomalyDeg: 252.0344242359649,
      meanMotionDegPerDay: 0.1762125505792448,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=10, epoch JD 2461200.5 TDB`,
  },
  juno: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 2.670989527103278 * AU_KM, e: 0.2556999836681878, iDeg: 12.98659236598085,
      nodeDeg: 169.8115953492418, periDeg: 247.8950743075613, meanAnomalyDeg: 262.7322944883855,
      meanMotionDegPerDay: 0.2257853690721904,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=3, epoch JD 2461200.5 TDB`,
  },
  halley: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_439_875.5,
      aKm: 17.92863504856923 * AU_KM, e: 0.9679359956953211, iDeg: 162.1905300439129,
      nodeDeg: 59.09894720612437, periDeg: 112.2414314637764, meanAnomalyDeg: 274.3823371366792,
      meanMotionDegPerDay: 0.01298324443268444,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=1P, epoch JD 2439875.5 TDB (non-gravitational terms ignored)`,
  },
  halebopp: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_459_837.5,
      aKm: 177.4333839117583 * AU_KM, e: 0.9949810027633206, iDeg: 89.28759424740302,
      nodeDeg: 282.7334213961641, periDeg: 130.4146670659176, meanAnomalyDeg: 3.878386339423241,
      meanMotionDegPerDay: 0.0004170144183266921,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=C/1995 O1, epoch JD 2459837.5 TDB (non-gravitational terms ignored)`,
  },
  c67p: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_457_305.5,
      aKm: 3.462249490129549 * AU_KM, e: 0.6409081308996354, iDeg: 7.040294937543767,
      nodeDeg: 50.13557377155012, periDeg: 12.79824970228189, meanAnomalyDeg: 8.859927425218402,
      meanMotionDegPerDay: 0.1529912291873851,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=67P, epoch JD 2457305.5 TDB (non-gravitational terms ignored)`,
  },
  swifttuttle: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_450_000.5,
      aKm: 26.0920694978266 * AU_KM, e: 0.963225755046038, iDeg: 113.453816997171,
      nodeDeg: 139.3811920815948, periDeg: 152.9821676305871, meanAnomalyDeg: 7.631696167124212,
      meanMotionDegPerDay: 0.007395052881692476,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=109P, epoch JD 2450000.5 TDB (non-gravitational terms ignored)`,
  },
};
