import { dot, smoothstep, type Vec3 } from '../math';

/**
 * Reference maths for the heliosphere shader (the GLSL in heliosphere.ts mirrors these functions and interpolates these
 * constants). The heliosphere is a SCHEMATIC boundary: two spheres centred on the Sun, at the termination shock and the
 * heliopause, each a translucent Gaussian-thickness shell. Nothing solid is there, and the real bubble is asymmetric.
 * Every appearance number here (widths, opacity per AU, colours, fade altitudes) is a tuning choice, not a measurement.
 * Distances are in AU.
 */
export const TERMINATION_SHOCK_AU = 94;
export const HELIOPAUSE_AU = 120;
/** Gaussian width (standard deviation) of each shell. */
export const SHELL_SIGMA_AU = 4;
/** Nothing beyond this radius (four widths past the heliopause) contributes. */
export const HELIO_BOUND_AU = HELIOPAUSE_AU + 4 * SHELL_SIGMA_AU;
/** Ray-march steps across the bounding sphere: about one step per shell width at the widest chord, enough for a Gaussian. */
export const HELIO_STEPS = 64;
/** Optical depth per AU of accumulated shell density. */
export const HELIO_TAU_PER_AU = 0.01;
/** Tints (CSS hex) of the two shells: a violet-blue termination shock and a teal heliopause. */
export const HELIO_COLOR_TS = '#6aa8ff';
export const HELIO_COLOR_HP = '#7fe8d0';

/** Density of a shell of radius `centreAu` at distance `rAu` from the Sun: 1 on the shell, a Gaussian of width SHELL_SIGMA_AU around it. */
export function shellDensity(rAu: number, centreAu: number): number {
  const x = (rAu - centreAu) / SHELL_SIGMA_AU;
  return Math.exp(-0.5 * x * x);
}

/**
 * Integral of each shell's density along a ray (midpoint rule, `steps` samples), in AU. `camAu` is the camera relative to the
 * Sun, `dir` a unit vector. The march runs over the part of the ray inside HELIO_BOUND_AU, parametrised from the ray's closest
 * approach to the Sun (`pc`): a float32 GPU cannot form `dot(cam, cam) - R*R` for a camera 6e5 AU away, but it can form this.
 */
export function shellDepths(camAu: Vec3, dir: Vec3, steps: number = HELIO_STEPS): { ts: number; hp: number } {
  const tc = -dot(camAu, dir);
  const pc: Vec3 = [camAu[0] + dir[0] * tc, camAu[1] + dir[1] * tc, camAu[2] + dir[2] * tc];
  const h2 = dot(pc, pc);
  if (h2 >= HELIO_BOUND_AU * HELIO_BOUND_AU) return { ts: 0, hp: 0 };
  const half = Math.sqrt(HELIO_BOUND_AU * HELIO_BOUND_AU - h2);
  const s0 = Math.max(-half, -tc); // the ray starts at the camera when the camera is inside the bound
  const s1 = half;
  if (s1 <= s0) return { ts: 0, hp: 0 };
  const ds = (s1 - s0) / steps;
  let ts = 0;
  let hp = 0;
  for (let i = 0; i < steps; i++) {
    const s = s0 + (i + 0.5) * ds;
    const r = Math.hypot(pc[0] + dir[0] * s, pc[1] + dir[1] * s, pc[2] + dir[2] * s);
    ts += shellDensity(r, TERMINATION_SHOCK_AU) * ds;
    hp += shellDensity(r, HELIOPAUSE_AU) * ds;
  }
  return { ts, hp };
}

/** Opacity of a pixel from the two shell depths: 1 - exp(-tau) with tau = (ts + hp) x HELIO_TAU_PER_AU, times the fade `opacity`. Mirrors `alpha` in heliosphere.ts. */
export function heliosphereAlpha(ts: number, hp: number, opacity = 1): number {
  return (1 - Math.exp(-(ts + hp) * HELIO_TAU_PER_AU)) * opacity;
}

/** The termination shock's share (0 to 1) of the total depth, the mix weight between the two tints; 0 when there is no depth. Mirrors the `mix` in heliosphere.ts. */
export function terminationShare(ts: number, hp: number): number {
  const total = ts + hp;
  return total > 0 ? ts / total : 0;
}

/**
 * The shells are invisible (and the mesh is hidden) below this camera altitude above the focused body, about 100 AU: from
 * inside the bubble they would only haze the whole sky. Full strength from HELIO_FADE_HIGH_M (about 670 AU). Tunable.
 */
export const HELIO_FADE_LOW_M = 1.5e13;
export const HELIO_FADE_HIGH_M = 1e14;
export const HELIO_MAX_OPACITY = 0.9;

export function heliosphereOpacity(altitudeM: number): number {
  return HELIO_MAX_OPACITY * smoothstep(HELIO_FADE_LOW_M, HELIO_FADE_HIGH_M, altitudeM);
}
