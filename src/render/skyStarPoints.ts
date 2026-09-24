import * as THREE from 'three';
import { BACKGROUND_STARS, NOTABLE_STARS } from '../catalog/skyStars';
import type { Vec3 } from '../math';
import { colorIndexToLinearRGB } from './colorIndex';
import { skyStarPositionThree, starOpacity, starSizePx } from './skyStarMath';

/** Render positions of the notable stars (Three.js axes, metres from the camera), in NOTABLE_STARS order: the label layer projects these. */
export const NOTABLE_SKY_POSITIONS: readonly Vec3[] = NOTABLE_STARS.map((s) => skyStarPositionThree(s.raHours, s.decDeg));

export const SKY_STAR_COUNT = NOTABLE_STARS.length + BACKGROUND_STARS.length;

export const SKY_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha * uOpacity;
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

// No texture is sampled, so the discard below cannot upset derivatives. aColor is linear light; <colorspace_fragment> encodes it.
export const SKY_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, r)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The night sky: the notable and background stars as ONE Points draw call. Positions are fixed directions at SKY_RADIUS_M in
 * camera-centred render space (the camera is the origin), so nothing is updated per frame except the opacity. Depth test on,
 * depth write off: real bodies (which write depth) hide the stars behind them; the atmosphere sky pass blends over them.
 */
export class SkyStarPoints {
  readonly points: THREE.Points;
  readonly count = SKY_STAR_COUNT;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    const positions = new Float32Array(3 * SKY_STAR_COUNT);
    const colors = new Float32Array(3 * SKY_STAR_COUNT);
    const sizes = new Float32Array(SKY_STAR_COUNT);
    const alphas = new Float32Array(SKY_STAR_COUNT);
    const put = (i: number, raHours: number, decDeg: number, mag: number, colorIndex: number): void => {
      const p = skyStarPositionThree(raHours, decDeg);
      positions.set(p, 3 * i);
      colors.set(colorIndexToLinearRGB(colorIndex), 3 * i);
      sizes[i] = starSizePx(mag);
      alphas[i] = starOpacity(mag);
    };
    NOTABLE_STARS.forEach((s, i) => put(i, s.raHours, s.decDeg, s.mag, s.colorIndex));
    BACKGROUND_STARS.forEach((s, i) => put(NOTABLE_STARS.length + i, s[0], s[1], s[2], s[3]));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0 } },
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1; // behind every effect (clouds 4, rings 5, atmosphere 6) and the belts and sprites
    this.points.visible = false;
  }

  get visible(): boolean {
    return this.points.visible;
  }

  /** Point sizes are in CSS pixels; the renderer's pixel ratio scales them to device pixels. */
  setPixelRatio(ratio: number): void {
    this.material.uniforms.uPixelRatio!.value = ratio;
  }

  /** At (nearly) zero opacity the layer is hidden and costs nothing. */
  update(opacity: number): void {
    this.points.visible = opacity > 0.001;
    this.material.uniforms.uOpacity!.value = opacity;
  }
}
