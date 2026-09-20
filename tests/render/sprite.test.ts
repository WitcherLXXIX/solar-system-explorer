import { describe, expect, it } from 'vitest';
import { SPRITE_THRESHOLD_PX } from '../../src/render/cameraRelative';
import {
  SPRITE_MAX_SIZE_PX, SPRITE_MIN_SIZE_PX, illuminationFraction, spriteAppearance,
} from '../../src/render/sprite';

describe('spriteAppearance', () => {
  it('is smaller and fainter for smaller apparent size, so far planets differ', () => {
    const faint = spriteAppearance(0.01, 1, false);
    const mid = spriteAppearance(0.3, 1, false);
    expect(faint.sizePx).toBeCloseTo(SPRITE_MIN_SIZE_PX, 9);
    expect(mid.sizePx).toBeGreaterThan(faint.sizePx);
    expect(mid.opacity).toBeGreaterThan(faint.opacity);
    expect(faint.opacity).toBeGreaterThan(0.3); // still visible
  });
  it('reaches full size and opacity at the sphere switch (no pop)', () => {
    const edge = spriteAppearance(SPRITE_THRESHOLD_PX, 1, false);
    expect(edge.sizePx).toBeCloseTo(SPRITE_MAX_SIZE_PX, 9);
    expect(edge.opacity).toBeCloseTo(1, 9);
  });
  it('clamps below the faintest size and is continuous approaching the threshold', () => {
    expect(spriteAppearance(1e-9, 1, false)).toEqual(spriteAppearance(0.01, 1, false));
    const a = spriteAppearance(SPRITE_THRESHOLD_PX * 0.99, 1, false);
    const b = spriteAppearance(SPRITE_THRESHOLD_PX, 1, false);
    expect(Math.abs(a.sizePx - b.sizePx)).toBeLessThan(0.05);
    expect(Math.abs(a.opacity - b.opacity)).toBeLessThan(0.02);
  });
  it('dims a planet by phase but never to invisible', () => {
    const full = spriteAppearance(0.5, 1, false).opacity;
    const dark = spriteAppearance(0.5, 0, false).opacity;
    expect(dark).toBeLessThan(full);
    expect(dark).toBeGreaterThan(0.2);
  });
  it('keeps a star opaque regardless of size or illumination', () => {
    expect(spriteAppearance(0.001, 0, true).opacity).toBe(1);
    expect(spriteAppearance(0.001, 0, true).sizePx).toBeCloseTo(SPRITE_MAX_SIZE_PX + 2, 9);
    expect(spriteAppearance(SPRITE_THRESHOLD_PX, 0, true).sizePx).toBeCloseTo(SPRITE_MAX_SIZE_PX, 9);
  });
});

describe('illuminationFraction', () => {
  const sun = [0, 0, 0] as const;
  const body = [1e11, 0, 0] as const;
  it('is 1 for a camera on the sun side of the body (full phase)', () => {
    expect(illuminationFraction(body, sun, [0.5e11, 0, 0])).toBeCloseTo(1, 12);
  });
  it('is 0 for a camera behind the body looking at the sun (new phase)', () => {
    expect(illuminationFraction(body, sun, [2e11, 0, 0])).toBeCloseTo(0, 12);
  });
  it('is 0.5 at quarter phase', () => {
    expect(illuminationFraction(body, sun, [1e11, 5e10, 0])).toBeCloseTo(0.5, 12);
  });
  it('is 1 when the camera coincides with the body', () => {
    expect(illuminationFraction(body, sun, body)).toBe(1);
  });
});
