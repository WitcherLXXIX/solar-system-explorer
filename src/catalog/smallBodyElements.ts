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
};
