import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { BodyEffect, BodyRenderState } from './bodyView';
import { ATMOSPHERE_MIN_PX } from './lod';
import type { TextureManager } from './textureManager';
import { SOFT_LAMBERT_GLSL } from './terminatorMath';

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

export const CLOUD_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uClouds; // coverage in the red channel (linear)
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vNormalW;
${SOFT_LAMBERT_GLSL}
void main() {
  float cover = texture2D(uClouds, vUv).r;
  float ndl = softLambert(dot(normalize(vNormalW), uSunDir));
  gl_FragColor = vec4(vec3(ndl + 0.04 / PI), cover); // white cloud, same Lambert model as the surface
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** 256 segments keep the shell's sag under about 0.5 km, small next to its 9.6 km height. */
const cloudGeometry = new THREE.SphereGeometry(1, 256, 192);

export class CloudEffect implements BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    private readonly data: BodyData,
    private readonly textures: TextureManager,
  ) {
    if (!data.maps.clouds || data.cloudShellFraction === undefined) throw new Error(`${data.id} has no cloud layer`);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: { uClouds: { value: new THREE.Texture() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(cloudGeometry, this.material);
    this.mesh.scale.setScalar(data.radiusM * (1 + data.cloudShellFraction));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4; // after the surface, before the rings and the atmosphere
    this.objects = [this.mesh];
  }

  update(state: BodyRenderState): void {
    const texture = this.textures.get(this.data.id, 'clouds', this.data.maps.clouds!, state.hiRes);
    const visible = state.effectsEnabled && state.asSphere && texture !== null && state.screenDiameterPx >= ATMOSPHERE_MIN_PX;
    this.mesh.visible = visible;
    if (!visible || !texture) return;
    this.mesh.position.set(state.rel[0], state.rel[1], state.rel[2]);
    this.mesh.quaternion.copy(state.quaternion);
    this.material.uniforms.uClouds.value = texture;
    this.material.uniforms.uSunDir.value.copy(state.sunDir);
  }
}
