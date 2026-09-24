import { describe, expect, it } from 'vitest';
import { TAIL_FRAG, TAIL_VERT } from '../../src/render/cometTail';
import {
  TAIL_COLOR_DUST, TAIL_COLOR_ION, TAIL_EDGE_POWER, TAIL_FADE_POWER, TAIL_PEAK_ALPHA, TAIL_WIDTH_FAR, TAIL_WIDTH_NEAR,
} from '../../src/render/cometTailMath';

/** Pulls the numbers out of a GLSL expression with a regular expression and fails loudly if the expression is gone. */
function grab(source: string, pattern: RegExp): number[] {
  const m = pattern.exec(source);
  if (!m) throw new Error(`shader no longer contains ${pattern}`);
  return m.slice(1).map(Number);
}

describe('tail shader constants mirror cometTailMath', () => {
  it('tail width grows from the near to the far value along the tail', () => {
    expect(grab(TAIL_VERT, /mix\(([-\d.e]+), ([-\d.e]+), corner\.y\)/)).toEqual([TAIL_WIDTH_NEAR, TAIL_WIDTH_FAR]);
  });
  it('alpha is brightness x peak x (1 - along)^fade x (1 - |across|)^edge', () => {
    expect(grab(TAIL_FRAG, /uBrightness \* ([\d.e-]+) \* pow\(1\.0 - along, ([\d.e-]+)\) \* pow\(1\.0 - across, ([\d.e-]+)\)/))
      .toEqual([TAIL_PEAK_ALPHA, TAIL_FADE_POWER, TAIL_EDGE_POWER]);
  });
  it('colour runs from the dust to the ion colour', () => {
    expect(grab(TAIL_FRAG, /mix\(vec3\(([\d.]+), ([\d.]+), ([\d.]+)\), vec3\(([\d.]+), ([\d.]+), ([\d.]+)\), along\)/))
      .toEqual([...TAIL_COLOR_DUST, ...TAIL_COLOR_ION]);
  });
});

describe('tail shader follows the custom-shader rules', () => {
  it('vertex stage: common, log-depth parameters, and the log-depth write after gl_Position', () => {
    expect(TAIL_VERT).toContain('#include <common>');
    expect(TAIL_VERT).toContain('#include <logdepthbuf_pars_vertex>');
    expect(TAIL_VERT.indexOf('#include <logdepthbuf_vertex>')).toBeGreaterThan(TAIL_VERT.indexOf('gl_Position'));
  });
  it('fragment stage: common, log-depth, and the colour-space conversion as the LAST include', () => {
    expect(TAIL_FRAG).toContain('#include <common>');
    expect(TAIL_FRAG).toContain('#include <logdepthbuf_pars_fragment>');
    expect(TAIL_FRAG).toContain('#include <logdepthbuf_fragment>');
    expect(TAIL_FRAG.lastIndexOf('#include')).toBe(TAIL_FRAG.indexOf('#include <colorspace_fragment>'));
  });
  it('samples no texture and never discards (nothing to order)', () => {
    expect(TAIL_FRAG).not.toMatch(/texture2D|texture\(/);
    expect(TAIL_FRAG).not.toContain('discard');
  });
});
