import { describe, expect, it } from 'vitest';
import { assumedOrientation, lockedOrientation, relativeVelocity } from '../../src/ephemeris/locked';
import { cross, dot, length, type Vec3 } from '../../src/math';

const expectVec = (v: Vec3, want: Vec3, digits = 9): void => {
  for (let k = 0; k < 3; k++) expect(v[k]).toBeCloseTo(want[k]!, digits);
};

describe('lockedOrientation', () => {
  it('points x at the parent, z along the orbit normal and y completing a right-handed set', () => {
    // A moon on +x moving toward +y: the parent is in the -x direction and the orbit normal is +z.
    const m = lockedOrientation([1e8, 0, 0], [0, 1e3, 0]);
    expectVec(m[0], [-1, 0, 0]);
    expectVec(m[2], [0, 0, 1]);
    expectVec(m[1], [0, -1, 0]);
    expect(dot(cross(m[0], m[1]), m[2])).toBeCloseTo(1, 12);
  });
  it('turns once per orbit and prograde: a quarter orbit later x has turned by 90 degrees the same way', () => {
    const a = lockedOrientation([1e8, 0, 0], [0, 1e3, 0]);
    const b = lockedOrientation([0, 1e8, 0], [-1e3, 0, 0]);
    expect(dot(a[0], b[0])).toBeCloseTo(0, 12);
    expect(dot(cross(a[0], b[0]), a[2])).toBeGreaterThan(0);
  });
  it('is orthonormal for a tilted, eccentric state', () => {
    const [x, y, z] = lockedOrientation([3e8, -1e8, 5e7], [200, 900, 150]);
    expect(length(x)).toBeCloseTo(1, 12);
    expect(length(y)).toBeCloseTo(1, 12);
    expect(length(z)).toBeCloseTo(1, 12);
    expect(dot(x, y)).toBeCloseTo(0, 12);
    expect(dot(x, z)).toBeCloseTo(0, 12);
  });
  it('a retrograde orbit flips the normal: x still points at the parent, z points the other way', () => {
    const m = lockedOrientation([1e8, 0, 0], [0, -1e3, 0]);
    expectVec(m[0], [-1, 0, 0]);
    expectVec(m[2], [0, 0, -1]);
  });
});

describe('assumedOrientation', () => {
  it('spins about the ecliptic pole: a quarter turn after a quarter period puts x on +y', () => {
    const m = assumedOrientation(24, 0.25); // 24 h period, 6 h later
    expectVec(m[0], [0, 1, 0]);
    expectVec(m[2], [0, 0, 1]);
  });
  it('a negative period spins the other way, and half a period gives -x', () => {
    expectVec(assumedOrientation(-24, 0.25)[0], [0, -1, 0]);
    expectVec(assumedOrientation(12, 0.25)[0], [-1, 0, 0]);
  });
});

describe('relativeVelocity', () => {
  it('differentiates a uniform circular motion: speed r*omega, perpendicular to the radius', () => {
    const r = 4e8;
    const omega = 2 * Math.PI / 86_400;
    const position = (dtS: number): Vec3 => [r * Math.cos(omega * dtS), r * Math.sin(omega * dtS), 0];
    const v = relativeVelocity(position);
    expect(length(v)).toBeCloseTo(r * omega, 1);
    expect(dot(v, position(0))).toBeCloseTo(0, 0);
    expect(v[1]).toBeGreaterThan(0);
  });
});
