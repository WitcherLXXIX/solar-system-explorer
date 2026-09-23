import * as THREE from 'three';
import type { BodyId } from '../catalog/bodies';
import { orbitalPeriodDays, sampleOrbit } from '../ephemeris/ephemeris';
import { sub, type Vec3 } from '../math';
import { orbitStaleMs } from './orbitFade';

const ORBIT_SAMPLES = 720;

/**
 * One body's orbit as a closed line around its PARENT (the Sun for planets and dwarf planets, the planet for a moon).
 * The orbit is sampled parent-relative in float64, lazily the first time the line is visible, and re-sampled when it goes
 * stale (ten orbital periods, at most ten years: mean elements precess). Each frame the vertices are
 * `sample + (parentPosition - cameraPosition)`, summed in float64 and only then cast to float32.
 */
export class OrbitLine {
  readonly line: THREE.LineLoop;
  private relative: Float64Array | null = null;
  private sampledAtMs = 0;
  private readonly staleMs: number;
  private readonly positions = new Float32Array(ORBIT_SAMPLES * 3);
  private readonly attribute = new THREE.BufferAttribute(this.positions, 3);

  constructor(private readonly id: BodyId, color: string) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.attribute);
    this.line = new THREE.LineLoop(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.line.frustumCulled = false;
    this.staleMs = orbitStaleMs(orbitalPeriodDays(id) ?? 365.25);
  }

  update(parentPos: Vec3, cameraPos: Vec3, date: Date, opacity: number): void {
    this.line.visible = opacity > 0.001;
    if (!this.line.visible) return; // nothing to draw: skip the sampling, the vertex loop and the buffer upload
    if (this.relative === null || Math.abs(date.getTime() - this.sampledAtMs) > this.staleMs) {
      this.relative = sampleOrbit(this.id, date, ORBIT_SAMPLES);
      this.sampledAtMs = date.getTime();
    }
    const offset = sub(parentPos, cameraPos); // float64: the large common part cancels here
    const samples = this.relative;
    // Same mapping as eclipticToThree, inlined for the hot loop: (x, y, z) -> (x, z, -y).
    for (let i = 0; i < ORBIT_SAMPLES; i++) {
      const b = 3 * i;
      this.positions[b] = samples[b]! + offset[0];
      this.positions[b + 1] = samples[b + 2]! + offset[2];
      this.positions[b + 2] = -(samples[b + 1]! + offset[1]);
    }
    this.attribute.needsUpdate = true;
    (this.line.material as THREE.LineBasicMaterial).opacity = opacity;
  }
}
