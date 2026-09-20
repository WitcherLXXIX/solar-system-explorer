import { dot, type Vec3 } from '../math';

/**
 * Reference maths for the atmosphere shader (the GLSL in atmosphere.ts mirrors these functions). All positions are in
 * body radii with the planet at the origin and radius 1; directions are unit vectors.
 */

/** Ray/sphere intersection for a sphere at the origin: entry and exit distances along the ray, or null on a miss. */
export function raySphere(origin: Vec3, dir: Vec3, radius: number): [number, number] | null {
  const b = dot(origin, dir);
  const c = dot(origin, origin) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

/** Relative density at altitude h (body radii) with e-folding height `scaleHeight`; 1 at and below the surface. */
export function density(h: number, scaleHeight: number): number {
  return Math.exp(-Math.max(h, 0) / scaleHeight);
}

/** Integral of density along a ray for `dist` (midpoint rule, `steps` samples): optical depth per unit scattering coefficient. */
export function opticalDepth(origin: Vec3, dir: Vec3, dist: number, scaleHeight: number, steps = 64): number {
  const dt = dist / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt;
    const h = Math.hypot(origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t) - 1;
    sum += density(h, scaleHeight) * dt;
  }
  return sum;
}

/**
 * The part of a view ray that lies in the atmosphere: from the shell entry (or the camera, if it is inside the shell)
 * to the shell exit or the planet surface, whichever comes first. Null if the ray misses the shell or the part is empty.
 */
export function viewSegment(camPos: Vec3, dir: Vec3, shellRadius: number): [number, number] | null {
  const shell = raySphere(camPos, dir, shellRadius);
  if (!shell) return null;
  const t0 = Math.max(shell[0], 0);
  let t1 = shell[1];
  const planet = raySphere(camPos, dir, 1);
  if (planet && planet[0] > 0) t1 = Math.min(t1, planet[0]);
  return t1 > t0 ? [t0, t1] : null;
}
