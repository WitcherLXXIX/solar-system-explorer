import { describe, expect, it } from 'vitest';
import { iauAxesEqj, iauOrientation, type IauRotation } from '../../src/ephemeris/iau';
import { EQJ_TO_ECL } from '../../src/ephemeris/frames';
import { cross, dot, length, mulMat3Vec, type Vec3 } from '../../src/math';
import { DEG } from '../../src/units';

// Any values do: these tests check the geometry of the model, not a body's data.
const R: IauRotation = { raDeg: 40, decDeg: 55, w0Deg: 0, wRateDegPerDay: 100 };
const expectVec = (v: Vec3, want: Vec3, digits = 12): void => {
  for (let k = 0; k < 3; k++) expect(v[k]).toBeCloseTo(want[k]!, digits);
};

describe('iauAxesEqj', () => {
  it('puts the north pole at the given right ascension and declination', () => {
    const z = iauAxesEqj(R, 123.4)[2];
    expectVec(z, [Math.cos(55 * DEG) * Math.cos(40 * DEG), Math.cos(55 * DEG) * Math.sin(40 * DEG), Math.sin(55 * DEG)]);
  });
  it('points the prime meridian at the ascending node of the equator on the celestial equator when W = 0', () => {
    const x = iauAxesEqj(R, 0)[0]; // RA of the node = 40 + 90 degrees
    expectVec(x, [-Math.sin(40 * DEG), Math.cos(40 * DEG), 0]);
  });
  it('is orthonormal and right-handed', () => {
    const [x, y, z] = iauAxesEqj(R, 77.7);
    expect(length(x)).toBeCloseTo(1, 12);
    expect(length(y)).toBeCloseTo(1, 12);
    expect(dot(x, y)).toBeCloseTo(0, 12);
    expect(dot(x, z)).toBeCloseTo(0, 12);
    expect(dot(cross(x, y), z)).toBeCloseTo(1, 12);
  });
  it('spins the prime meridian prograde about the pole at the given rate', () => {
    const a = iauAxesEqj(R, 0);
    const b = iauAxesEqj(R, 0.5); // 50 degrees later
    expect(dot(a[0], b[0])).toBeCloseTo(Math.cos(50 * DEG), 12);
    expect(dot(cross(a[0], b[0]), a[2])).toBeGreaterThan(0);
    const back = iauAxesEqj({ ...R, wRateDegPerDay: -100 }, 0.5);
    expect(dot(cross(a[0], back[0]), a[2])).toBeLessThan(0);
  });
  it('adds W0 to the spin angle', () => {
    const a = iauAxesEqj({ ...R, w0Deg: 90 }, 0)[0];
    const b = iauAxesEqj(R, 0)[0];
    expect(dot(a, b)).toBeCloseTo(0, 12);
  });
});

describe('iauOrientation', () => {
  it('is the equatorial result expressed in the ecliptic frame', () => {
    const eqj = iauAxesEqj(R, 10);
    const ecl = iauOrientation(R, 10);
    for (let k = 0; k < 3; k++) expectVec(ecl[k]!, mulMat3Vec(EQJ_TO_ECL, eqj[k]!));
  });
});
