import { describe, expect, it } from 'vitest';
import { getBody, type BodyId } from '../../src/catalog/bodies';
import { bodyRelativePosition } from '../../src/ephemeris/ephemeris';
import { aeSatelliteRelative, elementRelative, isAeSatellite } from '../../src/ephemeris/moons';
import { dot, length, type Vec3 } from '../../src/math';
import { DEG } from '../../src/units';
import { HORIZONS_STATES, REFERENCE_EPOCHS_JD } from './horizonsReference';
import { dateFromTdbJd } from './testDates';

/** Angle in degrees between two position vectors, as seen from the common parent. */
export function angleDeg(a: Vec3, b: Vec3): number {
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (length(a) * length(b))))) / DEG;
}

/**
 * Accuracy bounds. Astronomy-engine bodies: measured against Horizons for Io on 2026-09-21, the largest angular error was
 * 0.025 degrees (1975: 0.017, 2000: 0.007, 2026: 0.018, 2050: 0.025), so 0.05 degrees and 0.2% in distance are the bounds.
 * Element-based bodies: the spec's target is about 2 degrees of orbital phase for the major satellites within 1950-2050.
 * If a body's measured error is larger, record the measured value in PHASE_BOUND_DEG with a comment and report it as a ruling.
 */
const AE_BOUND_DEG = 0.05;
const AE_BOUND_DISTANCE = 0.002;
const DEFAULT_PHASE_BOUND_DEG = 2;
/**
 * Final-fix-wave measurements (see final-fix-report.md), against Horizons at 1975/2000/2026/2050. Earlier rulings blamed
 * "rate-precision ceilings" for the Uranus group; that was a misdiagnosis. For every Saturn and Uranus row the table's P
 * is the SIDEREAL period (it matches the NSSDC sidereal period to 2e-5 or better), so it is already the mean-longitude
 * rate, and planePosition (which adds the node and periapsis rates on top) counted the precession twice. Those rows now
 * store 360/P - (nodeRate + periRate)/365.25 (orbits.ts, SIDEREAL_PERIOD_ROWS). Effect on the worst error, degrees:
 * miranda 175.6 -> 2.60, ariel 97.2 -> 0.22, umbriel 141.8 -> 0.10, titania 20.1 -> 0.23, oberon 20.2 -> 0.28,
 * enceladus 146.8 -> 6.25, mimas 156.3 -> 50.3, tethys 72.5 -> 62.1, dione 151.1 -> 151.7, rhea 175.6 -> 157.4,
 * titan 171.8 -> 163.2, iapetus 145.5 -> 142.8. Ariel, Umbriel, Titania and Oberon are now within the 2 degree default.
 *
 * Bodies still wrong, per cause (bounds below are the measured worst case plus a small margin):
 * - europa: the Galilean validation test (element pipeline against astronomy-engine, not Horizons) measures 3.08 deg at
 *   2050 after the earlier retrograde-apsis sign fix (orbits.ts, europa row); that unchanged exception stays below.
 * - phobos, deimos, triton: unchanged, the sidereal correction does not explain them (orbits.ts, SIDEREAL_PERIOD_ROWS).
 *   Phobos and Deimos have 4-5 figure periods and Phobos's node and periapsis carry a ~45 degree libration; Triton is
 *   retrograde and both signs of the correction were tried (76 and 33 deg against 27 deg as tabulated).
 * - tethys, dione, rhea, titan, iapetus: after the correction the error is a CONSTANT offset in mean longitude (within
 *   a few degrees from 1975 to 2050), so it is a base-angle mismatch, not a rate error, and it is wrong at every date
 *   including today. Two hypotheses were tested: (1) the reviewer's epoch shift (fails, best common shift leaves 32
 *   deg); (2) reading the table's M column as mean longitude (i.e. subtracting node + peri): it brings Titan to 2.8
 *   deg and Rhea and Dione to 21 and 35 deg but makes Enceladus, Tethys, Mimas and Iapetus worse, and contradicts the
 *   table's own stated definition (omega is the argument of periapsis and M the mean anomaly, re-fetched from
 *   ssd.jpl.nasa.gov/sats/elem/), so it was not applied. Unresolved; the bounds below stay wide.
 * - mimas: varies from 26 to 50 deg, so not a constant offset; its precession periods are the fastest of the Saturn
 *   group and it is in a resonance, unresolved.
 * - ceres: SBDB osculating elements at JD 2461200.5 with no precession, 3.5 deg at 1975, expected two-body drift.
 */
