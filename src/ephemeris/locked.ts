import { cross, length, scale, sub, type Mat3, type Vec3 } from '../math';

const unit = (v: Vec3): Vec3 => scale(v, 1 / length(v));

/**
 * Orientation of a tidally locked moon from its state relative to the parent (ecliptic frame): the prime meridian
 * (x) points at the parent, the north pole (z) is the orbit normal, y completes the right-handed set. The spin then makes
 * one turn per orbit in the sense of the orbit, exactly as a locked moon does. Libration is ignored.
 */
export function lockedOrientation(relPosition: Vec3, relVelocity: Vec3): Mat3 {
  const x = unit(scale(relPosition, -1));
  const z = unit(cross(relPosition, relVelocity));
  return [x, cross(z, x), z];
}

/** Axes of a body whose pole is unknown: the ecliptic north pole, spinning once per `rotationPeriodH` hours (negative: retrograde). */
export function assumedOrientation(rotationPeriodH: number, ttDays: number): Mat3 {
  const angle = (2 * Math.PI * ttDays * 24) / rotationPeriodH;
  return [[Math.cos(angle), Math.sin(angle), 0], [-Math.sin(angle), Math.cos(angle), 0], [0, 0, 1]];
}

/** Velocity (m/s) by central difference over 60 s of a position function of time offset in seconds. */
export function relativeVelocity(positionAt: (dtS: number) => Vec3): Vec3 {
  const h = 30;
  return scale(sub(positionAt(h), positionAt(-h)), 1 / (2 * h));
}
