import * as THREE from 'three';
import type { Vec3 } from '../math';
import { AU_M } from '../units';
import { ATMOSPHERE_VERT } from './atmosphere';
import { useSkyPass } from './atmosphereMath';
import { glslFloat } from './glsl';
import {
  HELIO_BOUND_AU, HELIO_COLOR_HP, HELIO_COLOR_TS, HELIO_STEPS, HELIO_TAU_PER_AU, HELIOPAUSE_AU, SHELL_SIGMA_AU, TERMINATION_SHOCK_AU,
} from './heliosphereMath';

// Mirrors heliosphereMath.ts: shellDensity, shellDepths, heliosphereAlpha, terminationShare. Units are AU. The ray runs from
// the closest-approach point pc, so no float32 subtraction of two ~4e11 numbers is ever needed (the camera can be 6.7e5 AU out).
export const HELIO_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCamAu;      // camera relative to the Sun, in AU, render axes
uniform float uOpacity;
uniform vec3 uColorTs;
uniform vec3 uColorHp;
varying vec3 vRayDir;

const int STEPS = ${HELIO_STEPS};
const float BOUND = ${glslFloat(HELIO_BOUND_AU)};

float shell(float r, float c) {
  float x = (r - c) / ${glslFloat(SHELL_SIGMA_AU)};
  return exp(-0.5 * x * x);
}

void main() {
  vec3 d = normalize(vRayDir);
  float tc = -dot(uCamAu, d);
  vec3 pc = uCamAu + d * tc;
  float h2 = dot(pc, pc);
  if (h2 >= BOUND * BOUND) discard;
  float halfChord = sqrt(BOUND * BOUND - h2);
  float s0 = max(-halfChord, -tc);
  float s1 = halfChord;
  if (s1 <= s0) discard;
  float ds = (s1 - s0) / float(STEPS);
  float odTs = 0.0;
  float odHp = 0.0;
  for (int i = 0; i < STEPS; i++) {
    float r = length(pc + d * (s0 + (float(i) + 0.5) * ds));
    odTs += shell(r, ${glslFloat(TERMINATION_SHOCK_AU)}) * ds;
    odHp += shell(r, ${glslFloat(HELIOPAUSE_AU)}) * ds;
  }
  float od = odTs + odHp;
  float alpha = (1.0 - exp(-od * ${glslFloat(HELIO_TAU_PER_AU)})) * uOpacity;
  vec3 tint = mix(uColorHp, uColorTs, odTs / max(od, 1e-6));
  gl_FragColor = vec4(tint * alpha, alpha); // premultiplied: the blend is ONE, ONE_MINUS_SRC_ALPHA
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** The mesh is larger than the analytic bound so its polygon edge can never clip the glow; the shader clips exactly. */
const OVERSCAN = 1.02;
const MESH_RADIUS_M = HELIO_BOUND_AU * AU_M * OVERSCAN;
const geometry = new THREE.SphereGeometry(1, 64, 48);

/**
 * The schematic heliosphere: one Sun-centred mesh whose fragment shader ray-marches a termination-shock shell (94 AU) and a
 * heliopause shell (120 AU). Reuses the atmosphere's vertex shader, premultiplied blend and sky-pass rule. Nothing solid is there.
 */
export class HeliosphereEffect {
  readonly objects: readonly THREE.Object3D[];
  readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERT,
      fragmentShader: HELIO_FRAG,
      uniforms: {
        uCamAu: { value: new THREE.Vector3() },
        uOpacity: { value: 0 },
        uColorTs: { value: new THREE.Color(HELIO_COLOR_TS) },
        uColorHp: { value: new THREE.Color(HELIO_COLOR_HP) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.scale.setScalar(MESH_RADIUS_M);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5; // behind the atmospheres (6), comet tails (7), belts (9) and sprites (10)
    this.mesh.visible = false;
    this.objects = [this.mesh];
  }

  /** True when the shells were drawn in the last update. */
  get shown(): boolean {
    return this.mesh.visible;
  }

  /** `sunRel` is the Sun relative to the camera in Three.js axes (metres); at (nearly) zero opacity the mesh is hidden and costs nothing. */
  update(sunRel: Vec3, opacity: number, nearM: number): void {
    this.mesh.visible = opacity > 0.001;
    if (!this.mesh.visible) return;
    this.mesh.position.set(sunRel[0], sunRel[1], sunRel[2]);
    const u = this.material.uniforms;
    (u.uCamAu!.value as THREE.Vector3).set(-sunRel[0] / AU_M, -sunRel[1] / AU_M, -sunRel[2] / AU_M);
    u.uOpacity!.value = opacity;
    // Outside the mesh draw its front faces; inside it (or so close that the near plane would clip them) draw the back faces.
    // The shader works from the ray alone, so both give the same picture. The depth test stays on: planets are nearer than the shells.
    this.material.side = useSkyPass(Math.hypot(sunRel[0], sunRel[1], sunRel[2]), MESH_RADIUS_M, nearM) ? THREE.BackSide : THREE.FrontSide;
  }
}
