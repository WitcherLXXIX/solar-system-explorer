import { describe, expect, it } from 'vitest';
import { HELIO_FRAG } from '../../src/render/heliosphere';
import {
  HELIO_BOUND_AU, HELIO_STEPS, HELIO_TAU_PER_AU, HELIOPAUSE_AU, SHELL_SIGMA_AU, TERMINATION_SHOCK_AU,
} from '../../src/render/heliosphereMath';

/** Pulls the numbers out of a GLSL expression with a regular expression and fails loudly if the expression is gone. */
function grab(source: string, pattern: RegExp): number[] {
  const m = pattern.exec(source);
  if (!m) throw new Error(`shader no longer contains ${pattern}`);
  return m.slice(1).map(Number);
}

describe('heliosphere shader constants mirror heliosphereMath', () => {
  it('shell radii, in the order termination shock then heliopause', () => {
    expect(grab(HELIO_FRAG, /odTs \+= shell\(r, ([\d.]+)\)/)).toEqual([TERMINATION_SHOCK_AU]);
    expect(grab(HELIO_FRAG, /odHp \+= shell\(r, ([\d.]+)\)/)).toEqual([HELIOPAUSE_AU]);
  });
  it('shell width', () => {
    expect(grab(HELIO_FRAG, /float x = \(r - c\) \/ ([\d.]+);/)).toEqual([SHELL_SIGMA_AU]);
  });
  it('bounding radius and march steps', () => {
    expect(grab(HELIO_FRAG, /const float BOUND = ([\d.]+);/)).toEqual([HELIO_BOUND_AU]);
    expect(grab(HELIO_FRAG, /const int STEPS = (\d+);/)).toEqual([HELIO_STEPS]);
  });
  it('optical depth per AU', () => {
    expect(grab(HELIO_FRAG, /\(1\.0 - exp\(-od \* ([\d.e-]+)\)\) \* uOpacity/)).toEqual([HELIO_TAU_PER_AU]);
  });
});

describe('heliosphere shader follows the custom-shader rules', () => {
  it('fragment stage: common, log-depth, and the colour-space conversion as the LAST include', () => {
    expect(HELIO_FRAG).toContain('#include <common>');
    expect(HELIO_FRAG).toContain('#include <logdepthbuf_pars_fragment>');
    expect(HELIO_FRAG).toContain('#include <logdepthbuf_fragment>');
    expect(HELIO_FRAG.lastIndexOf('#include')).toBe(HELIO_FRAG.indexOf('#include <colorspace_fragment>'));
  });
  it('samples no texture (nothing to order before the discards)', () => {
    expect(HELIO_FRAG).not.toMatch(/texture2D|texture\(/);
  });
  it('forms the ray from the closest-approach point, never from dot(cam, cam) - R*R (float32 cancellation at 6e5 AU)', () => {
    expect(HELIO_FRAG).toContain('vec3 pc = uCamAu + d * tc;');
    expect(HELIO_FRAG).not.toMatch(/dot\(uCamAu, uCamAu\)/);
  });
});
