import { dot, scale, smoothstep, sub, type Vec3 } from '../math';

/**
 * Reference maths for body-on-body shadows (the GLSL in bodyShadows.ts mirrors shadowLit). Positions are in RECEIVER radii
 * with the receiver's centre at the origin, so a sphere's surface is |p| = 1.
 */

/** At most this many occluders are passed to the surface shader per body per frame (bodyShadows.ts sizes its uniform arrays with it). */
export const MAX_OCCLUDERS = 4;
/** Smallest penumbra half-width (receiver radii); keeps the smoothstep edges apart for a degenerate Sun. */
export const MIN_SHADOW_WIDTH = 1e-4;

/** A sphere that may shadow the receiver: centre and radius in receiver radii. */
export interface Occluder {
  position: Vec3;
  radius: number;
}

/**
 * Fraction of sunlight reaching point `p` past one spherical occluder (1 = unshadowed). `sunDir` is the unit direction from
 * the receiver toward the Sun; `tanSun` is the Sun's angular radius as a tangent (Sun radius / Sun distance), which sets the
 * penumbra width w = t * tanSun at distance t from the point. Umbra inside |r - w|, smooth edge out to r + w; an occluder
 * smaller than the Sun's disc there (r < w) only reaches darkness (r / w)^2.
 */
export function shadowLit(p: Vec3, sunDir: Vec3, occluder: Occluder, tanSun: number): number {
  const toCentre = sub(occluder.position, p);
  const t = dot(toCentre, sunDir);
  if (t <= 0) return 1; // the occluder is not between this point and the Sun
  const perp = sub(toCentre, scale(sunDir, t));
  const d = Math.hypot(perp[0], perp[1], perp[2]);
  const r = occluder.radius;
  const w = Math.max(t * tanSun, MIN_SHADOW_WIDTH);
  const depth = Math.min(1, (r * r) / (w * w));
  const covered = 1 - smoothstep(Math.abs(r - w), r + w, d);
  return 1 - depth * covered;
}

/** Product of the individual factors (1 for no occluders). */
export function combinedShadow(p: Vec3, sunDir: Vec3, occluders: readonly Occluder[], tanSun: number): number {
  let lit = 1;
  for (const o of occluders) lit *= shadowLit(p, sunDir, o, tanSun);
  return lit;
}

/**
 * The candidates that could shadow the receiver sphere (unit sphere at the origin): sunward of its centre, and the sun ray
 * through the centre passes within 1 + r + w of the occluder's centre. Ordered by how squarely they cover it (smallest
 * d - r - w first) and cut to `max`.
 */
export function selectOccluders(
  candidates: readonly Occluder[], sunDir: Vec3, tanSun: number, max = MAX_OCCLUDERS,
): Occluder[] {
  const scored: { occluder: Occluder; score: number }[] = [];
  for (const occluder of candidates) {
    const t = dot(occluder.position, sunDir);
    if (t <= 0) continue;
    const perp = sub(occluder.position, scale(sunDir, t));
    const d = Math.hypot(perp[0], perp[1], perp[2]);
    const w = Math.max(t * tanSun, MIN_SHADOW_WIDTH);
    if (d >= 1 + occluder.radius + w) continue;
    scored.push({ occluder, score: d - occluder.radius - w });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, max).map((s) => s.occluder);
}
