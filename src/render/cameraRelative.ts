import { clamp, smoothstep, sub, type Vec3 } from '../math';

/**
 * Bodies covering fewer pixels than this are drawn as a point sprite instead of a sphere.
 * Phase-4 "scale knob" (see nearPlane).
 */
export const SPRITE_THRESHOLD_PX = 3;

/** World frame (ecliptic, z north) to Three.js axes (y up). A proper rotation. */
export function eclipticToThree(v: Vec3): Vec3 {
  return [v[0], v[2], -v[1]];
}

/**
 * The precision trick: subtract in float64 first, so the large common offset cancels exactly,
 * then map axes. Only this small camera-relative vector is ever cast to float32 for the GPU.
 */
export function toRenderSpace(world: Vec3, camera: Vec3): Vec3 {
  return eclipticToThree(sub(world, camera));
}

export function apparentDiameterPx(radiusM: number, distanceM: number, fovYRad: number, viewportHeightPx: number): number {
  return (radiusM / (distanceM * Math.tan(fovYRad / 2))) * viewportHeightPx;
}

/**
 * Orbit lines are chords between samples, so near the body they visibly miss it.
 * Fade them out when the camera is within about 2% of the orbit radius of the body.
 */
export function orbitLineOpacity(distanceToBodyM: number, orbitRadiusM: number): number {
  return smoothstep(0.004, 0.02, distanceToBodyM / orbitRadiusM) * 0.55;
}

/**
 * Phase-4 "scale knob": the 1e7 m upper cap (with FAR_M, MAX_CAMERA_DISTANCE_M, MIN_ALTITUDE_FRACTION and SPRITE_THRESHOLD_PX).
 * It is kept low so that a zoomed-out camera passing through a body is not cut off by a huge near plane;
 * the logarithmic depth buffer (far 1e15 m) keeps depth precision fine at this ratio.
 */
export function nearPlane(altitudeM: number): number {
  return clamp(altitudeM * 0.05, 1, 1e7);
}
