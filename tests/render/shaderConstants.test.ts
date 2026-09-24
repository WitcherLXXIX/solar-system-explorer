import { describe, expect, it } from 'vitest';
import {
  CLOUD_NIGHT_DIMMING, FRESNEL_EXPONENT, FRESNEL_F0, NIGHT_EDGE_HI, NIGHT_EDGE_LO, WATER_BLUE_HI, WATER_BLUE_LO,
  WATER_LUMINANCE_HI, WATER_LUMINANCE_LO,
} from '../../src/render/earthMath';
import { MIE_EXTINCTION_FACTOR, SHADOW_EDGE } from '../../src/render/atmosphereMath';
import { ATMOSPHERE_FRAG } from '../../src/render/atmosphere';
import { PLANET_SHADOW_PENUMBRA, RING_SHADOW_STRENGTH } from '../../src/render/ringMath';
import { RING_FRAG } from '../../src/render/rings';
import { SURFACE_FRAG } from '../../src/render/surfaceMaterial';
import { CLOUD_FRAG } from '../../src/render/clouds';
import { SOFT_LAMBERT_GLSL } from '../../src/render/terminatorMath';

/** Pulls the numbers out of a GLSL expression with a regular expression and fails loudly if the expression is gone. */
function grab(source: string, pattern: RegExp): number[] {
  const m = pattern.exec(source);
  if (!m) throw new Error(`shader no longer contains ${pattern}`);
  return m.slice(1).map(Number);
}

describe('surface shader constants mirror earthMath and ringMath', () => {
  it('night-light terminator edges', () => {
    expect(grab(SURFACE_FRAG, /float night = 1\.0 - smoothstep\(([-\d.]+), ([-\d.]+), ndl\)/)).toEqual([NIGHT_EDGE_LO, NIGHT_EDGE_HI]);
  });
  it('cloud dimming of night lights', () => {
    expect(grab(SURFACE_FRAG, /night \* \(1\.0 - ([\d.]+) \* cloudCover\)/)).toEqual([CLOUD_NIGHT_DIMMING]);
  });
  it('water mask thresholds', () => {
    expect(grab(SURFACE_FRAG, /float water = smoothstep\(([\d.]+), ([\d.]+), albedo\.b - max\(albedo\.r, albedo\.g\)\)/)).toEqual([WATER_BLUE_LO, WATER_BLUE_HI]);
    expect(grab(SURFACE_FRAG, /\(1\.0 - smoothstep\(([\d.]+), ([\d.]+), lum\)\)/)).toEqual([WATER_LUMINANCE_LO, WATER_LUMINANCE_HI]);
  });
  it('Fresnel reflectance', () => {
    const [f0, rest, exponent] = grab(SURFACE_FRAG, /float fres = ([\d.]+) \+ ([\d.]+) \* pow\(1\.0 - max\(dot\(N, V\), 0\.0\), ([\d.]+)\)/);
    expect(f0).toBe(FRESNEL_F0);
    expect(f0! + rest!).toBeCloseTo(1, 12);
    expect(exponent).toBe(FRESNEL_EXPONENT);
  });
  it('ring shadow strength on the planet', () => {
    expect(grab(SURFACE_FRAG, /shadow = 1\.0 - ([\d.]+) \* textureLod/)).toEqual([RING_SHADOW_STRENGTH]);
  });
});

describe('ring shader constants mirror ringMath', () => {
  it('planet shadow penumbra', () => {
    expect(grab(RING_FRAG, /smoothstep\(1\.0 - ([\d.]+), 1\.0 \+ ([\d.]+), dmin\)/)).toEqual([PLANET_SHADOW_PENUMBRA, PLANET_SHADOW_PENUMBRA]);
  });
});

describe('atmosphere shader constants mirror atmosphereMath', () => {
  it('planet shadow edge', () => {
    expect(grab(ATMOSPHERE_FRAG, /smoothstep\(([\d.]+), 1\.0, sqrt\(max\(dot\(p, p\)/)).toEqual([SHADOW_EDGE]);
  });
  it('Mie extinction factor, in both the light and the view path', () => {
    const all = [...ATMOSPHERE_FRAG.matchAll(/vec3\(uMie \* ([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(all).toEqual([MIE_EXTINCTION_FACTOR, MIE_EXTINCTION_FACTOR]);
  });
});

describe('the soft terminator is used by the surface and cloud shaders', () => {
  it('the surface shader includes the softLambert function and calls it on N.L', () => {
    expect(SURFACE_FRAG).toContain(SOFT_LAMBERT_GLSL);
    expect(SURFACE_FRAG).toMatch(/float diffuse = softLambert\(ndl\)/);
    expect(SURFACE_FRAG).not.toMatch(/max\(ndl, 0\.0\) \* shadow/);
  });
  it('the cloud shader includes it too', () => {
    expect(CLOUD_FRAG).toContain(SOFT_LAMBERT_GLSL);
    expect(CLOUD_FRAG).toMatch(/softLambert\(dot\(normalize\(vNormalW\), uSunDir\)\)/);
  });
});
