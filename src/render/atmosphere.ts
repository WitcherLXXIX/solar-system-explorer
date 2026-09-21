import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { BodyEffect, BodyRenderState } from './bodyView';
import { useSkyPass } from './atmosphereMath';
import { ATMOSPHERE_MIN_PX } from './lod';

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vRayDir;
void main() {
  // The camera is the origin, so a vertex's world position is also the view ray direction.
  vRayDir = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

// Mirrors atmosphereMath.ts: raySphere, viewSegment, density, opticalDepth. Units are body radii (planet radius 1).
const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCamPos;     // camera relative to the body centre, in body radii
uniform vec3 uSunDir;     // unit, from the body toward the Sun
uniform vec3 uRayleigh;   // scattering coefficient per body radius, RGB
uniform float uMie;
uniform float uMieG;
uniform float uScaleH;
uniform float uMieScaleH;
uniform float uShell;     // shell radius in body radii
uniform float uIntensity;
uniform vec3 uTint;
varying vec3 vRayDir;

const int VIEW_STEPS = 12;
const int LIGHT_STEPS = 4;

vec2 raySphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1.0, -1.0);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}
bool hitsAhead(vec2 t) { return t.x > 0.0 && t.y > t.x; }
float dens(float h, float H) { return exp(-max(h, 0.0) / H); }

void main() {
  vec3 d = normalize(vRayDir);
  vec2 shell = raySphere(uCamPos, d, uShell);
  if (shell.y < shell.x || shell.y < 0.0) discard;
  vec2 planet = raySphere(uCamPos, d, 1.0);
  float t0 = max(shell.x, 0.0);
  float t1 = shell.y;
  if (hitsAhead(planet)) t1 = min(t1, planet.x);
  if (t1 <= t0) discard;

  float dt = (t1 - t0) / float(VIEW_STEPS);
  // Interleaved gradient noise jitters the sample positions per pixel (offset in [0,1) of a step, so t stays in [t0, t1]),
  // turning the 1/12th-step banding of the view integral into fine noise.
  float mu = dot(d, uSunDir);
  float g = uMieG;
  float phaseR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float phaseM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu))
               / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  float odR = 0.0;
  float odM = 0.0;
  for (int i = 0; i < VIEW_STEPS; i++) {
    vec3 p = uCamPos + d * (t0 + (float(i) + fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) * dt);
    float h = length(p) - 1.0;
    float dR = dens(h, uScaleH) * dt;
    float dM = dens(h, uMieScaleH) * dt;
    odR += dR;
    odM += dM;
    // Planet shadow, softened over 1.5% of the radius (SHADOW_EDGE in atmosphereMath.ts) to avoid a hard cut at the terminator.
    float sunB = dot(p, uSunDir);
    float lit = sunB < 0.0 ? smoothstep(0.985, 1.0, sqrt(max(dot(p, p) - sunB * sunB, 0.0))) : 1.0;
    if (lit <= 0.0) continue;
    float lt = raySphere(p, uSunDir, uShell).y;
    float ldt = lt / float(LIGHT_STEPS);
    float lodR = 0.0;
    float lodM = 0.0;
    for (int j = 0; j < LIGHT_STEPS; j++) {
      vec3 q = p + uSunDir * ((float(j) + 0.5) * ldt);
      float hq = length(q) - 1.0;
      lodR += dens(hq, uScaleH) * ldt;
      lodM += dens(hq, uMieScaleH) * ldt;
    }
    vec3 tau = uRayleigh * (odR + lodR) + vec3(uMie * 1.1) * (odM + lodM);
    vec3 att = exp(-tau);
    sumR += att * dR * lit;
    sumM += att * dM * lit;
  }
  vec3 color = (sumR * uRayleigh * phaseR + sumM * uMie * phaseM) * uIntensity * uTint;
  vec3 tauView = uRayleigh * odR + vec3(uMie * 1.1) * odM;
  float alpha = 1.0 - exp(-dot(tauView, vec3(1.0 / 3.0)));
  gl_FragColor = vec4(color, alpha); // premultiplied: the blend is ONE, ONE_MINUS_SRC_ALPHA
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** The mesh is larger than the analytic shell so its polygon edge can never clip the glow; the shader clips exactly. */
const SHELL_OVERSCAN = 1.02;
const shellGeometry = new THREE.SphereGeometry(1, 64, 48);

export class AtmosphereEffect implements BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly shellRadius: number;

  constructor(data: BodyData) {
    const spec = data.atmosphere;
    if (!spec) throw new Error(`${data.id} has no atmosphere`);
    this.shellRadius = 1 + spec.heightFraction;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uRayleigh: { value: new THREE.Vector3(...spec.rayleigh) },
        uMie: { value: spec.mie },
        uMieG: { value: spec.mieG },
        uScaleH: { value: spec.scaleHeightFraction },
        uMieScaleH: { value: spec.mieScaleHeightFraction },
        uShell: { value: this.shellRadius },
        uIntensity: { value: spec.intensity },
        uTint: { value: new THREE.Vector3(...spec.tint) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(shellGeometry, this.material);
    this.mesh.scale.setScalar(data.radiusM * this.shellRadius * SHELL_OVERSCAN);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6; // after the planet and the rings
    this.objects = [this.mesh];
  }

  update(state: BodyRenderState): void {
    const visible = state.effectsEnabled && state.asSphere && state.screenDiameterPx >= ATMOSPHERE_MIN_PX;
    this.mesh.visible = visible;
    if (!visible) return;
    this.mesh.position.set(state.rel[0], state.rel[1], state.rel[2]);
    const u = this.material.uniforms;
    u.uCamPos.value.copy(state.camRelBody);
    u.uSunDir.value.copy(state.sunDir);
    // From outside the mesh draw its front faces (haze in front of the disc); from inside it, or so close outside it
    // that the near plane would clip those faces, draw its back faces (sky). The test is against the overscanned mesh,
    // not the analytic shell: between the two radii the camera is already inside the mesh, where front faces are behind
    // it. In the sky pass the back faces lie beyond the planet, so the depth test would reject them; the shader clips
    // against the planet analytically, so it is switched off there.
    const insideMesh = useSkyPass(
      state.camRelBody.length(), this.shellRadius * SHELL_OVERSCAN, state.nearM / state.data.radiusM,
    );
    this.material.side = insideMesh ? THREE.BackSide : THREE.FrontSide;
    this.material.depthTest = !insideMesh;
  }
}
