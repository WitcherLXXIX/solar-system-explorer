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
 * - ceres: SBDB osculating elements at JD 2461200.5 with no precession, 3.5 deg at 1975, expected two-body drift.
 *
 * Phase-5 task 11 (systematic re-investigation; details in .superpowers/sdd/phase5/t11-report.md). Worst error over the
 * four epochs, before -> after, degrees:
 * phobos 165.6 -> 7.1, deimos 155.5 -> 3.3, mimas 50.3 -> 50.3 (unchanged), enceladus 6.2 -> 0.85, tethys 62.1 -> 2.9,
 * dione 151.7 -> 0.78, rhea 157.4 -> 0.66, titan 163.2 -> 2.6, iapetus 142.8 -> 4.9, triton 26.6 -> 2.0.
 * - H1 (transcription slip): rejected. Every cell of the Mars, Saturn and Neptune rows re-read from
 *   ssd.jpl.nasa.gov/sats/elem matches orbits.ts, including the Laplace-plane pole R.A./Dec./tilt of every Saturn row.
 * - H2 (meaning of M): rejected. A search over integer multiples (-1..2) of M, omega and node against the derived J2000
 *   mean longitude of all seven Saturn moons finds no combination better than 41 deg worst (the current M+omega+node
 *   leaves 162), so no single convention makes the published rows consistent.
 * - H3 (reference plane): rejected. The derived inclination in the table's frame matches the table's for every Saturn,
 *   Mars and Neptune row (Iapetus 7.5-7.6 vs 7.6, Tethys 1.10 vs 1.1, Phobos 1.06 vs 1.1, Triton 157.1-157.3 vs 157.3).
 * - H4 (rates): CONFIRMED for Phobos, Deimos and Triton. Phobos and Deimos: the table's 4-5 figure P is too coarse (over
 *   25-50 years it is 100-500 degrees of phase); the NSSDC sidereal periods 0.31891 d and 1.26244 d, with the sidereal
 *   correction, fix them, and a rate scan of the Horizons epochs independently agrees with NSSDC to the last figure.
 *   Triton: the node derived from Horizons advances +0.53 deg/yr, against -1.06 deg/yr from the tabulated Pnode, and the
 *   retrograde orbit needs a cos(i) term in the anomaly rate. Saturn rows: constant offset over 1975-2050, so the rates
 *   are right and the error is purely a base angle.
 * - H5 (calibrate M to Horizons at JD 2451545.0): applied to enceladus, tethys, dione, rhea, titan, iapetus, triton (a
 *   FIT to real JPL data, marked as such in each row's source and in the README; the published M is 61-157 deg from the
 *   real J2000 position for a reason not found). Rejected for mimas: calibration made it worse (73.9), and even the best
 *   constant shift leaves 38, under the 3x rule. The four signed errors (+32, +50, -26, +41) swing around, which is what a
 *   libration would do (Mimas is in a 4:2 resonance with Tethys, period roughly 70 years); unverified.
 * Bounds below are the measured worst plus about 1 degree; entries at or under the 2 degree default were removed.
 */
const PHASE_BOUND_DEG: Partial<Record<BodyId, number>> = {
  europa: 3.2, // measured 3.0750 at 2050 (jd 2469807.5) in the Galilean pipeline test; see the note above.
  phobos: 8.1, // measured 7.0760 at 2050 (jd 2469807.5); NSSDC period rounding (5 figures), was 165.6.
  deimos: 4.3, // measured 3.2860 at 2050 (jd 2469807.5); NSSDC period rounding (6 figures), was 155.5.
  triton: 3.1, // measured 2.0420 at 2050 (jd 2469807.5), after the node-rate/M fit; was 26.6.
  mimas: 51, // measured 50.258 at 2000 (jd 2451545.0); unresolved, likely the Tethys resonance libration.
  tethys: 4, // measured 2.9312 at 2026 (jd 2461304.5), after the M fit; was 62.1.
  titan: 3.6, // measured 2.5533 at 2000 (jd 2451545.0), after the M fit; was 163.2.
  iapetus: 6, // measured 4.9490 at 2000 (jd 2451545.0), after the M fit; the rest is a constant node/periapsis offset; was 142.8.
  miranda: 2.7, // measured 2.602 at 2050 (jd 2469807.5).
  ceres: 3.6, // measured 3.5119 at 1975 (jd 2442413.5); see above.
};
const GALILEAN: BodyId[] = ['io', 'europa', 'ganymede', 'callisto'];
/**
 * The "distance within 3%" bounds, for the bodies that exceed it because their wrong phase also puts them at the wrong
 * point on an eccentric orbit. After phase-5 task 11 only mimas (e = 0.02, phase still 50 deg out) needs an entry: titan
 * (measured 0.0247, was 0.054) and iapetus (0.0023, was 0.048) are back under the 3% default. Every other body stays under 1%.
 */
const DISTANCE_BOUND: Partial<Record<BodyId, number>> = {
  mimas: 0.025, // measured 0.02454 at 1975 (jd 2442413.5), after the sidereal correction (was 0.03494).
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
