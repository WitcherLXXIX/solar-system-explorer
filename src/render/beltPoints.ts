import * as THREE from 'three';
import { propagateBelt, secondsSinceJ2000, type BeltField } from '../ephemeris/beltField';
import type { Vec3 } from '../math';
import { getDotTexture } from './dotTexture';

/**
 * One belt as a single `THREE.Points` draw call, however many points it has. Each frame the whole field is propagated on the
 * CPU (float64 Kepler, camera subtracted before the float32 cast) into one position buffer. Depth test on, depth write off,
 * like the body sprites; the stock PointsMaterial already supports the logarithmic depth buffer.
 */
export class BeltPoints {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly attribute: THREE.BufferAttribute;
  private readonly material: THREE.PointsMaterial;

  constructor(private readonly field: BeltField, color: string, sizePx: number) {
    this.positions = new Float32Array(3 * field.count);
    this.attribute = new THREE.BufferAttribute(this.positions, 3);
    this.attribute.setUsage(THREE.DynamicDrawUsage);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.attribute);
    this.material = new THREE.PointsMaterial({
      color, size: sizePx, sizeAttenuation: false, map: getDotTexture(),
      transparent: true, depthTest: true, depthWrite: false, alphaTest: 0.01, opacity: 0,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 9; // after the bodies, just below the body sprites (10)
    this.points.visible = false;
  }

  get count(): number {
    return this.field.count;
  }

  /** Propagates the field to `date` and sets its opacity; at (nearly) zero opacity the belt is hidden and costs nothing. */
  update(date: Date, cameraPos: Vec3, opacity: number): void {
    this.points.visible = opacity > 0.001;
    if (!this.points.visible) return;
    propagateBelt(this.field, secondsSinceJ2000(date), cameraPos, this.positions);
    this.attribute.needsUpdate = true;
    this.material.opacity = opacity;
  }
}
