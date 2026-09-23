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
 * Task-7 fix-round-1 rulings (see task-7-fix1-report.md and the comments on each body's row in orbits.ts):
 * - europa: fixed a periRateDegPerYear sign error (was +360/Papsis, should be -360/Papsis, verified against
 *   astronomy-engine's JupiterMoons). The fix brings every epoch under 2 deg except 2050, measured at 3.08 deg --
 *   "slightly over its bound at exactly one extreme epoch... fine at 2000/2026" per the task-7 brief's own
 *   allowance. io needed the same sign fix but is fully under 2 deg at all four epochs (max 1.42), so it uses the
 *   default and is not listed here.
 * - phobos, mimas: re-verified as correctly sourced from ssd.jpl.nasa.gov/sats/elem/ but NOT fixed -- both are
 *   extremely fast-precessing (Papsis/Pnode of about 1 year or less), so the source's 2-3-significant-figure
 *   precision for those columns is insufficient for 25-50-year extrapolation, and (for mimas) the base elements
 *   also disagree with Horizons at J2000 itself in a way no tested transcription-error hypothesis explains. This
 *   is reported as an open, unresolved discrepancy (not papered over): bounds below are the actual measured worst
 *   case this session, each with headroom, not a value tuned to "just pass".
 *
 * Task-7 fix-round-2 rulings (see task-7-fix2-report.md and the comments on each body's row in orbits.ts):
 * - titania, oberon: FIXED (root cause: orbits.ts's URANUS_POLE used the NSSDC "North Pole of Rotation" value
 *   literally, but Uranus's satellites orbit prograde relative to the planet's actual (retrograde-labelled) spin,
 *   so the satellites' true orbital pole is that value's antipode -- see orbits.ts). With the corrected pole, both
 *   bodies are correct at J2000 (0.06/0.13 deg) and stay under an unusually small residual away from it (max 20.06
 *   / 20.25 deg) -- far better than the 156-165 deg errors before the fix, but still over the 2 deg default, so a
 *   headroom-bounded exception is recorded, same as the round-1 bodies above.
 * - miranda, ariel, umbriel: the same Uranus pole fix corrects their J2000 base position too (1.09/0.22/0.05 deg),
 *   confirming the pole -- not the mean elements -- was the fault for the whole Uranus group. But unlike
 *   titania/oberon, these three still diverge to 75-176 deg away from J2000 with every node/peri-rate sign
 *   combination tested (a 4-way grid, none close to acceptable) -- the same "fast/complex precession beyond the
 *   source's precision" signature already established for phobos/mimas, not a fixable transcription error. Left
 *   unresolved and documented, like phobos/mimas.
 * - enceladus, tethys, dione, rhea, titan, iapetus: NOT fixed. Saturn's shared Laplace-plane pole (40.6, 83.5, and
 *   titan/iapetus's own distinct poles) was re-verified against a fresh fetch of ssd.jpl.nasa.gov/sats/elem/ and
 *   found correct and already per-satellite where the source gives a distinct value (titan 36.4/84.0, iapetus
 *   288.7/78.9) -- the task brief's leading hypothesis for the Saturn group did not hold up. Base elements also
 *   re-verified to match the source exactly. Deriving each body's own orbital angular momentum from its real
 *   Horizons J2000 state vector confirms the pole and inclination are right, but the derived node/periapsis/mean
 *   anomaly disagree with the table by tens of degrees even at the J2000 epoch itself (years=0, so no rate is
 *   involved) -- the same "base elements don't reconstruct the real J2000 position" signature already found and
 *   left unresolved for mimas in round 1. A grid of 8 transcription-convention hypotheses (peri/M column swaps,
 *   +-180 offsets, longitude-vs-anomaly reinterpretations) was tested against all 7 Saturn-group bodies at once and
 *   found no single hypothesis that fixes more than one or two bodies at a time -- i.e. no systematic convention
 *   bug, just idiosyncratic per-body mean-element/osculating-position disagreement, consistent with fix-round-1's
 *   own "Major out-of-scope discovery" that this looked like a system-wide Saturn mean-element issue, not a
 *   four-row one. Left unresolved and documented, like mimas.
 * - deimos, triton: NOT fixed. Both fit the "small error near J2000, growing away" precession-rate signature (like
 *   phobos), not a base-element one. A nodeRateDegPerYear sign grid (the only free rate each has; periRate is 0,
 *   undefined for both bodies' circular orbits) was tested: triton's current (unchanged) sign is already the
 *   better of the two (max 26.57 deg vs. 73.24 deg flipped) and is kept. Deimos's flipped sign scores numerically
 *   better (max 76.08 deg vs. 155.49 deg) but was NOT applied: standard oblateness (J2) perturbation theory predicts
 *   retrograde nodal regression for a near-equatorial prograde satellite -- the sign already in the table -- and a
 *   single binary choice fit to 4 sparse points, against the theoretically-expected sign, is exactly the kind of
 *   fragile fit fix-round-1 rejected for phobos's magnitude search. Left unresolved and documented with the
 *   as-sourced (unchanged) value, like phobos.
 */
const PHASE_BOUND_DEG: Partial<Record<BodyId, number>> = {
  europa: 3.2, // measured 3.0750 at 2050 (jd 2469807.5); see the ruling above and orbits.ts's europa comment.
  phobos: 170, // measured 165.6253 at 2050 (jd 2469807.5); see orbits.ts's phobos comment.
  mimas: 160, // measured 156.2515 at 1975 (jd 2442413.5); see orbits.ts's mimas comment.
  // Task-7 fix-round-2 (see the ruling above): all measured this session after the Uranus pole fix; unrelated
  // bodies (Saturn group, deimos, triton) are unchanged from before the fix, since no code in this file's pipeline
  // changed for them.
  deimos: 160, // measured 155.4874 at 2050 (jd 2469807.5); rate-precision ceiling, same class as phobos.
  enceladus: 150, // measured 146.7563 at 1975 (jd 2442413.5); base-element mismatch, same class as mimas.
  tethys: 75, // measured 72.5266 at 2026 (jd 2461304.5); base-element mismatch, same class as mimas.
  dione: 155, // measured 151.1405 at 2000 (jd 2451545.0); base-element mismatch, same class as mimas.
  rhea: 177, // measured 175.6488 at 2050 (jd 2469807.5); base-element mismatch, same class as mimas.
  titan: 173, // measured 171.8480 at 2026 (jd 2461304.5); base-element mismatch, same class as mimas.
  iapetus: 148, // measured 145.4893 at 1975 (jd 2442413.5); base-element mismatch, same class as mimas.
  miranda: 177, // measured 175.5992 at 2026 (jd 2461304.5); rate-precision ceiling after the pole fix (J2000 itself is 1.09 deg).
  ariel: 100, // measured 97.1794 at 2050 (jd 2469807.5); rate-precision ceiling after the pole fix (J2000 itself is 0.22 deg).
  umbriel: 145, // measured 141.8088 at 2050 (jd 2469807.5); rate-precision ceiling after the pole fix (J2000 itself is 0.05 deg).
  titania: 21, // measured 20.0649 at 2050 (jd 2469807.5); small residual after the pole fix (J2000 itself is 0.06 deg).
  oberon: 21, // measured 20.2484 at 2050 (jd 2469807.5); small residual after the pole fix (J2000 itself is 0.13 deg).
  triton: 27, // measured 26.5703 at 2050 (jd 2469807.5); rate-precision ceiling, same class as phobos.
  // NOT one of task-7's 13 bodies -- flagged here, not silently folded into the ruling above. Unmasked by this
  // session's fixes the same way task-7 fix-round-1 unmasked the Saturn group: the `for` loop (see the module
  // comment) aborts on its first failure, and ceres used to fail after deimos, hiding this. Ceres's elements are
  // JPL SBDB osculating elements at epoch JD 2461200.5 (~2026) with nodeRateDegPerYear/periRateDegPerYear = 0 (no
  // precession modelled, by design -- see orbits.ts's dwarf-planet comment); 1975 is 51 years before that epoch,
  // the largest gap of any reference epoch, and a pure two-body propagation over that gap accumulates real,
  // un-modelled perturbation drift for a main-belt body -- consistent with the other three epochs (1.9954 / 0.0007
  // / 1.9302, all near or under the default bound, growing with distance from the 2026 epoch, not a discontinuity).
  // Investigated and judged a genuine, expected limitation of "elements, no precession" for a dwarf planet, not a
  // bug; out of this task's scope to fix (would mean modelling precession for the dwarf planets, untouched by the
  // task-7 brief). Reported as a ruling, same as the in-scope bodies above.
  ceres: 3.6, // measured 3.5119 at 1975 (jd 2442413.5).
};
const GALILEAN: BodyId[] = ['io', 'europa', 'ganymede', 'callisto'];
/**
 * Same task-7 ruling as PHASE_BOUND_DEG, for the "distance within 3%" test specifically: mimas's angular
 * discrepancy (see above) also puts it at the wrong point in its (non-negligible, e=0.02) eccentric orbit, so its
 * distance from Saturn is off too. phobos's distance stays under 3% even though its angle does not, so it is not
 * listed here and keeps the default.
 *
 * Task-7 fix-round-2: titan and iapetus (see the PHASE_BOUND_DEG ruling above) also exceed 3% in distance for the
 * same base-element-mismatch reason as mimas; every other body in this session's 13, including the Uranus group
 * whose angle is bounded above, stays under 1% in distance (their errors are almost entirely angular, i.e.
 * rotation within a nearly-circular orbit, not radial), so only these two are listed.
 */
const DISTANCE_BOUND: Partial<Record<BodyId, number>> = {
  mimas: 0.037, // measured 0.03494 at 1975 (jd 2442413.5); see orbits.ts's mimas comment.
  titan: 0.056, // measured 0.05437 at 2000 (jd 2451545.0); see the ruling above.
  iapetus: 0.05, // measured 0.04845 at 1975 (jd 2442413.5); see the ruling above.
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
