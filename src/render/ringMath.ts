import { dot, smoothstep, type Vec3 } from '../math';

/**
 * Reference maths for ring lighting (the GLSL in surfaceMaterial.ts and rings.ts mirrors it). Positions are in body radii
 * in the body's local axes: the planet is a unit sphere at the origin, +Y is the pole, the ring plane is y = 0.
 * `sunLocal` is the unit direction toward the Sun in those axes.
 */

// Both numbers are also interpolated into the GLSL (rings.ts and surfaceMaterial.ts); tests/render/shaderConstants.test.ts checks it.
/** Half-width of the planet's shadow edge on the rings, in body radii. */
export const PLANET_SHADOW_PENUMBRA = 0.004;
/** How much of the sunlight a fully opaque ring blocks on the planet below it. */
export const RING_SHADOW_STRENGTH = 0.9;

/** Fraction of sunlight reaching `p` after the planet's shadow: 0 in the umbra, 1 outside, soft edge of half-width `penumbra`. */
export function planetShadowFactor(p: Vec3, sunLocal: Vec3, penumbra = PLANET_SHADOW_PENUMBRA): number {
  const b = dot(p, sunLocal);
  if (b >= 0) return 1; // the planet is not between this point and the Sun
  const dmin = Math.sqrt(Math.max(dot(p, p) - b * b, 0)); // closest approach of the sunward ray to the planet's centre
  return smoothstep(1 - penumbra, 1 + penumbra, dmin);
}

/** Radius (body radii) at which the ray from `surface` toward the Sun crosses the ring plane, or null if it never does. */
export function ringCrossingRadius(surface: Vec3, sunLocal: Vec3): number | null {
  if (Math.abs(sunLocal[1]) < 1e-4) return null;
  const s = -surface[1] / sunLocal[1];
  if (s <= 0) return null;
  return Math.hypot(surface[0] + sunLocal[0] * s, surface[2] + sunLocal[2] * s);
}

/** Position across the ring, 0 at the inner edge to 1 at the outer edge, or null outside it. */
export function ringRadialFraction(r: number, inner: number, outer: number): number | null {
  const u = (r - inner) / (outer - inner);
  return u > 0 && u < 1 ? u : null;
}

/** Fraction of sunlight that reaches a planet surface point after passing the ring (1 = unshadowed). */
export function ringShadowFactor(
  surface: Vec3, sunLocal: Vec3, inner: number, outer: number, alphaAt: (u: number) => number, strength = RING_SHADOW_STRENGTH,
): number {
  const r = ringCrossingRadius(surface, sunLocal);
  if (r === null) return 1;
  const u = ringRadialFraction(r, inner, outer);
  if (u === null) return 1;
  return 1 - strength * alphaAt(u);
}
