import { describe, expect, it } from 'vitest';
import { mulMat3, mulMat3Vec, rotX, rotZ, type Mat3 } from '../src/math';

const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// The columns of a 90 degree rotation about z: x -> y, y -> -x.
const RZ90: Mat3 = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];

describe('matrix helpers', () => {
  it('leaves a vector unchanged under the identity', () => {
    expect(mulMat3Vec(IDENTITY, [1, 2, 3])).toEqual([1, 2, 3]);
  });
  it('applies columns: a 90 degree turn about z sends x to y', () => {
    expect(mulMat3Vec(RZ90, [1, 0, 0])).toEqual([0, 1, 0]);
    expect(mulMat3Vec(RZ90, [0, 1, 0])).toEqual([-1, 0, 0]);
  });
  it('multiplies matrices: two quarter turns make a half turn', () => {
    const half = mulMat3(RZ90, RZ90);
    expect(mulMat3Vec(half, [1, 0, 0])).toEqual([-1, 0, 0]);
    expect(mulMat3(IDENTITY, RZ90)).toEqual(RZ90);
  });
  it('rotates about z and x by the right angle and sense', () => {
    const z = rotZ([1, 0, 0], Math.PI / 2);
    expect(z[0]).toBeCloseTo(0, 12);
    expect(z[1]).toBeCloseTo(1, 12);
    const x = rotX([0, 1, 0], Math.PI / 2);
    expect(x[1]).toBeCloseTo(0, 12);
    expect(x[2]).toBeCloseTo(1, 12);
  });
});
