import * as THREE from 'three';
import type { Mat3 } from '../math';
import { eclipticToThree } from './cameraRelative';

const scratch = new THREE.Matrix4();
const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();

/**
 * Sphere-mesh local axes: +X = body x (prime meridian), +Y = body z (north pole), +Z = body -y.
 * SphereGeometry puts longitude 0 on local +X and increases east toward local -Z, which matches this.
 * Each column is then mapped from the ecliptic frame to Three.js axes. The result is a proper rotation
 * (determinant +1). Returns `target`, or a shared scratch matrix if none is given: copy it if you keep it.
 */
export function orientationToThree(m: Mat3, target: THREE.Matrix4 = scratch): THREE.Matrix4 {
  const x = eclipticToThree(m[0]);
  const y = eclipticToThree(m[2]);
  const z = eclipticToThree(m[1]);
  bx.set(x[0], x[1], x[2]);
  by.set(y[0], y[1], y[2]);
  bz.set(-z[0], -z[1], -z[2]);
  return target.makeBasis(bx, by, bz);
}
