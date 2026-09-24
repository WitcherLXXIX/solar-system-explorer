import { describe, expect, it } from 'vitest';
import { BACKGROUND_STARS, NOTABLE_STARS } from '../../src/catalog/skyStars';
import { length } from '../../src/math';
import { SKY_RADIUS_M } from '../../src/render/skyStarMath';
import { NOTABLE_SKY_POSITIONS, SKY_FRAG, SKY_STAR_COUNT, SKY_VERT } from '../../src/render/skyStarPoints';

describe('the sky layer data', () => {
  it('has every notable and background star', () => {
    expect(SKY_STAR_COUNT).toBe(NOTABLE_STARS.length + BACKGROUND_STARS.length);
    expect(SKY_STAR_COUNT).toBe(5070);
  });
  it('has one render position per notable star, all at the sky radius', () => {
    expect(NOTABLE_SKY_POSITIONS).toHaveLength(48);
    for (const p of NOTABLE_SKY_POSITIONS) expect(length(p) / SKY_RADIUS_M).toBeCloseTo(1, 9);
  });
});

describe('the sky shaders follow the custom-shader rules', () => {
  it('include the log-depth chunks and end with the colour-space conversion', () => {
    for (const chunk of ['logdepthbuf_pars_vertex', 'logdepthbuf_vertex']) expect(SKY_VERT).toContain(`<${chunk}>`);
    for (const chunk of ['logdepthbuf_pars_fragment', 'logdepthbuf_fragment', 'colorspace_fragment']) expect(SKY_FRAG).toContain(`<${chunk}>`);
    expect(SKY_FRAG.indexOf('<colorspace_fragment>')).toBeGreaterThan(SKY_FRAG.indexOf('<logdepthbuf_fragment>'));
  });
  it('samples no textures (so a discard cannot break derivatives)', () => {
    expect(SKY_FRAG).not.toMatch(/texture2D|texture\(/);
  });
});
