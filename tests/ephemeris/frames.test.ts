import { MakeTime, RotateVector, Rotation_EQJ_ECL, Vector } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { EQJ_TO_ECL, planeToEcliptic } from '../../src/ephemeris/frames';
import { mulMat3Vec, type Vec3 } from '../../src/math';
import { DEG } from '../../src/units';

const expectVec = (v: Vec3, want: Vec3, digits = 9): void => {
  for (let k = 0; k < 3; k++) expect(v[k]).toBeCloseTo(want[k]!, digits);
};
// Mean obliquity of astronomy-engine's ecliptic, from its own matrix: acos(0.9174821430670688) = 23.4392794 degrees.
const COS_EPS = 0.9174821430670688;
const SIN_EPS = 0.3977769691083922;

describe('EQJ_TO_ECL', () => {
  it('leaves the equinox alone and tips the equatorial pole by the obliquity', () => {
    expectVec(mulMat3Vec(EQJ_TO_ECL, [1, 0, 0]), [1, 0, 0]);
    // The celestial pole sits at ecliptic latitude 90 - obliquity, longitude 90 degrees: (0, sin eps, cos eps).
    expectVec(mulMat3Vec(EQJ_TO_ECL, [0, 0, 1]), [0, SIN_EPS, COS_EPS]);
    expectVec(mulMat3Vec(EQJ_TO_ECL, [0, 1, 0]), [0, COS_EPS, -SIN_EPS]);
  });
  it('agrees with astronomy-engine\'s own RotateVector', () => {
    const v = new Vector(0.3, -0.7, 0.5, MakeTime(new Date('2026-01-01T00:00:00Z')));
    const want = RotateVector(Rotation_EQJ_ECL(), v);
    expectVec(mulMat3Vec(EQJ_TO_ECL, [0.3, -0.7, 0.5]), [want.x, want.y, want.z], 12);
  });
});

describe('planeToEcliptic', () => {
  it('is the identity for the ecliptic itself', () => {
    expect(planeToEcliptic('ecliptic')).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  });
  it('agrees with the identity for the ecliptic pole given as right ascension and declination', () => {
    // The ecliptic pole is at RA 270 degrees, declination 90 - obliquity = 66.5607205558 degrees.
    const m = planeToEcliptic({ poleRaDeg: 270, poleDecDeg: 66.5607205558 });
    expectVec(m[0], [1, 0, 0], 8);
    expectVec(m[1], [0, 1, 0], 8);
    expectVec(m[2], [0, 0, 1], 8);
  });
  it('maps the equatorial pole frame onto the tilted equator', () => {
    const m = planeToEcliptic({ poleRaDeg: 0, poleDecDeg: 90 });
    expectVec(m[2], [0, SIN_EPS, COS_EPS]);
    expectVec(m[0], [0, COS_EPS, -SIN_EPS]); // x is at RA 90 degrees, i.e. EQJ +y
  });
  it('puts an orbit with zero inclination into the plane perpendicular to its pole', () => {
    const frame = { poleRaDeg: 257.311, poleDecDeg: -15.175 };
    const m = planeToEcliptic(frame);
    const pole = mulMat3Vec(EQJ_TO_ECL, [
      Math.cos(-15.175 * DEG) * Math.cos(257.311 * DEG),
      Math.cos(-15.175 * DEG) * Math.sin(257.311 * DEG),
      Math.sin(-15.175 * DEG),
    ]);
    expectVec(m[2], pole, 12);
    for (const inPlane of [m[0], m[1]]) {
      expect(inPlane[0] * pole[0] + inPlane[1] * pole[1] + inPlane[2] * pole[2]).toBeCloseTo(0, 12);
    }
  });
});
