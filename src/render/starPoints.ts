import { spectralClass, type SpectralClass } from '../catalog/stars';

export interface StarSpriteStyle {
  sizePx: number;
  opacity: number;
}

/**
 * Dot size (CSS px) and opacity of a nearby star by spectral class: brighter, hotter classes read bigger. Appearance choices,
 * not photometry: real brightness depends on distance and luminosity, and the spec asks for "brightness/size from spectral
 * type". Every dot is at least the 5 px of the Sun's dot so no star can disappear.
 */
export const STAR_SPRITE_STYLE: Record<SpectralClass, StarSpriteStyle> = {
  A: { sizePx: 8, opacity: 1 },
  G: { sizePx: 7, opacity: 1 },
  K: { sizePx: 6.5, opacity: 0.92 },
  M: { sizePx: 5, opacity: 0.72 },
  D: { sizePx: 5.5, opacity: 0.8 },
};

export function starSpriteStyle(spectralType: string): StarSpriteStyle {
  return STAR_SPRITE_STYLE[spectralClass(spectralType)];
}

/** A star keeps its soft dot as a glow until its sphere is at least as wide as the dot; a planet swaps dot for sphere at 3 px instead. */
export function nearStarSpriteVisible(screenDiameterPx: number, spriteSizePx: number): boolean {
  return screenDiameterPx < spriteSizePx;
}
