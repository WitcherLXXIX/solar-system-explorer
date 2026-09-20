import { describe, expect, it } from 'vitest';
import { glintIntensity, nightFactor, waterMask } from '../../src/render/earthMath';

describe('nightFactor', () => {
  it('is 1 well into the night, 0 in full daylight, and eases across the terminator', () => {
    expect(nightFactor(-0.5)).toBe(1);
    expect(nightFactor(0.5)).toBe(0);
    expect(nightFactor(0.02)).toBeGreaterThan(0.3);
    expect(nightFactor(0.02)).toBeLessThan(0.7);
  });
  it('never increases as the Sun rises', () => {
    let previous = 1;
    for (let ndl = -0.3; ndl <= 0.3; ndl += 0.02) {
      const f = nightFactor(ndl);
      expect(f).toBeLessThanOrEqual(previous + 1e-12);
      previous = f;
    }
  });
});

describe('waterMask', () => {
  it('is high for deep and shallow ocean (linear-light colours)', () => {
    expect(waterMask(0.003, 0.021, 0.102)).toBeGreaterThan(0.9); // deep blue ocean
    expect(waterMask(0.013, 0.1, 0.31)).toBeGreaterThan(0.9); // lighter shallow water
  });
  it('is zero for land, vegetation, ice and cloud', () => {
    expect(waterMask(0.5, 0.35, 0.2)).toBe(0); // desert
    expect(waterMask(0.03, 0.08, 0.02)).toBe(0); // vegetation
    expect(waterMask(0.8, 0.8, 0.85)).toBeLessThan(0.05); // ice or cloud: blue-ish but bright
  });
});

describe('glintIntensity', () => {
  it('peaks when the surface normal bisects the Sun and camera, and falls off away from it', () => {
    const peak = glintIntensity(1, 60, 0.8, 0.8, 1, 0);
    const off = glintIntensity(0.95, 60, 0.8, 0.8, 1, 0);
    expect(peak).toBeCloseTo(0.8, 12);
    expect(off).toBeLessThan(peak * 0.1);
  });
  it('needs the Sun above the horizon, water, and no cloud', () => {
    expect(glintIntensity(1, 60, -0.1, 0.8, 1, 0)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 0, 0)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 1, 1)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 1, 0.5)).toBeCloseTo(0.4, 12);
  });
});
