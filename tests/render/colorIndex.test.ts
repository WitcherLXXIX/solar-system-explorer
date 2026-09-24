import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR_INDEX, colorIndexToLinearRGB, colorIndexToRGB, colorIndexToTemperatureK, srgbToLinear, temperatureToSrgb,
} from '../../src/render/colorIndex';

describe('colorIndexToTemperatureK (Ballesteros 2012)', () => {
  it('maps the Sun (B-V 0.65) to about 5778 K and B-V 0 to about 10100 K', () => {
    expect(colorIndexToTemperatureK(0.65)).toBeCloseTo(5778, -1);
    expect(colorIndexToTemperatureK(0)).toBeCloseTo(10125, -1);
  });
  it('is monotonic: redder stars are cooler', () => {
    let previous = Infinity;
    for (let bv = -0.3; bv <= 2.0; bv += 0.1) {
      const t = colorIndexToTemperatureK(bv);
      expect(t).toBeLessThan(previous);
      previous = t;
    }
  });
  it('clamps colour indices outside the fitted range instead of blowing up', () => {
    expect(colorIndexToTemperatureK(9)).toBe(colorIndexToTemperatureK(2.0));
    expect(colorIndexToTemperatureK(-9)).toBe(colorIndexToTemperatureK(-0.4));
  });
});

describe('colorIndexToRGB reference colours', () => {
  it('a hot blue-white star (B-V -0.3) is blue-dominant', () => {
    const [r, g, b] = colorIndexToRGB(-0.3);
    expect(r).toBeCloseTo(0.6947, 3);
    expect(g).toBeCloseTo(0.7945, 3);
    expect(b).toBe(1);
    expect(b).toBeGreaterThan(r);
  });
  it('a Sun-like star (B-V 0.65) is near white, slightly warm', () => {
    const [r, g, b] = colorIndexToRGB(0.65);
    expect(r).toBe(1);
    expect(g).toBeCloseTo(0.9506, 3);
    expect(b).toBeCloseTo(0.9042, 3);
  });
  it('a cool red-orange star (B-V 1.8) is red-dominant', () => {
    const [r, g, b] = colorIndexToRGB(1.8);
    expect(r).toBe(1);
    expect(g).toBeCloseTo(0.7428, 3);
    expect(b).toBeCloseTo(0.5282, 3);
    expect(r - b).toBeGreaterThan(0.4);
  });
  it('the red-minus-blue excess never decreases as the colour index rises', () => {
    let previous = -Infinity;
    for (let bv = -0.3; bv <= 2.0; bv += 0.1) {
      const [r, , b] = colorIndexToRGB(bv);
      expect(r - b).toBeGreaterThanOrEqual(previous);
      previous = r - b;
    }
  });
  it('every channel stays in 0..1', () => {
    for (let bv = -1; bv <= 3; bv += 0.05) {
      for (const c of colorIndexToRGB(bv)) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
  it('a missing or non-finite colour index falls back to the default (0.6), never NaN', () => {
    expect(colorIndexToRGB(Number.NaN)).toEqual(colorIndexToRGB(DEFAULT_COLOR_INDEX));
    expect(colorIndexToRGB(Infinity)).toEqual(colorIndexToRGB(DEFAULT_COLOR_INDEX));
  });
});

describe('srgbToLinear and colorIndexToLinearRGB', () => {
  it('matches the sRGB transfer function', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 12);
    expect(srgbToLinear(0.04)).toBeCloseTo(0.0030959752, 9); // linear segment: 0.04 / 12.92
    expect(srgbToLinear(0.5)).toBeCloseTo(0.21404114, 7);
  });
  it('converts each channel of colorIndexToRGB', () => {
    const s = colorIndexToRGB(0.65);
    const l = colorIndexToLinearRGB(0.65);
    expect(l).toEqual([srgbToLinear(s[0]), srgbToLinear(s[1]), srgbToLinear(s[2])]);
  });
});

describe('temperatureToSrgb', () => {
  it('is white-ish at 6600 K and clamps absurd temperatures', () => {
    const [r, , b] = temperatureToSrgb(6600);
    expect(r).toBe(1);
    expect(b).toBe(1);
    expect(temperatureToSrgb(1e9)).toEqual(temperatureToSrgb(40000));
    expect(temperatureToSrgb(-5)).toEqual(temperatureToSrgb(1000));
  });
});
