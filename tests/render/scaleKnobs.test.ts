import { describe, expect, it } from 'vitest';
import { MAX_CAMERA_DISTANCE_M } from '../../src/camera/cameraController';
import { FAR_M, nearPlane } from '../../src/render/cameraRelative';
import { LIGHT_YEAR_M } from '../../src/units';

/** 61 Cygni A, the farthest of the twelve stars, in metres from the Sun. */
const FARTHEST_STAR_M = 11.4039 * LIGHT_YEAR_M;

describe('the phase-4 scale knobs', () => {
  it('lets the camera reach past the nearest star (Proxima Centauri, 4.2465 ly = 4.02e16 m) to about 10.6 light-years', () => {
    expect(MAX_CAMERA_DISTANCE_M).toBe(1e17);
    expect(MAX_CAMERA_DISTANCE_M).toBeGreaterThan(4.2465 * LIGHT_YEAR_M);
    expect(MAX_CAMERA_DISTANCE_M / LIGHT_YEAR_M).toBeCloseTo(10.57, 2);
  });
  it('keeps the far plane beyond the farthest star as seen from the farthest camera position', () => {
    expect(FAR_M).toBe(1e18);
    expect(FAR_M).toBeGreaterThan(MAX_CAMERA_DISTANCE_M + FARTHEST_STAR_M); // 2.08e17
  });
  it('keeps the near-plane cap low (Ruling 1): a huge near plane would clip every nearer sprite', () => {
    expect(nearPlane(MAX_CAMERA_DISTANCE_M)).toBe(1e7);
    expect(nearPlane(1e15)).toBe(1e7);
  });
});
