import { describe, expect, it } from 'vitest';
import { planetShadowFactor, ringCrossingRadius, ringRadialFraction, ringShadowFactor } from '../../src/render/ringMath';

describe('planetShadowFactor', () => {
  const sun = [0, 0, 1] as const; // the Sun is toward +z
  it('is 0 directly behind the planet, 1 beside it and on the Sun side', () => {
    expect(planetShadowFactor([0, 0, -3], sun)).toBe(0);
    expect(planetShadowFactor([3, 0, -3], sun)).toBe(1);
    expect(planetShadowFactor([0, 0, 3], sun)).toBe(1);
  });
  it('has a soft edge centred on the planet radius', () => {
    expect(planetShadowFactor([1, 0, -3], sun)).toBeCloseTo(0.5, 6);
    expect(planetShadowFactor([1.02, 0, -3], sun)).toBe(1);
    expect(planetShadowFactor([0.98, 0, -3], sun)).toBe(0);
  });
});

describe('ringCrossingRadius', () => {
  it('finds where the ray toward the Sun crosses the equatorial plane', () => {
    expect(ringCrossingRadius([1, 0.5, 0], [0.6, -0.8, 0])!).toBeCloseTo(1.375, 12);
  });
  it('is null when the Sun is above a northern point, or the ray is parallel to the plane', () => {
    expect(ringCrossingRadius([1, 0.5, 0], [0.6, 0.8, 0])).toBeNull();
    expect(ringCrossingRadius([1, 0.5, 0], [1, 0, 0])).toBeNull();
  });
});

describe('ringRadialFraction', () => {
  it('maps radii to 0..1 across the ring and null outside it', () => {
    expect(ringRadialFraction(1.5, 1, 2)).toBeCloseTo(0.5, 12);
    expect(ringRadialFraction(0.9, 1, 2)).toBeNull();
    expect(ringRadialFraction(2.1, 1, 2)).toBeNull();
  });
});

describe('ringShadowFactor', () => {
  it('dims by the ring opacity where the ray crosses the ring, and not elsewhere', () => {
    const full = () => 1;
    expect(ringShadowFactor([1, 0.5, 0], [0.6, -0.8, 0], 1.2, 2, full)).toBeCloseTo(0.1, 12); // crossing at 1.375
    expect(ringShadowFactor([1, 0.5, 0], [0.6, -0.8, 0], 1.5, 2, full)).toBe(1); // crossing is inside the ring's inner edge
    expect(ringShadowFactor([1, 0.5, 0], [0.6, 0.8, 0], 1.2, 2, full)).toBe(1); // Sun above: never crosses
  });
  it('uses the opacity at the crossing radius', () => {
    const alphaAt = (u: number) => u; // more opaque farther out
    const near = ringShadowFactor([1, 0.5, 0], [0.6, -0.8, 0], 1.2, 2, alphaAt, 1);
    expect(near).toBeCloseTo(1 - (1.375 - 1.2) / 0.8, 12);
  });
});