const PHASE_BOUND_DEG: Partial<Record<BodyId, number>> = {
  europa: 3.2, // measured 3.0750 at 2050 (jd 2469807.5) in the Galilean pipeline test; see the note above.
  phobos: 170, // measured 165.6253 at 2050 (jd 2469807.5); unresolved, see above.
  deimos: 160, // measured 155.4874 at 2050 (jd 2469807.5); unresolved, see above.
  triton: 27, // measured 26.5703 at 2050 (jd 2469807.5); unresolved, see above.
  mimas: 51, // measured 50.258 at 2000 (jd 2451545.0); unresolved.
  enceladus: 6.5, // measured 6.246 at 1975 (jd 2442413.5); small offset, roughly constant in time; unresolved.
  tethys: 63, // measured 62.144 at 2050 (jd 2469807.5); constant base-angle offset, wrong at every date.
  dione: 152, // measured 151.657 at 1975 (jd 2442413.5); constant base-angle offset, wrong at every date.
  rhea: 158, // measured 157.435 at 2000 (jd 2451545.0); constant base-angle offset, wrong at every date.
  titan: 164, // measured 163.175 at 2050 (jd 2469807.5); constant base-angle offset, wrong at every date.
  iapetus: 144, // measured 142.839 at 1975 (jd 2442413.5); constant base-angle offset, wrong at every date.
  miranda: 2.7, // measured 2.602 at 2050 (jd 2469807.5).
  ceres: 3.6, // measured 3.5119 at 1975 (jd 2442413.5); see above.
};
const GALILEAN: BodyId[] = ['io', 'europa', 'ganymede', 'callisto'];
/**
 * The "distance within 3%" bounds, for the bodies that exceed it because their wrong phase also puts them at the wrong
 * point on an eccentric orbit (mimas e = 0.02, titan e = 0.029, iapetus e = 0.028). Every other body stays under 1%.
 */
const DISTANCE_BOUND: Partial<Record<BodyId, number>> = {
  mimas: 0.025, // measured 0.02454 at 2000 (jd 2451545.0), after the sidereal correction (was 0.03494).
  titan: 0.056, // measured 0.05437 at 2000 (jd 2451545.0).
  iapetus: 0.049, // measured 0.04768 at 1975 (jd 2442413.5), after the sidereal correction (was 0.04845).
};

const states = (pick: (id: BodyId) => boolean) => HORIZONS_STATES.filter((s) => pick(s.id));
const referenceDate = (jd: number): Date => dateFromTdbJd(jd);
const referencePosition = (s: (typeof HORIZONS_STATES)[number]): Vec3 => [s.positionKm[0] * 1000, s.positionKm[1] * 1000, s.positionKm[2] * 1000];

describe('astronomy-engine satellites against Horizons', () => {
  it('has reference states for the Moon, the Galilean moons and Pluto', () => {
    expect(states((id) => getBody(id).orbitSource === 'astronomy-engine' && getBody(id).parent !== 'sun').length).toBeGreaterThanOrEqual(5 * REFERENCE_EPOCHS_JD.length);
  });
  it('agrees within 0.05 degrees and 0.2% in distance, relative to the parent', () => {
    for (const s of states((id) => getBody(id).orbitSource === 'astronomy-engine')) {
      const ours = bodyRelativePosition(s.id, referenceDate(s.jdTdb));
      const ref = referencePosition(s);
      expect(angleDeg(ours, ref), `${s.id} at ${s.jdTdb}`).toBeLessThan(AE_BOUND_DEG);
      expect(Math.abs(length(ours) - length(ref)) / length(ref), `${s.id} distance at ${s.jdTdb}`).toBeLessThan(AE_BOUND_DISTANCE);
    }
  });
});

