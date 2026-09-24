import { describe, expect, it } from 'vitest';
import { MAX_CAMERA_DISTANCE_M } from '../../src/camera/cameraController';
import { NOTABLE_STARS } from '../../src/catalog/skyStars';
import { NEARBY_STARS } from '../../src/catalog/stars';
import { FAR_M } from '../../src/render/cameraRelative';
import {
  SKY_LABEL_SUPPRESSED, SKY_RADIUS_M, STAR_OPACITY_MIN, STAR_SIZE_MAX_PX, STAR_SIZE_MIN_PX, skyLabelOpacity, skyStarPositionThree,
  starOpacity, starSizePx,
} from '../../src/render/skyStarMath';
import { length } from '../../src/math';

describe('the sky radius', () => {
  it('is just inside the far plane, so no star is ever clipped, and far beyond the farthest camera position', () => {
    expect(SKY_RADIUS_M).toBeLessThan(FAR_M);
    expect(SKY_RADIUS_M).toBeGreaterThanOrEqual(0.5 * FAR_M);
    expect(SKY_RADIUS_M).toBeGreaterThan(5 * MAX_CAMERA_DISTANCE_M);
  });
});

describe('starSizePx', () => {
  it('is largest for the brightest and smallest for the faintest, continuous in between', () => {
    expect(starSizePx(-1.5)).toBe(STAR_SIZE_MAX_PX);
    expect(starSizePx(-3)).toBe(STAR_SIZE_MAX_PX);
    expect(starSizePx(6)).toBe(STAR_SIZE_MIN_PX);
    expect(starSizePx(10)).toBe(STAR_SIZE_MIN_PX);
    expect(starSizePx(2)).toBeCloseTo(3.9, 10);
    expect(starSizePx(-1.44)).toBeGreaterThan(starSizePx(-0.05));
    expect(starSizePx(-0.05)).toBeGreaterThan(starSizePx(1.0));
    expect(starSizePx(4.0)).toBeGreaterThan(starSizePx(4.1));
  });
});

describe('starOpacity', () => {
  it('is 1 for stars of magnitude 0 or brighter and fades to the minimum at magnitude 6', () => {
    expect(starOpacity(-1.44)).toBe(1);
    expect(starOpacity(0)).toBe(1);
    expect(starOpacity(3)).toBeCloseTo(0.65, 10);
    expect(starOpacity(6)).toBeCloseTo(STAR_OPACITY_MIN, 10);
    expect(starOpacity(9)).toBeCloseTo(STAR_OPACITY_MIN, 10);
    expect(starOpacity(1)).toBeGreaterThan(starOpacity(2));
  });
});

describe('skyLabelOpacity', () => {
  it('fades in on a log-altitude ramp from 1e9 m to 1e11 m', () => {
    expect(skyLabelOpacity(1e9)).toBe(0);
    expect(skyLabelOpacity(1e6)).toBe(0);
    expect(skyLabelOpacity(1e10)).toBeCloseTo(0.5, 10);
    expect(skyLabelOpacity(1e11)).toBe(1);
    expect(skyLabelOpacity(1e17)).toBe(1);
  });
  it('is 0 for zero or negative altitude, never NaN', () => {
    expect(skyLabelOpacity(0)).toBe(0);
    expect(skyLabelOpacity(-5)).toBe(0);
  });
});

describe('skyStarPositionThree', () => {
  it('lies at the sky radius, in Three.js axes (y up)', () => {
    const v = skyStarPositionThree(0, 90); // north celestial pole: ecliptic (0, 0.39778, 0.91748) -> Three (x, z, -y)
    expect(length(v) / SKY_RADIUS_M).toBeCloseTo(1, 12);
    expect(v[0] / SKY_RADIUS_M).toBeCloseTo(0, 12);
    expect(v[1] / SKY_RADIUS_M).toBeCloseTo(0.9174821431, 9);
    expect(v[2] / SKY_RADIUS_M).toBeCloseTo(-0.3977769691, 9);
  });
  it('puts the vernal equinox on +x', () => {
    const v = skyStarPositionThree(0, 0);
    expect(v[0] / SKY_RADIUS_M).toBeCloseTo(1, 12);
  });
});

describe('SKY_LABEL_SUPPRESSED', () => {
  it('names exactly the notable stars that duplicate a phase-4 nearby star, and all of them are real notable stars', () => {
    expect([...SKY_LABEL_SUPPRESSED].sort()).toEqual(['Rigil Kentaurus', 'Sirius', 'Toliman']);
    const names = new Set(NOTABLE_STARS.map((s) => s.name));
    for (const n of SKY_LABEL_SUPPRESSED) expect(names.has(n), n).toBe(true);
    // The nearby catalog really has them (Alpha Centauri A/B, Sirius A).
    expect(NEARBY_STARS.some((s) => s.name === 'Sirius A')).toBe(true);
    expect(NEARBY_STARS.some((s) => s.name === 'Alpha Centauri A')).toBe(true);
    expect(NEARBY_STARS.some((s) => s.name === 'Alpha Centauri B')).toBe(true);
  });
});
