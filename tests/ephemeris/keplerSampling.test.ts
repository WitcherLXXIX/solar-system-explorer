import { describe, expect, it } from 'vitest';
import { eccentricSampleDays, planePosition, solveKepler, type OrbitalElements } from '../../src/ephemeris/kepler';
import { length, sub } from '../../src/math';
import { DEG, J2000_JD } from '../../src/units';

const AU_KM = 149_597_870.7;
/** A test fixture shaped like a Halley-type comet (a = 17.8 AU, e = 0.967, retrograde). NOT catalog data. */
const FIXTURE: OrbitalElements = {
  epochJd: J2000_JD, aKm: 17.8 * AU_KM, e: 0.967, iDeg: 162, nodeDeg: 58, periDeg: 111, meanAnomalyDeg: 30,
  meanMotionDegPerDay: 360 / (17.8 ** 1.5 * 365.25), nodeRateDegPerYear: 0, periRateDegPerYear: 0,
};
const N_RAD = FIXTURE.meanMotionDegPerDay * DEG;
const PERIOD_DAYS = (2 * Math.PI) / N_RAD;

/** Largest gap between consecutive samples (wrapping round), as a fraction of the semi-major axis. */
function maxChordOverA(daysFromEpoch: readonly number[]): number {
  let worst = 0;
  for (let k = 0; k < daysFromEpoch.length; k++) {
    const p = planePosition(FIXTURE, J2000_JD + daysFromEpoch[k]!);
    const q = planePosition(FIXTURE, J2000_JD + daysFromEpoch[(k + 1) % daysFromEpoch.length]!);
    worst = Math.max(worst, length(sub(p, q)));
  }
  return worst / (FIXTURE.aKm * 1000);
}

describe('solveKepler at comet eccentricities', () => {
  it('solves to machine precision for e = 0.995 and 0.999 at awkward mean anomalies', () => {
    for (const [m, e] of [[1e-4, 0.995], [3.1, 0.995], [-2, 0.999], [0.5, 0.967]] as const) {
      const big = solveKepler(m, e);
      expect(Math.abs(big - e * Math.sin(big) - m), `M=${m} e=${e}`).toBeLessThan(1e-12);
    }
  });
});

describe('eccentricSampleDays', () => {
  const start = FIXTURE.meanAnomalyDeg * DEG;
  const offsets = eccentricSampleDays(start, FIXTURE.e, N_RAD, 720);

  it('starts at the current position and increases strictly, ending before a full period', () => {
    expect(offsets).toHaveLength(720);
    expect(offsets[0]).toBe(0);
    for (let k = 1; k < offsets.length; k++) expect(offsets[k]!).toBeGreaterThan(offsets[k - 1]!);
    expect(offsets[719]!).toBeLessThan(PERIOD_DAYS);
    expect(offsets[719]!).toBeGreaterThan(0.99 * PERIOD_DAYS);
  });
  it('is even in time for a circular orbit', () => {
    const circle = eccentricSampleDays(1.3, 0, 0.5, 8);
    for (let k = 0; k < 8; k++) expect(circle[k]!).toBeCloseTo((k / 8) * ((2 * Math.PI) / 0.5), 9);
  });
  it('keeps the chords of a Halley-type orbit short where even time sampling leaves them long', () => {
    const uniform = Array.from({ length: 720 }, (_, k) => (k / 720) * PERIOD_DAYS);
    // Measured 2026-09-23: 0.0087 for eccentric-anomaly sampling against 0.0592 for even time steps (a = 17.8 AU, e = 0.967).
    expect(maxChordOverA(Array.from(offsets))).toBeLessThan(0.012);
    expect(maxChordOverA(uniform)).toBeGreaterThan(0.05);
  });
});
