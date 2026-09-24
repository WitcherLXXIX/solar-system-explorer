import { describe, expect, it } from 'vitest';
import {
  MAX_OCCLUDERS, MIN_SHADOW_WIDTH, combinedShadow, selectOccluders, shadowLit, type Occluder,
} from '../../src/render/bodyShadowMath';

const SUN = [0, 0, 1] as const;
const TAN = 0.005;

describe('shadowLit', () => {
  it('is 0 in the umbra, on the axis behind a large occluder', () => {
    expect(shadowLit([0, 0, 1], SUN, { position: [0, 0, 5], radius: 0.5 }, TAN)).toBe(0);
  });
  it('is 1 well outside the shadow', () => {
    expect(shadowLit([1, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, TAN)).toBe(1);
  });
  it('is exactly 0.5 halfway across the penumbra', () => {
    // t = 5, w = 0.025, edges 0.475..0.525, d = 0.5 is the midpoint.
    expect(shadowLit([0.5, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, TAN)).toBeCloseTo(0.5, 12);
  });
  it('leaves a bright ring when the occluder looks smaller than the Sun (annular case): darkness (r/w)^2', () => {
    // t = 50, w = 0.25 > r = 0.1, so the darkest possible is (0.1 / 0.25)^2 = 0.16 and 84% of the light remains.
    expect(shadowLit([0, 0, 0], SUN, { position: [0, 0, 50], radius: 0.1 }, TAN)).toBeCloseTo(0.84, 12);
  });
  it('is 1 when the occluder is on the far side of the point from the Sun', () => {
    expect(shadowLit([0, 0, 0], SUN, { position: [0, 0, -5], radius: 0.5 }, TAN)).toBe(1);
  });
  it('is 1 for a zero-width Sun (no NaN from a degenerate penumbra)', () => {
    const v = shadowLit([2, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, 0);
    expect(v).toBe(1);
    expect(shadowLit([0, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, 0)).toBe(0);
    expect(MIN_SHADOW_WIDTH).toBeGreaterThan(0);
  });
});

describe('combinedShadow', () => {
  const umbra: Occluder = { position: [0, 0, 5], radius: 0.5 };
  const elsewhere: Occluder = { position: [9, 0, 5], radius: 0.5 };
  it('is 1 with no occluders', () => {
    expect(combinedShadow([0, 0, 0], SUN, [], TAN)).toBe(1);
  });
  it('is the product of the individual factors', () => {
    expect(combinedShadow([0, 0, 0], SUN, [umbra, elsewhere], TAN)).toBe(0);
    expect(combinedShadow([1, 0, 0], SUN, [umbra, elsewhere], TAN)).toBe(1);
    const half: Occluder = { position: [0, 0, 5], radius: 0.5 };
    expect(combinedShadow([0.5, 0, 0], SUN, [half, half], TAN)).toBeCloseTo(0.25, 12);
  });
});

describe('selectOccluders', () => {
  const A: Occluder = { position: [0, 0, 5], radius: 0.5 }; // on the axis: score -0.525
  const B: Occluder = { position: [3, 0, 5], radius: 0.5 }; // misses the receiver by a wide margin: dropped
  const C: Occluder = { position: [1, 0, 3], radius: 0.2 }; // grazes the receiver: kept, score 0.785
  const D: Occluder = { position: [0, 0, -4], radius: 1 }; // behind the receiver: dropped
  const E: Occluder = { position: [0.5, 0, 8], radius: 0.3 }; // kept, score 0.16
  it('drops occluders behind the receiver or missing it, and orders the rest by how squarely they cover it', () => {
    expect(selectOccluders([B, C, D, E, A], SUN, TAN)).toEqual([A, E, C]);
  });
  it('keeps at most `max`, closest first', () => {
    expect(selectOccluders([B, C, D, E, A], SUN, TAN, 2)).toEqual([A, E]);
  });
  it('returns an empty list for no candidates, and MAX_OCCLUDERS is 4', () => {
    expect(selectOccluders([], SUN, TAN)).toEqual([]);
    expect(MAX_OCCLUDERS).toBe(4);
  });
  it('never returns more than MAX_OCCLUDERS by default', () => {
    const many: Occluder[] = Array.from({ length: 9 }, (_, i) => ({ position: [0.1 * i, 0, 5 + i] as const, radius: 0.5 }));
    expect(selectOccluders(many, SUN, TAN)).toHaveLength(MAX_OCCLUDERS);
  });
});
