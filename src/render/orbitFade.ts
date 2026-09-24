import { AU_M } from '../units';
import { smoothstep } from '../math';
import { orbitLineOpacity } from './cameraRelative';
import type { TreeKind } from '../ui/bodyTree';

/** A moon's orbit line is fully visible within this many orbit radii of the parent, and gone beyond the second value. */
export const MOON_ORBIT_FULL_RADII = 15;
export const MOON_ORBIT_GONE_RADII = 60;
/** A moon's label is shown only while the camera is within this many orbit radii of its parent. */
export const MOON_LABEL_RADII = 25;

/**
 * Opacity of a moon's orbit line (0 to 0.55): the existing near rule (`orbitLineOpacity`, which hides the chord-y line
 * when the camera is right next to the moon) times a far fade that removes the line as the camera leaves the parent's neighbourhood.
 */
export function moonOrbitOpacity(cameraToParentM: number, cameraToMoonM: number, orbitRadiusM: number): number {
  const far = 1 - smoothstep(MOON_ORBIT_FULL_RADII, MOON_ORBIT_GONE_RADII, cameraToParentM / orbitRadiusM);
  return orbitLineOpacity(cameraToMoonM, orbitRadiusM) * far;
}

export function moonLabelVisible(cameraToParentM: number, orbitRadiusM: number): boolean {
  return cameraToParentM / orbitRadiusM < MOON_LABEL_RADII;
}

/** How long (ms) a sampled orbit line stays valid before it is resampled: ten orbital periods, but at least a day and at most ten Julian years. */
export function orbitStaleMs(periodDays: number): number {
  return Math.min(10 * 365.25 * 86_400_000, Math.max(86_400_000, 10 * periodDays * 86_400_000));
}

/** Declutter priority: bigger wins. Moons rank below every planet and dwarf planet; within a kind, bigger radius wins. */
export function labelPriority(kind: TreeKind, radiusM: number): number {
  return kind === 'moon' ? radiusM * 1e-3 : radiusM;
}

/** A body's dot as drawn: screen centre (CSS px) and drawn diameter (its disc, or its sprite when it is smaller). */
export interface DotOnScreen {
  x: number;
  y: number;
  drawnPx: number;
}

/** True when a moon's sprite would overlap its parent's dot or disc: the centres are closer than the sum of the radii. */
export function spriteHiddenByParent(moon: DotOnScreen, parent: DotOnScreen): boolean {
  return Math.hypot(moon.x - parent.x, moon.y - parent.y) < (moon.drawnPx + parent.drawnPx) / 2;
}

/** Belt points are invisible below this camera altitude above the focused body (planet scale) and reach full strength at BELT_FADE_HIGH_M. Tunable. */
export const BELT_FADE_LOW_M = 2e9;
export const BELT_FADE_HIGH_M = 2e10;
export const BELT_MAX_OPACITY = 0.8;

/** Opacity of both belts from the camera's altitude: gone at planet scale (a few far dots would only look like stars), full at system scale. */
export function beltOpacity(altitudeM: number): number {
  return BELT_MAX_OPACITY * smoothstep(BELT_FADE_LOW_M, BELT_FADE_HIGH_M, altitudeM);
}

/** A named small body's label is shown only while the camera is within this distance of it. */
export const SMALL_BODY_LABEL_RANGE_M = 5 * AU_M;

export function smallBodyLabelVisible(distanceM: number): boolean {
  return distanceM < SMALL_BODY_LABEL_RANGE_M;
}
