import * as THREE from 'three';
import type { BodyId } from '../catalog/bodies';
import { sampleOrbit } from '../ephemeris/ephemeris';
import type { Vec3 } from '../math';

const ORBIT_SAMPLES = 720;
const STALE_MS = 10 * 365.25 * 86_400_000; // orbits precess slowly; resample after ten years

export class OrbitLine {
  readonly line: THREE.LineLoop;
  private world: Float64Array;
  private sampledAtMs: number;
  private readonly positions = new Float32Array(ORBIT_SAMPLES * 3);
  private readonly attribute = new THREE.BufferAttribute(this.positions, 3);

  constructor(private readonly id: BodyId, color: string, date: Date) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.attribute);
    this.line = new THREE.LineLoop(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.line.frustumCulled = false;
    this.world = sampleOrbit(id, date, ORBIT_SAMPLES);
    this.sampledAtMs = date.getTime();
  }

  update(cameraPos: Vec3, date: Date, opacity: number): void {
    if (Math.abs(date.getTime() - this.sampledAtMs) > STALE_MS) {
      this.world = sampleOrbit(this.id, date, ORBIT_SAMPLES);
      this.sampledAtMs = date.getTime();
    }
    // Same mapping as eclipticToThree, inlined for the hot loop: subtract in float64, then cast.
    for (let i = 0; i < ORBIT_SAMPLES; i++) {
      const b = 3 * i;
      this.positions[b] = this.world[b]! - cameraPos[0];
      this.positions[b + 1] = this.world[b + 2]! - cameraPos[2];
      this.positions[b + 2] = -(this.world[b + 1]! - cameraPos[1]);
    }
    this.attribute.needsUpdate = true;
    this.line.visible = opacity > 0.001;
    (this.line.material as THREE.LineBasicMaterial).opacity = opacity;
  }
}
