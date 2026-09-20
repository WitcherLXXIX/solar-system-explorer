import { describe, expect, it } from 'vitest';
import { add, clamp, cross, dot, lerp, lerpAngle, lerpVec, length, scale, smoothstep, sub } from '../src/math';
import { AU_M, C_M_S, DEG } from '../src/units';

describe('vector helpers', () => {
  it('adds, subtracts and scales', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });
  it('computes dot, cross and length', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(length([3, 4, 12])).toBe(13);
  });
  it('interpolates vectors', () => {
    expect(lerpVec([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });
});

describe('scalar helpers', () => {
  it('clamps and lerps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
  it('smoothsteps between edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
  });
  it('lerps angles along the shortest path', () => {
    expect(lerpAngle(170 * DEG, -170 * DEG, 0.5)).toBeCloseTo(Math.PI, 12);
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 12);
  });
});

describe('units', () => {
  it('uses the exact IAU astronomical unit and speed of light', () => {
    expect(AU_M).toBe(149_597_870_700);
    expect(C_M_S).toBe(299_792_458);
  });
});
