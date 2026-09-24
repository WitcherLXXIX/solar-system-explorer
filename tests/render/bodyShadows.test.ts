import { describe, expect, it } from 'vitest';
import { BODIES, getBody, type BodyId } from '../../src/catalog/bodies';
import type { Vec3 } from '../../src/math';
import { MAX_OCCLUDERS } from '../../src/render/bodyShadowMath';
import { BODY_SHADOW_GLSL, SUN_RADIUS_M, casterEntries, shadowCasterIds } from '../../src/render/bodyShadows';

describe('shadowCasterIds', () => {
  it('lets a planet be shadowed by its moons only', () => {
    expect([...shadowCasterIds('earth')]).toEqual(['moon']);
    expect(shadowCasterIds('jupiter')).toEqual(expect.arrayContaining(['io', 'europa', 'ganymede', 'callisto']));
    expect(shadowCasterIds('mars')).toEqual(expect.arrayContaining(['phobos', 'deimos']));
  });
  it('lets a moon be shadowed by its planet and its siblings, never itself or the Sun', () => {
    const io = shadowCasterIds('io');
    expect(io).toContain('jupiter');
    expect(io).toContain('europa');
    expect(io).not.toContain('io');
    expect(io).not.toContain('sun');
    expect(shadowCasterIds('moon')).toEqual(['earth']);
  });
  it('gives a planet without moons, the Sun, small bodies and stars no casters', () => {
    expect(shadowCasterIds('mercury')).toEqual([]);
    expect(shadowCasterIds('sun')).toEqual([]);
    for (const b of BODIES) {
      if (b.kind === 'asteroid' || b.kind === 'comet' || b.kind === 'nearstar') expect(shadowCasterIds(b.id), b.id).toEqual([]);
    }
  });
  it('never lists a caster that is a star, small body or the receiver, for any body', () => {
    for (const b of BODIES) {
      for (const c of shadowCasterIds(b.id)) {
        expect(c, b.id).not.toBe(b.id);
        expect(['planet', 'moon', 'dwarf'], `${b.id} <- ${c}`).toContain(getBody(c).kind);
      }
    }
  });
});

describe('casterEntries', () => {
  it('returns each caster with its position and radius, skipping ids with no position', () => {
    const rels = new Map<BodyId, Vec3>([['moon', [1, 2, 3]]]);
    expect(casterEntries('earth', rels)).toEqual([{ rel: [1, 2, 3], radiusM: getBody('moon').radiusM }]);
    expect(casterEntries('earth', new Map())).toEqual([]);
    expect(casterEntries('mercury', rels)).toEqual([]);
  });
});

describe('constants', () => {
  it('SUN_RADIUS_M is the catalog Sun radius', () => {
    expect(SUN_RADIUS_M).toBe(getBody('sun').radiusM);
  });
  it('the GLSL sizes its arrays with MAX_OCCLUDERS and defines bodyShadowLit', () => {
    expect(BODY_SHADOW_GLSL).toContain(`uniform vec3 uOccPos[${MAX_OCCLUDERS}];`);
    expect(BODY_SHADOW_GLSL).toContain(`uniform float uOccRadius[${MAX_OCCLUDERS}];`);
    expect(BODY_SHADOW_GLSL).toContain('float bodyShadowLit(');
  });
});
