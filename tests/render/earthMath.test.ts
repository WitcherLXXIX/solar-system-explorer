import { describe, expect, it } from 'vitest';
import {
  CLOUD_NIGHT_DIMMING, FRESNEL_F0, NIGHT_EDGE_HI, NIGHT_EDGE_LO, WATER_BLUE_HI, WATER_BLUE_LO, WATER_LUMINANCE_HI,
  WATER_LUMINANCE_LO, fresnel, glintIntensity, nightFactor, nightLightFactor, waterMask,
} from '../../src/render/earthMath';

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

describe('fresnel', () => {
  it('is about 2% at normal incidence and near 1 at grazing incidence', () => {
    expect(fresnel(1)).toBeCloseTo(0.02, 12);
    expect(fresnel(0)).toBeCloseTo(1, 12);
    expect(fresnel(0.05)).toBeGreaterThan(0.75);
  });
  it('rises monotonically toward grazing incidence', () => {
    let previous = fresnel(1);
    for (let ndv = 0.95; ndv >= 0; ndv -= 0.05) {
      const value = fresnel(ndv);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
  it('clamps a negative N.V to grazing', () => {
    expect(fresnel(-0.3)).toBeCloseTo(1, 12);
  });
});

describe('glintIntensity', () => {
  it('peaks when the surface normal bisects the Sun and camera, and falls off away from it', () => {
    const peak = glintIntensity(1, 60, 0.8, 0.8, 1, 0, 0);
    const off = glintIntensity(0.95, 60, 0.8, 0.8, 1, 0, 0);
    expect(peak).toBeCloseTo(0.8, 12);
    expect(off).toBeLessThan(peak * 0.1);
  });
  it('needs the Sun above the horizon, water, and no cloud', () => {
    expect(glintIntensity(1, 60, -0.1, 0.8, 1, 0, 0)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 0, 0, 0)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 1, 1, 0)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 1, 0.5, 0)).toBeCloseTo(0.4, 12);
  });
  it('is weak when looking straight down and strong at grazing view angles (Fresnel)', () => {
    const nadir = glintIntensity(1, 60, 0.8, 0.8, 1, 0, 1);
    const grazing = glintIntensity(1, 60, 0.8, 0.8, 1, 0, 0.1);
    expect(nadir).toBeCloseTo(0.8 * 0.02, 12);
    expect(grazing).toBeGreaterThan(nadir * 20);
  });
});

describe('shared shader constants', () => {
  it('nightFactor is 1 at the low edge and 0 at the high edge', () => {
    expect(nightFactor(NIGHT_EDGE_LO)).toBe(1);
    expect(nightFactor(NIGHT_EDGE_HI)).toBe(0);
  });
  it('nightLightFactor dims by cloud cover: 15% left under full cloud', () => {
    expect(nightLightFactor(-1, 0)).toBe(1);
    expect(nightLightFactor(-1, 1)).toBeCloseTo(1 - CLOUD_NIGHT_DIMMING, 12);
    expect(nightLightFactor(1, 0)).toBe(0);
  });
  it('fresnel starts at F0 looking straight on and reaches 1 at grazing incidence', () => {
    expect(fresnel(1)).toBeCloseTo(FRESNEL_F0, 12);
    expect(fresnel(0)).toBeCloseTo(1, 12);
  });
  it('waterMask uses the exported thresholds: blue-dominant dark pixels are water, bright ones are not', () => {
    expect(waterMask(0.02, 0.05, 0.05 + WATER_BLUE_HI)).toBeGreaterThan(0.99);
    expect(waterMask(0.5, 0.5, 0.5 + WATER_BLUE_LO / 2)).toBe(0);
    expect(WATER_LUMINANCE_LO).toBeLessThan(WATER_LUMINANCE_HI);
  });
});
