import { describe, expect, it } from 'vitest';
import { SOFT_LAMBERT_GLSL, TERMINATOR_WRAP, softLambert } from '../../src/render/terminatorMath';

describe('softLambert', () => {
  it('is plain Lambert well into the day side and zero well into the night side', () => {
    expect(softLambert(1)).toBe(1);
    expect(softLambert(0.2)).toBe(0.2);
    expect(softLambert(TERMINATOR_WRAP)).toBeCloseTo(TERMINATOR_WRAP, 12);
    expect(softLambert(-TERMINATOR_WRAP)).toBe(0);
    expect(softLambert(-0.5)).toBe(0);
    expect(softLambert(-1)).toBe(0);
  });
  it('is 0.025 at the geometric terminator and 0.00625 at N.L = -0.05 (wrap 0.1)', () => {
    expect(softLambert(0)).toBeCloseTo(0.025, 12);
    expect(softLambert(-0.05)).toBeCloseTo(0.00625, 12);
  });
  it('has no kink: the slope just below and just above each join agrees', () => {
    const h = 1e-6;
    for (const join of [-TERMINATOR_WRAP, TERMINATOR_WRAP]) {
      const below = (softLambert(join) - softLambert(join - h)) / h;
      const above = (softLambert(join + h) - softLambert(join)) / h;
      expect(Math.abs(below - above)).toBeLessThan(1e-4);
    }
  });
  it('never darkens the day side and adds at most wrap/4 (at the terminator)', () => {
    for (let x = -1; x <= 1; x += 0.01) {
      const plain = Math.max(x, 0);
      expect(softLambert(x)).toBeGreaterThanOrEqual(plain - 1e-12);
      expect(softLambert(x)).toBeLessThanOrEqual(plain + TERMINATOR_WRAP / 4 + 1e-12);
    }
  });
  it('is monotonic non-decreasing', () => {
    let previous = -Infinity;
    for (let x = -1; x <= 1; x += 0.005) {
      const v = softLambert(x);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });
  it('the GLSL declares the same wrap constant', () => {
    const m = /const float w = ([\d.]+);/.exec(SOFT_LAMBERT_GLSL);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(TERMINATOR_WRAP);
  });
});
