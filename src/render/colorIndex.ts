import { clamp, type Vec3 } from '../math';

/** Typical G/K-star colour index; docs/data/README.md fills missing values with it, and non-finite input falls back to it. */
export const DEFAULT_COLOR_INDEX = 0.6;
/** The range the Ballesteros fit is valid over (Ballesteros 2012, EPL 97, 34008). */
const BV_MIN = -0.4;
const BV_MAX = 2.0;

/** Effective black-body temperature (K) of a star from its B-V colour index (Ballesteros 2012). */
export function colorIndexToTemperatureK(bv: number): number {
  const b = clamp(bv, BV_MIN, BV_MAX);
  return 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
}

/**
 * sRGB colour (each channel 0..1) of a black body at `tK` kelvin: Tanner Helland's curve fit to CIE black-body colours,
 * valid 1000-40000 K. A real, computed approximation, not an invented palette.
 */
export function temperatureToSrgb(tK: number): Vec3 {
  const t = clamp(tK, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}

/** sRGB colour (0..1) of a star from its B-V colour index; a non-finite index is treated as DEFAULT_COLOR_INDEX. */
export function colorIndexToRGB(bv: number): Vec3 {
  return temperatureToSrgb(colorIndexToTemperatureK(Number.isFinite(bv) ? bv : DEFAULT_COLOR_INDEX));
}

/** sRGB transfer function, decoded: one 0..1 channel to linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** The colour as linear-light RGB, which is what a shader that ends in `<colorspace_fragment>` expects. */
export function colorIndexToLinearRGB(bv: number): Vec3 {
  const [r, g, b] = colorIndexToRGB(bv);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}
