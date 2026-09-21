import { describe, expect, it } from 'vitest';
import { poleFrame, planePosition, solveKepler, type OrbitalElements } from '../../src/ephemeris/kepler';
import { cross, dot, length, type Vec3 } from '../../src/math';
import { DEG, J2000_JD } from '../../src/units';

// A 1000 km orbit with a one-day period, so that a quarter day is a quarter turn.
const BASE: OrbitalElements = {
  epochJd: J2000_JD, aKm: 1000, e: 0, iDeg: 0, nodeDeg: 0, periDeg: 0, meanAnomalyDeg: 0,
  meanMotionDegPerDay: 360, nodeRateDegPerYear: 0, periRateDegPerYear: 0,
};
const at = (el: OrbitalElements, days: number): Vec3 => planePosition(el, J2000_JD + days);
const expectVec = (v: Vec3, want: Vec3, digits = 6): void => {
  for (let k = 0; k < 3; k++) expect(v[k]).toBeCloseTo(want[k]!, digits);
};

describe('solveKepler', () => {
  it('returns the mean anomaly for a circular orbit', () => {
    expect(solveKepler(1.234, 0)).toBeCloseTo(1.234, 12);
  });
  it('is 0 at 0 and pi at pi for any eccentricity', () => {
    expect(solveKepler(0, 0.7)).toBe(0);
    expect(Math.abs(solveKepler(Math.PI, 0.7))).toBeCloseTo(Math.PI, 12); // +pi and -pi are the same angle
  });
  it('matches values computed independently (Newton iteration in a scratch script)', () => {
    expect(solveKepler(1, 0.5)).toBeCloseTo(1.4987011335, 9);
    expect(solveKepler(0.1, 0.9)).toBeCloseTo(0.6308435276, 9);
    expect(solveKepler(-1, 0.5)).toBeCloseTo(-1.4987011335, 9);
  });
  it('wraps mean anomalies beyond one turn', () => {
    expect(solveKepler(1 + 2 * Math.PI, 0.5)).toBeCloseTo(1.4987011335, 9);
    expect(solveKepler(1 - 4 * Math.PI, 0.5)).toBeCloseTo(1.4987011335, 9);
  });
  it('satisfies Kepler\'s equation over a grid, including high eccentricity', () => {
    for (const e of [0, 0.05, 0.3, 0.6, 0.9, 0.99]) {
      for (let k = -11; k <= 11; k++) {
        const m = (k / 12) * Math.PI;
        const big = solveKepler(m, e);
        expect(big - e * Math.sin(big)).toBeCloseTo(m, 11);
      }
    }
  });
  it('rejects non-elliptical eccentricities', () => {
    expect(() => solveKepler(1, 1)).toThrow();
    expect(() => solveKepler(1, -0.1)).toThrow();
  });
});

describe('planePosition', () => {
  it('starts at periapsis on the x axis and turns counter-clockwise', () => {
    expectVec(at(BASE, 0), [1e6, 0, 0]);
    expectVec(at(BASE, 0.25), [0, 1e6, 0]);
    expectVec(at(BASE, 0.5), [-1e6, 0, 0]);
  });
  it('repeats after exactly one period', () => {
    const el = { ...BASE, e: 0.3, iDeg: 40, nodeDeg: 70, periDeg: 20, meanAnomalyDeg: 33 };
    expectVec(at(el, 1), at(el, 0), 3);
  });
  it('puts periapsis at a(1 - e) and apoapsis at a(1 + e)', () => {
    const el = { ...BASE, e: 0.5 };
    expectVec(at(el, 0), [5e5, 0, 0]);
    expectVec(at(el, 0.5), [-1.5e6, 0, 0]);
  });
  it('keeps the radius between periapsis and apoapsis all the way round', () => {
    const el = { ...BASE, e: 0.3, iDeg: 25, nodeDeg: 100, periDeg: 60 };
    for (let k = 0; k < 40; k++) {
      const r = length(at(el, k / 40));
      expect(r).toBeGreaterThanOrEqual(7e5 - 1e-3);
      expect(r).toBeLessThanOrEqual(1.3e6 + 1e-3);
    }
  });
  it('tilts the orbit: 90 degrees of inclination sends the quarter-turn point to +z', () => {
    expectVec(at({ ...BASE, iDeg: 90 }, 0.25), [0, 0, 1e6]);
  });
  it('30 degrees of inclination lifts the quarter-turn point by a sin(30) (computed by hand: 866025.4, 500000)', () => {
    expectVec(at({ ...BASE, iDeg: 30 }, 0.25), [0, 866025.4038, 500000], 3);
  });
  it('rotates by the node and by the argument of periapsis', () => {
    expectVec(at({ ...BASE, nodeDeg: 90 }, 0), [0, 1e6, 0]);
    expectVec(at({ ...BASE, periDeg: 90 }, 0), [0, 1e6, 0]);
  });
  it('applies node and periapsis precession per Julian year, with sign', () => {
    const frozen = { ...BASE, meanMotionDegPerDay: 0 };
    // cos(10 deg) = 0.984807753, sin(10 deg) = 0.173648178
    expectVec(at({ ...frozen, nodeRateDegPerYear: -10 }, 365.25), [984807.753, -173648.178, 0], 3);
    expectVec(at({ ...frozen, periRateDegPerYear: 10 }, 365.25), [984807.753, 173648.178, 0], 3);
  });
  it('runs backwards before the epoch', () => {
    expectVec(at(BASE, -0.25), [0, -1e6, 0]);
  });
});

describe('poleFrame', () => {
  it('for a pole at the north celestial pole is the equatorial frame turned a quarter (x at RA 90)', () => {
    const f = poleFrame(0, 90);
    expectVec(f[2], [0, 0, 1], 12);
    expectVec(f[0], [0, 1, 0], 12);
    expectVec(f[1], [-1, 0, 0], 12);
  });
  it('for a pole on the equator at RA 90 puts z on +y and y on +z', () => {
    const f = poleFrame(90, 0);
    expectVec(f[2], [0, 1, 0], 12);
    expectVec(f[0], [-1, 0, 0], 12);
    expectVec(f[1], [0, 0, 1], 12);
  });
  it('always has x on the equator and an orthonormal, right-handed set of axes', () => {
    const [x, y, z] = poleFrame(257.311, -15.175); // the IAU pole of Uranus
    expect(x[2]).toBeCloseTo(0, 12);
    expect(length(x)).toBeCloseTo(1, 12);
    expect(length(y)).toBeCloseTo(1, 12);
    expect(length(z)).toBeCloseTo(1, 12);
    expect(dot(x, y)).toBeCloseTo(0, 12);
    expect(dot(x, z)).toBeCloseTo(0, 12);
    expect(dot(cross(x, y), z)).toBeCloseTo(1, 12);
    expect(z[2]).toBeCloseTo(Math.sin(-15.175 * DEG), 12);
  });
});
