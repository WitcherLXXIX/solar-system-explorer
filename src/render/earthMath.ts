import { smoothstep } from '../math';

/**
 * Reference maths for Earth's extra shading (the GLSL in surfaceMaterial.ts mirrors these functions and thresholds).
 * Colours are linear-light RGB in 0..1.
 */

/** 1 on the night side, 0 by day, easing across a soft terminator: `ndl` is the cosine of the Sun's angle to the surface normal. */
export function nightFactor(ndl: number): number {
  return 1 - smoothstep(-0.08, 0.12, ndl);
}

/** Ocean mask derived from the day map: strongly blue and not bright (so ice and cloud are excluded). */
export function waterMask(r: number, g: number, b: number): number {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return smoothstep(0.01, 0.06, b - Math.max(r, g)) * (1 - smoothstep(0.5, 0.8, luminance));
}

/** Schlick reflectance of water: about 2% looking straight down, rising to 1 at grazing view angles. `ndv` is N.V. */
export function fresnel(ndv: number): number {
  return 0.02 + 0.98 * Math.pow(1 - Math.max(ndv, 0), 5);
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
