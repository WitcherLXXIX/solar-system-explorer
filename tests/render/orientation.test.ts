import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { orientationToThree } from '../../src/render/orientation';
import type { Mat3 } from '../../src/math';

/** Applies the matrix to a sphere-local vector and compares component-wise (toEqual would distinguish -0). */
function expectMaps(m: THREE.Matrix4, local: [number, number, number], expected: [number, number, number]): void {
  const v = new THREE.Vector3(...local).applyMatrix4(m);
  expect(v.x).toBeCloseTo(expected[0], 12);
  expect(v.y).toBeCloseTo(expected[1], 12);
  expect(v.z).toBeCloseTo(expected[2], 12);
}

// Documented mapping: sphere-local +X = body x, +Y = body z (pole), +Z = body -y;
// then world (ecliptic) to Three axes (x, y, z) -> (x, z, -y).
describe('orientationToThree', () => {
  it('identity body axes: X->+X, pole->Three +Y, local +Z->Three +Z, proper rotation', () => {
    const identity: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const m = orientationToThree(identity);
    expectMaps(m, [1, 0, 0], [1, 0, 0]);
    expectMaps(m, [0, 1, 0], [0, 1, 0]);
    // body -y = ecliptic (0,-1,0) = Three (0,0,+1)
    expectMaps(m, [0, 0, 1], [0, 0, 1]);
    expect(m.determinant()).toBeCloseTo(1, 12);
  });

  it('body axes rotated 90 degrees about ecliptic z', () => {
    // body x = ecliptic +y, body y = ecliptic -x, body z = ecliptic +z (columns).
    const rotated: Mat3 = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
    const m = orientationToThree(rotated);
    // local +X = body x = ecliptic +y = Three -Z
    expectMaps(m, [1, 0, 0], [0, 0, -1]);
    // local +Y = body z = ecliptic north = Three +Y
    expectMaps(m, [0, 1, 0], [0, 1, 0]);
    // local +Z = body -y = ecliptic +x = Three +X
    expectMaps(m, [0, 0, 1], [1, 0, 0]);
    expect(m.determinant()).toBeCloseTo(1, 12);
  });

  it('a tilted pole stays a proper rotation and sends the pole to the mapped ecliptic axis', () => {
    const t = 23.44 * (Math.PI / 180);
    // rotation of the body frame about ecliptic x by the tilt: body z = (0, -sin t, cos t)
    const tilted: Mat3 = [[1, 0, 0], [0, Math.cos(t), Math.sin(t)], [0, -Math.sin(t), Math.cos(t)]];
    const m = orientationToThree(tilted);
    // pole in Three axes = (x, z, -y) of ecliptic (0, -sin t, cos t) = (0, cos t, sin t)
    expectMaps(m, [0, 1, 0], [0, Math.cos(t), Math.sin(t)]);
    expect(m.determinant()).toBeCloseTo(1, 12);
  });
});
