import { smoothstep } from '../math';

/**
 * Reference maths for Earth's extra shading (the GLSL in surfaceMaterial.ts mirrors these functions and thresholds).
 * Colours are linear-light RGB in 0..1.
 */

// Every number below is also interpolated into the GLSL in surfaceMaterial.ts (tests/render/shaderConstants.test.ts checks it).
/** The night-light terminator: fully night at NIGHT_EDGE_LO, fully day at NIGHT_EDGE_HI (cosines of the Sun angle). */
export const NIGHT_EDGE_LO = -0.08;
export const NIGHT_EDGE_HI = 0.12;
/** Full cloud cover removes this fraction of the night lights. */
export const CLOUD_NIGHT_DIMMING = 0.85;
/** Water mask: blue excess over red and green ramps in over [WATER_BLUE_LO, WATER_BLUE_HI]; luminance ramps it out over [WATER_LUMINANCE_LO, WATER_LUMINANCE_HI]. */
export const WATER_BLUE_LO = 0.01;
export const WATER_BLUE_HI = 0.06;
export const WATER_LUMINANCE_LO = 0.5;
export const WATER_LUMINANCE_HI = 0.8;
/** Schlick reflectance at normal incidence, and the exponent of the grazing-angle rise. */
export const FRESNEL_F0 = 0.02;
export const FRESNEL_EXPONENT = 5;

/** 1 on the night side, 0 by day, easing across a soft terminator: `ndl` is the cosine of the Sun's angle to the surface normal. */
export function nightFactor(ndl: number): number {
  return 1 - smoothstep(NIGHT_EDGE_LO, NIGHT_EDGE_HI, ndl);
}

/** Night-light strength: the terminator factor, dimmed by cloud cover (0..1). */
export function nightLightFactor(ndl: number, cloud: number): number {
  return nightFactor(ndl) * (1 - CLOUD_NIGHT_DIMMING * cloud);
}

/** Ocean mask derived from the day map: strongly blue and not bright (so ice and cloud are excluded). */
export function waterMask(r: number, g: number, b: number): number {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return smoothstep(WATER_BLUE_LO, WATER_BLUE_HI, b - Math.max(r, g)) * (1 - smoothstep(WATER_LUMINANCE_LO, WATER_LUMINANCE_HI, luminance));
}

/** Schlick reflectance of water: about 2% looking straight down, rising to 1 at grazing view angles. `ndv` is N.V. */
export function fresnel(ndv: number): number {
  return FRESNEL_F0 + (1 - FRESNEL_F0) * Math.pow(1 - Math.max(ndv, 0), FRESNEL_EXPONENT);
}

/**
 * Blinn-Phong sun glint on water, scaled by Fresnel reflectance: `ndh` is N.H (H the Sun-camera half vector), `ndl` is N.L,
 * `cloud` is cloud cover 0..1 and `ndv` is N.V (the camera's view of the surface).
 */
export function glintIntensity(
  ndh: number, shininess: number, ndl: number, strength: number, water: number, cloud: number, ndv: number,
): number {
  if (ndl <= 0) return 0;
  return strength * Math.pow(Math.max(ndh, 0), shininess) * water * fresnel(ndv) * (1 - cloud);
}
