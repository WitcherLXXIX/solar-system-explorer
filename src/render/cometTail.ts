import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import { AU_M } from '../units';
import type { BodyEffect, BodyRenderState } from './bodyView';
import {
  TAIL_COLOR_DUST, TAIL_COLOR_ION, TAIL_EDGE_POWER, TAIL_FADE_POWER, TAIL_PEAK_ALPHA, TAIL_WIDTH_FAR, TAIL_WIDTH_NEAR,
  tailActivity, tailDirection, tailLengthM, tailZoomFade,
} from './cometTailMath';
import { glslFloat } from './glsl';

const vec3Literal = (c: readonly [number, number, number]): string => `vec3(${glslFloat(c[0])}, ${glslFloat(c[1])}, ${glslFloat(c[2])})`;

/**
 * The tail is a quad: `corner.x` runs across it (-1 to 1) and `corner.y` along it (0 at the nucleus, 1 at the far end).
 * `uOrigin` is the nucleus relative to the camera (the camera is the origin of the render space), `uDir` the unit vector away
 * from the Sun and `uLength` the length in metres, all computed in float64 on the CPU. The quad is widened along
 * cross(uDir, uOrigin), the direction perpendicular to both the tail and the line of sight, so it always faces the camera.
 * Mirrors cometTailMath.ts (width constants).
 */
export const TAIL_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uOrigin;
uniform vec3 uDir;
uniform float uLength;
attribute vec2 corner;
varying vec2 vTail;

void main() {
  vec3 side = cross(uDir, uOrigin);
  float sideLength = length(side);
  side = sideLength > 1e-6 * length(uOrigin) ? side / sideLength : vec3(1.0, 0.0, 0.0);
  float halfWidth = mix(${glslFloat(TAIL_WIDTH_NEAR)}, ${glslFloat(TAIL_WIDTH_FAR)}, corner.y) * uLength;
  vec3 p = uOrigin + uDir * (corner.y * uLength) + side * (corner.x * halfWidth);
  vTail = corner;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  #include <logdepthbuf_vertex>
}
`;

/** Mirrors cometTailMath.ts: `tailAlpha` (peak, fade power, edge power) and `tailColor` (dust to ion). */
export const TAIL_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uBrightness;
varying vec2 vTail;

void main() {
  float along = clamp(vTail.y, 0.0, 1.0);
  float across = clamp(abs(vTail.x), 0.0, 1.0);
  float alpha = uBrightness * ${glslFloat(TAIL_PEAK_ALPHA)} * pow(1.0 - along, ${glslFloat(TAIL_FADE_POWER)}) * pow(1.0 - across, ${glslFloat(TAIL_EDGE_POWER)});
  vec3 color = mix(${vec3Literal(TAIL_COLOR_DUST)}, ${vec3Literal(TAIL_COLOR_ION)}, along);
  gl_FragColor = vec4(color, alpha);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** A comet's tail: stretched, additively blended, always pointing away from the Sun. A stylised effect, not a physical simulation. */
export class CometTailEffect implements BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;

  constructor(data: BodyData) {
    if (data.kind !== 'comet') throw new Error(`${data.id} is not a comet`);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)); // unused; three counts vertices from it
    geometry.setAttribute('corner', new THREE.Float32BufferAttribute([-1, 0, 1, 0, -1, 1, 1, 1], 2));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.material = new THREE.ShaderMaterial({
      vertexShader: TAIL_VERT,
      fragmentShader: TAIL_FRAG,
      uniforms: {
        uOrigin: { value: new THREE.Vector3() },
        uDir: { value: new THREE.Vector3(1, 0, 0) },
        uLength: { value: 1 },
        uBrightness: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7; // after the atmospheres (6), before the belts and sprites
    this.mesh.visible = false;
    this.objects = [this.mesh];
  }

  /** True when the tail was drawn in the last update. */
  get shown(): boolean {
    return this.mesh.visible;
  }

  update(state: BodyRenderState): void {
    const activity = tailActivity(state.sunDistanceM / AU_M);
    const lengthM = tailLengthM(activity);
    // Pixels per metre at the comet: the nucleus's diameter in pixels over its diameter in metres.
    const lengthPx = lengthM * (state.screenDiameterPx / (2 * state.data.radiusM));
    const brightness = activity * tailZoomFade(lengthPx);
    const visible = state.effectsEnabled && state.sunDistanceM >= 1 && brightness > 0.001;
    this.mesh.visible = visible;
    if (!visible) return;
    const dir = tailDirection([-state.sunDir.x, -state.sunDir.y, -state.sunDir.z]);
    const u = this.material.uniforms;
    (u.uOrigin!.value as THREE.Vector3).set(state.rel[0], state.rel[1], state.rel[2]);
    (u.uDir!.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    u.uLength!.value = lengthM;
    u.uBrightness!.value = brightness;
  }
}
