import { clamp, dot, length, sub, type Vec3 } from '../math';
import { SPRITE_THRESHOLD_PX } from './cameraRelative';

/** Below this apparent diameter a body is at its faintest sprite (Neptune from Earth is about 0.01 px). */
export const SPRITE_FAINTEST_PX = 0.01;
/** Nominal sprite size in CSS px at the faintest and at the sphere/sprite switch. The dot texture fades to 0 at its edge, so a
 * 5 px sprite reads as roughly the 3 px disc the sphere becomes: no size pop at the threshold. */
export const SPRITE_MIN_SIZE_PX = 4;
export const SPRITE_MAX_SIZE_PX = 5;
const OPACITY_FAINTEST = 0.7;
/** Illumination scales opacity between this and 1 (a new phase is dimmed, never invisible). */
const ILLUMINATION_FLOOR = 0.7;
/** The Sun's dot is the switch size (5 px) up close and grows to 7 px when far away, so it stays a bright anchor. */
const STAR_EXTRA_SIZE_PX = 2;

/** Fraction of the body's disc that is lit as seen from the camera: (1 + cos(phase angle)) / 2. */
export function illuminationFraction(bodyPos: Vec3, sunPos: Vec3, cameraPos: Vec3): number {
  const toSun = sub(sunPos, bodyPos);
  const toCamera = sub(cameraPos, bodyPos);
  const denom = length(toSun) * length(toCamera);
  if (denom === 0) return 1;
  return (1 + clamp(dot(toSun, toCamera) / denom, -1, 1)) / 2;
}

/**
 * Point-sprite appearance for a body smaller than SPRITE_THRESHOLD_PX. `t` is apparent size on a log scale, from 0 at
 * SPRITE_FAINTEST_PX to 1 at the switch. Size and opacity both grow with t, so far planets differ and the sprite hands
 * over to the sphere without a jump. Planets are also dimmed by phase (illumination 0..1); stars ignore it and stay opaque.
 */
export function spriteAppearance(
  screenDiameterPx: number,
  illumination: number,
  isStar: boolean,
): { sizePx: number; opacity: number } {
  const t = clamp(
    Math.log(Math.max(screenDiameterPx, 1e-12) / SPRITE_FAINTEST_PX) / Math.log(SPRITE_THRESHOLD_PX / SPRITE_FAINTEST_PX),
    0, 1,
  );
  const sizePx = SPRITE_MIN_SIZE_PX + (SPRITE_MAX_SIZE_PX - SPRITE_MIN_SIZE_PX) * t;
  if (isStar) return { sizePx: SPRITE_MAX_SIZE_PX + STAR_EXTRA_SIZE_PX * (1 - t), opacity: 1 };
  const brightness = OPACITY_FAINTEST + (1 - OPACITY_FAINTEST) * t;
  const phase = ILLUMINATION_FLOOR + (1 - ILLUMINATION_FLOOR) * clamp(illumination, 0, 1);
  return { sizePx, opacity: brightness * phase };
}
