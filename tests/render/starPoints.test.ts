import { describe, expect, it } from 'vitest';
import { NEARBY_STARS } from '../../src/catalog/stars';
import { STAR_SPRITE_STYLE, nearStarSpriteVisible, starSpriteStyle } from '../../src/render/starPoints';
import { SPRITE_MAX_SIZE_PX } from '../../src/render/sprite';

describe('starSpriteStyle', () => {
  it('reads the class from the spectral type: Sirius A (A1V) is bigger and brighter than Proxima (M5.5Ve)', () => {
    const sirius = starSpriteStyle('A1V');
    const proxima = starSpriteStyle('M5.5Ve');
    expect(sirius.sizePx).toBeGreaterThan(proxima.sizePx);
    expect(sirius.opacity).toBeGreaterThan(proxima.opacity);
    expect(starSpriteStyle('DA2')).toEqual(STAR_SPRITE_STYLE.D);
    expect(starSpriteStyle('K5.0V')).toEqual(STAR_SPRITE_STYLE.K);
  });
  it('orders size and opacity A >= G >= K >= M, and keeps every dot at least as big as a small planet sprite and never transparent', () => {
    const order = [STAR_SPRITE_STYLE.A, STAR_SPRITE_STYLE.G, STAR_SPRITE_STYLE.K, STAR_SPRITE_STYLE.M];
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!.sizePx).toBeLessThanOrEqual(order[i - 1]!.sizePx);
      expect(order[i]!.opacity).toBeLessThanOrEqual(order[i - 1]!.opacity);
    }
    for (const style of Object.values(STAR_SPRITE_STYLE)) {
      expect(style.sizePx).toBeGreaterThanOrEqual(SPRITE_MAX_SIZE_PX);
      expect(style.opacity).toBeGreaterThan(0.5);
      expect(style.opacity).toBeLessThanOrEqual(1);
    }
  });
  it('has a style for every one of the twelve catalog stars', () => {
    for (const star of NEARBY_STARS) expect(starSpriteStyle(star.spectralType).sizePx, star.id).toBeGreaterThan(0);
  });
  it('throws for a spectral class it has no style for', () => {
    expect(() => starSpriteStyle('B2V')).toThrow(/spectral class/);
  });
});

describe('nearStarSpriteVisible', () => {
  it('keeps the dot while the star disc is smaller than the dot, then hands over to the sphere alone', () => {
    expect(nearStarSpriteVisible(0.001, 8)).toBe(true);
    expect(nearStarSpriteVisible(7.9, 8)).toBe(true);
    expect(nearStarSpriteVisible(8, 8)).toBe(false);
    expect(nearStarSpriteVisible(500, 8)).toBe(false);
  });
});
