import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getBody } from '../../src/catalog/bodies';
import { CometTailEffect } from '../../src/render/cometTail';
import type { BodyRenderState } from '../../src/render/bodyView';
import { TAIL_MAX_LENGTH_AU } from '../../src/render/cometTailMath';
import { AU_M } from '../../src/units';

const halley = getBody('halley');

/** A tail-relevant state: the comet at (1e10, 0, 0) from the camera, the Sun in the -x direction. */
function state(over: Partial<BodyRenderState> = {}): BodyRenderState {
  return {
    data: halley, rel: [1e10, 0, 0], quaternion: new THREE.Quaternion(), sunDir: new THREE.Vector3(-1, 0, 0),
    camRelBody: new THREE.Vector3(), sunLocal: new THREE.Vector3(), camLocal: new THREE.Vector3(),
    screenDiameterPx: 1e-3, asSphere: false, effectsEnabled: true, hiRes: false, nearM: 1, sunDistanceM: 0.6 * AU_M, ...over,
  };
}

describe('CometTailEffect', () => {
  it('draws a full-length tail pointing away from the Sun when the comet is close to the Sun and readable', () => {
    const effect = new CometTailEffect(halley);
    effect.update(state());
    expect(effect.shown).toBe(true);
    const u = effect.material.uniforms;
    expect(u.uLength!.value).toBeCloseTo(TAIL_MAX_LENGTH_AU * AU_M, -3);
    expect(u.uBrightness!.value).toBeCloseTo(1, 12);
    const dir = u.uDir!.value as THREE.Vector3;
    expect(dir.x).toBeCloseTo(1, 12); // the Sun is at -x, so the tail streams toward +x
    expect(dir.length()).toBeCloseTo(1, 12);
    expect((u.uOrigin!.value as THREE.Vector3).x).toBe(1e10);
  });
  it('points along the Sun-to-comet line whatever way the comet is moving', () => {
    const effect = new CometTailEffect(halley);
    effect.update(state({ sunDir: new THREE.Vector3(0, 0.6, 0.8) }));
    const dir = effect.material.uniforms.uDir!.value as THREE.Vector3;
    expect(dir.y).toBeCloseTo(-0.6, 12);
    expect(dir.z).toBeCloseTo(-0.8, 12);
  });
  it('has no tail far from the Sun (Halley at 35 AU)', () => {
    const effect = new CometTailEffect(halley);
    effect.update(state({ sunDistanceM: 35 * AU_M }));
    expect(effect.shown).toBe(false);
  });
  it('fades with distance: half strength at 2.5 AU', () => {
    const effect = new CometTailEffect(halley);
    effect.update(state({ sunDistanceM: 2.5 * AU_M }));
    expect(effect.material.uniforms.uBrightness!.value).toBeCloseTo(0.5, 12);
  });
  it('hides when the tail would be too small to read on screen', () => {
    const effect = new CometTailEffect(halley);
    effect.update(state({ screenDiameterPx: 1e-12 }));
    expect(effect.shown).toBe(false);
  });
  it('hides when effects are switched off', () => {
    const effect = new CometTailEffect(halley);
    effect.update(state({ effectsEnabled: false }));
    expect(effect.shown).toBe(false);
  });
  it('hides instead of throwing when the comet is on the Sun (no direction)', () => {
    const effect = new CometTailEffect(halley);
    expect(() => effect.update(state({ sunDistanceM: 0, sunDir: new THREE.Vector3(0, 0, 0) }))).not.toThrow();
    expect(effect.shown).toBe(false);
  });
  it('comes back when the state allows it again', () => {
    const effect = new CometTailEffect(halley);
    effect.update(state({ effectsEnabled: false }));
    effect.update(state());
    expect(effect.shown).toBe(true);
  });
});
