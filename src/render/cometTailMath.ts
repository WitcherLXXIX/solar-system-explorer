import { length, scale, smoothstep, type Vec3 } from '../math';
import { AU_M } from '../units';

/**
 * Reference maths for the comet tail. The tail is a stylised effect, NOT a physical dust or ion tail simulation: it always
 * points away from the Sun (solar wind and radiation pressure push the coma outward, so the tail does not follow the comet's
 * direction of travel), and its length and brightness follow a heuristic falloff with distance from the Sun. The fragment
 * shader in cometTail.ts interpolates the constants below and mirrors `tailAlpha` and `tailColor`.
 */

/** Full strength inside this heliocentric distance (AU), fading to nothing at TAIL_GONE_AU. Chosen for appearance. */
export const TAIL_FULL_AU = 1;
export const TAIL_GONE_AU = 4;
/** Tail length at full strength, in AU. */
export const TAIL_MAX_LENGTH_AU = 0.3;
/** Tail half-width as a fraction of its length at the nucleus and at the far end. */
export const TAIL_WIDTH_NEAR = 0.02;
export const TAIL_WIDTH_FAR = 0.16;
/** Brightness falls as (1 - along) ^ TAIL_FADE_POWER along the tail and as (1 - |across|) ^ TAIL_EDGE_POWER across it. */
export const TAIL_FADE_POWER = 1.6;
export const TAIL_EDGE_POWER = 2;
/** Peak opacity of the additive tail, before the distance and zoom factors. */
export const TAIL_PEAK_ALPHA = 0.55;
/** Linear RGB: warm dust colour at the nucleus, blue ion colour at the far end. */
export const TAIL_COLOR_DUST: readonly [number, number, number] = [1.0, 0.93, 0.78];
export const TAIL_COLOR_ION: readonly [number, number, number] = [0.55, 0.75, 1.0];
/** The tail is hidden when it would be shorter than TAIL_HIDE_PX on screen and full strength above TAIL_FULL_PX. */
export const TAIL_HIDE_PX = 2;
export const TAIL_FULL_PX = 8;

/** Unit vector along the tail: the Sun-to-comet direction (any consistent frame). Throws for a zero vector. */
export function tailDirection(sunToComet: Vec3): Vec3 {
  const len = length(sunToComet);
  if (len === 0) throw new Error('the comet is at the Sun: no tail direction');
  return scale(sunToComet, 1 / len);
}

/** Tail strength 0..1 from the comet's distance from the Sun in AU: 1 inside TAIL_FULL_AU, 0 beyond TAIL_GONE_AU. */
export function tailActivity(sunDistanceAu: number): number {
  return 1 - smoothstep(TAIL_FULL_AU, TAIL_GONE_AU, sunDistanceAu);
}

/** Tail length in metres for a given activity. */
export function tailLengthM(activity: number): number {
  return activity * TAIL_MAX_LENGTH_AU * AU_M;
}

/** Fade 0..1 for a tail whose length on screen is `lengthPx`: hidden when tiny (too far away to read), full once it is 8 px or more. */
export function tailZoomFade(lengthPx: number): number {
  return smoothstep(TAIL_HIDE_PX, TAIL_FULL_PX, lengthPx);
}

/** Opacity at a point of the tail: `along` 0 (nucleus) to 1 (far end), `across` -1 to 1, `brightness` the combined activity and zoom factor. */
export function tailAlpha(along: number, across: number, brightness: number): number {
  if (along < 0 || along > 1 || Math.abs(across) > 1) return 0;
  return brightness * TAIL_PEAK_ALPHA * (1 - along) ** TAIL_FADE_POWER * (1 - Math.abs(across)) ** TAIL_EDGE_POWER;
}

/** Colour (linear RGB) at `along`: dust to ion. */
export function tailColor(along: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, along));
  return [0, 1, 2].map((k) => TAIL_COLOR_DUST[k]! + (TAIL_COLOR_ION[k]! - TAIL_COLOR_DUST[k]!) * t) as [number, number, number];
}
