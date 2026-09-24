import { clamp, lerp, scale, smoothstep, type Vec3 } from '../math';
import { raDecToDirection } from '../ephemeris/starPosition';
import { FAR_M, eclipticToThree } from './cameraRelative';

/**
 * Radius of the sky sphere, metres, in camera-centred render space. The camera is always the origin of render space, so the
 * stars never move with it: their DIRECTION is real, their distance is not (Ruling: shown in real direction, not real distance).
 * Just inside the far plane so the stars sit behind every real body; far beyond the 1e17 m maximum camera distance.
 */
export const SKY_RADIUS_M = 0.9 * FAR_M;

/** Dot size (CSS px) of a star of magnitude STAR_MAG_BRIGHT or brighter, and of magnitude STAR_MAG_FAINT or fainter. Appearance, not photometry. */
export const STAR_SIZE_MAX_PX = 6;
export const STAR_SIZE_MIN_PX = 1.5;
export const STAR_MAG_BRIGHT = -1.5;
export const STAR_MAG_FAINT = 6;
/** Opacity of a magnitude-6 star; stars of magnitude 0 or brighter are fully opaque. */
export const STAR_OPACITY_MIN = 0.3;

/** Dot size in CSS pixels from apparent magnitude: continuous, brighter is larger. */
export function starSizePx(mag: number): number {
  const t = clamp((mag - STAR_MAG_BRIGHT) / (STAR_MAG_FAINT - STAR_MAG_BRIGHT), 0, 1);
  return lerp(STAR_SIZE_MAX_PX, STAR_SIZE_MIN_PX, t);
}

/** Dot opacity from apparent magnitude: 1 at magnitude 0 and brighter, STAR_OPACITY_MIN at magnitude 6. */
export function starOpacity(mag: number): number {
  return lerp(1, STAR_OPACITY_MIN, clamp(mag / STAR_MAG_FAINT, 0, 1));
}

/** The notable-star labels fade in on log10(altitude in metres) from SKY_LABEL_LOG_LO (invisible) to SKY_LABEL_LOG_HI (opaque). */
export const SKY_LABEL_LOG_LO = 9;
export const SKY_LABEL_LOG_HI = 11;

export function skyLabelOpacity(altitudeM: number): number {
  return altitudeM > 0 ? smoothstep(SKY_LABEL_LOG_LO, SKY_LABEL_LOG_HI, Math.log10(altitudeM)) : 0;
}

/** Position of a sky star in render (Three.js) axes, metres from the camera. */
export function skyStarPositionThree(raHours: number, decDeg: number): Vec3 {
  return eclipticToThree(scale(raDecToDirection(raHours, decDeg), SKY_RADIUS_M));
}

/**
 * Notable stars whose label is not drawn because phase 4 already has a flyable, labelled nearby star at the same place
 * (Sirius A, Alpha Centauri A and B; Rigil Kentaurus and Toliman are Alpha Centauri A and B). Their dots are still drawn.
 */
export const SKY_LABEL_SUPPRESSED: ReadonlySet<string> = new Set(['Sirius', 'Rigil Kentaurus', 'Toliman']);
