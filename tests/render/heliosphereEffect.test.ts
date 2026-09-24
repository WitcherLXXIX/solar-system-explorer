import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HeliosphereEffect } from '../../src/render/heliosphere';
import { HELIO_BOUND_AU } from '../../src/render/heliosphereMath';
import { AU_M } from '../../src/units';

describe('HeliosphereEffect', () => {
  it('is hidden at zero opacity (planet scale, inside the bubble) and costs nothing', () => {
    const effect = new HeliosphereEffect();
    effect.update([0, 0, -1.5e11], 0, 1);
    expect(effect.shown).toBe(false);
    effect.update([0, 0, -1.5e11], 0.0005, 1);
    expect(effect.shown).toBe(false);
  });
  it('draws the shell from outside as a front-face mesh centred on the Sun, and tells the shader where the camera is in AU', () => {
    const effect = new HeliosphereEffect();
    const sunRel: [number, number, number] = [0, 0, -2e14]; // the Sun 2e14 m (1,337 AU) ahead of the camera
    effect.update(sunRel, 0.9, 1e7);
    expect(effect.shown).toBe(true);
    expect(effect.material.side).toBe(THREE.FrontSide);
    const u = effect.material.uniforms;
    const cam = u.uCamAu!.value as THREE.Vector3;
    expect(cam.z).toBeCloseTo(2e14 / AU_M, 3); // the camera relative to the Sun is minus the Sun relative to the camera
    expect(cam.x).toBeCloseTo(0, 9);
    expect(u.uOpacity!.value).toBeCloseTo(0.9, 12);
    const mesh = effect.objects[0] as THREE.Mesh;
    expect(mesh.position.z).toBe(-2e14);
    expect(mesh.scale.x).toBeGreaterThan(HELIO_BOUND_AU * AU_M); // overscanned so the polygon edge never clips the analytic shell
    expect(mesh.scale.x).toBeLessThan(1.1 * HELIO_BOUND_AU * AU_M);
  });
  it('switches to the back-face sky pass when the camera is inside the mesh', () => {
    const effect = new HeliosphereEffect();
    effect.update([1e13, 0, 0], 0.9, 1e7); // the Sun 67 AU away: the camera is inside the shells
    expect(effect.material.side).toBe(THREE.BackSide);
    effect.update([0, 0, -2e14], 0.9, 1e7);
    expect(effect.material.side).toBe(THREE.FrontSide);
  });
  it('is drawn behind the belts and sprites, never writes depth, and blends premultiplied', () => {
    const effect = new HeliosphereEffect();
    const mesh = effect.objects[0] as THREE.Mesh;
    expect(mesh.renderOrder).toBeLessThan(9);
    expect(effect.material.depthWrite).toBe(false);
    expect(effect.material.transparent).toBe(true);
    expect(effect.material.blendSrc).toBe(THREE.OneFactor);
    expect(effect.material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });
});