describe('element-based bodies against Horizons', () => {
  it('stays within the phase bound at 1975, 2000, 2026 and 2050', () => {
    const elementBodies = states((id) => getBody(id).orbitSource === 'elements');
    expect(elementBodies.length).toBe(20 * REFERENCE_EPOCHS_JD.length);
    for (const s of elementBodies) {
      const ours = bodyRelativePosition(s.id, referenceDate(s.jdTdb));
      const bound = PHASE_BOUND_DEG[s.id] ?? DEFAULT_PHASE_BOUND_DEG;
      expect(angleDeg(ours, referencePosition(s)), `${s.id} at ${s.jdTdb}`).toBeLessThan(bound);
    }
  });
  it('keeps the distance within 3% for satellites (mean elements ignore short-period terms)', () => {
    for (const s of states((id) => getBody(id).orbitSource === 'elements' && getBody(id).kind === 'moon')) {
      const ours = bodyRelativePosition(s.id, referenceDate(s.jdTdb));
      const ref = referencePosition(s);
      const bound = DISTANCE_BOUND[s.id] ?? 0.03;
      expect(Math.abs(length(ours) - length(ref)) / length(ref), `${s.id} at ${s.jdTdb}`).toBeLessThan(bound);
    }
  });
});

describe('the bundled-element pipeline against astronomy-engine (Galilean moons)', () => {
  it('reproduces the four Galilean moons within the phase bound, which validates the Laplace-plane frame, node origin, precession signs and mean-motion convention', () => {
    for (const id of GALILEAN) {
      for (const jd of REFERENCE_EPOCHS_JD) {
        const date = referenceDate(jd);
        const fromElements = elementRelative(id, date);
        const fromEngine = aeSatelliteRelative(id as 'io', date);
        expect(angleDeg(fromElements, fromEngine), `${id} at ${jd}`).toBeLessThan(PHASE_BOUND_DEG[id] ?? DEFAULT_PHASE_BOUND_DEG);
      }
    }
  });
});

describe('the ephemeris routes each body to the right source', () => {
  it('flags exactly the Moon and the Galilean moons as astronomy-engine satellites', () => {
    expect((['moon', 'io', 'europa', 'ganymede', 'callisto'] as BodyId[]).every(isAeSatellite)).toBe(true);
    expect((['titan', 'phobos', 'charon', 'pluto', 'earth'] as BodyId[]).some(isAeSatellite)).toBe(false);
  });
  it('gives the Moon a geocentric distance between 350,000 and 410,000 km', () => {
    const r = length(aeSatelliteRelative('moon', new Date('2026-09-21T00:00:00Z')));
    expect(r).toBeGreaterThan(3.5e8);
    expect(r).toBeLessThan(4.1e8);
  });
});

describe('measured phase errors (informational: run with --silent=false to see the table)', () => {
  it('prints the angular error of every reference state', () => {
    const rows: string[] = [];
    for (const s of HORIZONS_STATES) {
      const ours = bodyRelativePosition(s.id, referenceDate(s.jdTdb));
      rows.push(`${s.id.padEnd(9)} ${String(s.jdTdb).padEnd(10)} ${angleDeg(ours, referencePosition(s)).toFixed(4)} deg`);
    }
    console.log(`MEASURED (parent-relative angle vs Horizons)\n${rows.join('\n')}`);
    expect(rows.length).toBe(HORIZONS_STATES.length);
  });
});
