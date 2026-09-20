import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { BodyEffect, BodyRenderState } from './bodyView';
import { buildRingProfile, RING_PROFILE_SAMPLES } from './ringProfile';
import type { TextureManager } from './textureManager';

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vPosL;
void main() {
  vPosL = position; // local position, outer radius 1, in the equatorial plane (y = 0)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

// Mirrors ringMath.ts: planetShadowFactor and the radial fraction.
const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uAlpha;     // radial strip: x runs inner to outer, RGB colour, A opacity
uniform float uInnerFrac;     // inner radius / outer radius
uniform float uOuterOverR;    // outer radius in body radii
uniform vec3 uTint;
uniform float uUseTint;       // 1 for procedural rings (flat tint), 0 to use the strip's own colour
uniform vec3 uSunLocal;       // unit, toward the Sun, body-local axes
uniform vec3 uCamLocal;       // camera relative to the body, body radii, body-local axes
varying vec3 vPosL;

void main() {
  float rNorm = length(vPosL.xz);
  float u = (rNorm - uInnerFrac) / (1.0 - uInnerFrac);
  if (u <= 0.0 || u >= 1.0) discard;
  vec4 tex = texture2D(uAlpha, vec2(u, 0.5));
  float alpha = tex.a;
  if (alpha < 0.003) discard;
  vec3 base = mix(tex.rgb, uTint, uUseTint);

  // The planet's shadow on this ring point (position in body radii).
  vec3 P = vPosL * uOuterOverR;
  float b = dot(P, uSunLocal);
  float dmin = sqrt(max(dot(P, P) - b * b, 0.0));
  float shadow = b < 0.0 ? smoothstep(1.0 - 0.004, 1.0 + 0.004, dmin) : 1.0;

  // Lit on the Sun side; from the far side only light transmitted through the ring shows.
  float lit = 0.35 + 0.65 * smoothstep(0.0, 0.4, abs(uSunLocal.y));
  float sameSide = (uSunLocal.y * uCamLocal.y) > 0.0 ? 1.0 : 0.0;
  float bright = mix(0.6 * (1.0 - alpha) * lit + 0.03, lit, sameSide);

  gl_FragColor = vec4(base * bright * shadow, alpha);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** A generated 2048 x 1 RGBA strip for a procedural ring: white colour, opacity from the band list. */
function createProfileTexture(data: BodyData): THREE.DataTexture {
  const ring = data.rings!;
  const profile = buildRingProfile(ring, RING_PROFILE_SAMPLES);
  const bytes = new Uint8Array(RING_PROFILE_SAMPLES * 4);
  for (let i = 0; i < RING_PROFILE_SAMPLES; i++) {
    bytes[4 * i] = 255;
    bytes[4 * i + 1] = 255;
    bytes[4 * i + 2] = 255;
    bytes[4 * i + 3] = Math.round(Math.min(1, profile[i]!) * 255);
  }
  const texture = new THREE.DataTexture(bytes, RING_PROFILE_SAMPLES, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  // Mipmaps average sub-pixel rings into a continuous faint line instead of pixel-centre dots.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export class RingEffect implements BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly procedural: THREE.DataTexture | null;

  constructor(
    private readonly data: BodyData,
    private readonly surface: THREE.ShaderMaterial,
    private readonly textures: TextureManager,
  ) {
    const ring = data.rings;
    if (!ring) throw new Error(`${data.id} has no rings`);
    const innerFrac = ring.innerM / ring.outerM;
    this.procedural = ring.alphaMap ? null : createProfileTexture(data);

    const geometry = new THREE.RingGeometry(innerFrac, 1, 256, 1);
    geometry.rotateX(-Math.PI / 2); // RingGeometry faces +Z; the ring must lie in the local equatorial plane (normal +Y)
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uAlpha: { value: this.procedural ?? new THREE.Texture() },
        uInnerFrac: { value: innerFrac },
        uOuterOverR: { value: ring.outerM / data.radiusM },
        uTint: { value: new THREE.Color(ring.tint) },
        uUseTint: { value: ring.alphaMap ? 0 : 1 },
        uSunLocal: { value: new THREE.Vector3(0, 1, 0) },
        uCamLocal: { value: new THREE.Vector3(0, 1, 0) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.scale.setScalar(ring.outerM);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5; // after the planet, before the atmosphere shell
    this.objects = [this.mesh];
  }

  update(state: BodyRenderState): void {
    const ring = this.data.rings!;
    const alphaTexture = this.procedural
      ?? this.textures.get(this.data.id, 'ring', { lo: ring.alphaMap! }, false);
    const ready = alphaTexture !== null;
    const active = state.effectsEnabled && state.asSphere && ready;
    const su = this.surface.uniforms;
    su.uHasRing.value = active ? 1 : 0;
    this.mesh.visible = active;
    if (!active || !alphaTexture) return;

    su.uRingInner.value = ring.innerM / this.data.radiusM;
    su.uRingOuter.value = ring.outerM / this.data.radiusM;
    su.uRingAlpha.value = alphaTexture;

    const u = this.material.uniforms;
    u.uAlpha.value = alphaTexture;
    u.uSunLocal.value.copy(state.sunLocal);
    u.uCamLocal.value.copy(state.camLocal);
    this.mesh.position.set(state.rel[0], state.rel[1], state.rel[2]);
    this.mesh.quaternion.copy(state.quaternion);
  }
}
