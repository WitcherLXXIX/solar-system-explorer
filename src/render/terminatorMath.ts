import { glslFloat } from './glsl';

/**
 * Half-width of the soft terminator in N.L (cosine of the Sun angle). Hard Lambert `max(N.L, 0)` has a slope discontinuity
 * at N.L = 0 that reads as a visible seam on every planet; a real terminator is soft because the Sun is a disc and surfaces
 * are rough. Interpolated into the GLSL below (tests/render/shaderConstants.test.ts checks it).
 */
export const TERMINATOR_WRAP = 0.1;

/**
 * Soft Lambert: N.L for N.L >= wrap, 0 for N.L <= -wrap, and a quadratic ramp (x + w)^2 / (4 w) between, which joins both
 * sides with matching value and slope. Never darker than Lambert, at most wrap/4 brighter (at the terminator).
 */
export function softLambert(ndl: number, wrap = TERMINATOR_WRAP): number {
  if (ndl >= wrap) return ndl;
  if (ndl <= -wrap) return 0;
  return ((ndl + wrap) * (ndl + wrap)) / (4 * wrap);
}

/** GLSL twin of softLambert; included by the surface and cloud fragment shaders. */
export const SOFT_LAMBERT_GLSL = /* glsl */ `
float softLambert(float x) {
  const float w = ${glslFloat(TERMINATOR_WRAP)};
  return x >= w ? x : (x <= -w ? 0.0 : (x + w) * (x + w) / (4.0 * w));
}
`;
