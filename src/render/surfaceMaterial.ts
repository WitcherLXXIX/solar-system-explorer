import * as THREE from 'three';

let dummy: THREE.DataTexture | null = null;
/** A 1x1 white texture bound to every sampler that has no real map, so uniforms are always valid. */
export function dummyTexture(): THREE.DataTexture {
  if (!dummy) {
    dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    dummy.needsUpdate = true;
  }
  return dummy;
}

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosB;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vPosB = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uColor;
uniform sampler2D uNight;
uniform float uHasNight;
uniform sampler2D uClouds;
uniform float uHasClouds;
uniform vec3 uSunDir;     // unit, from the body toward the Sun, render axes
uniform vec3 uSunLocal;   // the same direction in the body's local axes (+Y = pole)
uniform float uUnlit;
uniform float uHasRing;
uniform float uRingInner; // ring radii in body radii
uniform float uRingOuter;
uniform sampler2D uRingAlpha;
uniform float uGlint;
uniform float uShine;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosB;
varying vec3 vPosW;

void main() {
  vec3 albedo = mix(uColor, texture2D(uMap, vUv).rgb, uHasMap);
  vec3 N = normalize(vNormalW);
  float ndl = dot(N, uSunDir);
  vec3 lit = albedo;
  if (uUnlit < 0.5) {
    // The rings shadow the planet: trace from this surface point toward the Sun to the equatorial plane (local y = 0).
    float shadow = 1.0;
    if (uHasRing > 0.5 && abs(uSunLocal.y) > 1e-4) {
      float s = -vPosB.y / uSunLocal.y;
      if (s > 0.0) {
        vec3 hit = vPosB + uSunLocal * s;
        float u = (length(hit.xz) - uRingInner) / (uRingOuter - uRingInner);
        if (u > 0.0 && u < 1.0) shadow = 1.0 - 0.9 * texture2D(uRingAlpha, vec2(u, 0.5)).a;
      }
    }
    float diffuse = max(ndl, 0.0) * shadow;
    lit = albedo * (diffuse + 0.04 / PI);
    // [T7] night lights and ocean glint are added here
  }
  gl_FragColor = vec4(lit, 1.0);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

export function createSurfaceMaterial(colorHex: string, unlit: boolean): THREE.ShaderMaterial {
  const white = dummyTexture();
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: white },
      uHasMap: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uNight: { value: white },
      uHasNight: { value: 0 },
      uClouds: { value: white },
      uHasClouds: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunLocal: { value: new THREE.Vector3(0, 1, 0) },
      uUnlit: { value: unlit ? 1 : 0 },
      uHasRing: { value: 0 },
      uRingInner: { value: 1 },
      uRingOuter: { value: 2 },
      uRingAlpha: { value: white },
      uGlint: { value: 0 },
      uShine: { value: 40 },
    },
  });
}
