import { describe, expect, it } from 'vitest';
import {
  CameraController, DEFAULT_PITCH, FLIGHT_SECONDS, MAX_CAMERA_DISTANCE_M, MAX_PITCH,
  MIN_ALTITUDE_FRACTION, sunwardYaw, type FocusSource,
} from '../../src/camera/cameraController';
import type { BodyId } from '../../src/catalog/bodies';
import type { Vec3 } from '../../src/math';

const positions: Partial<Record<BodyId, Vec3>> = { sun: [0, 0, 0], earth: [1e11, 0, 0], neptune: [4.5e12, 0, 0] };
const radii: Partial<Record<BodyId, number>> = { sun: 6.957e8, earth: 6.371e6, neptune: 2.4622e7 };
const source: FocusSource = {
  position: (id) => positions[id] ?? [0, 0, 0],
  radius: (id) => radii[id] ?? 1e6,
};
const make = () => new CameraController(source, { focusId: 'earth', altitudeM: 1e7, yaw: 0, pitch: 0 });

describe('CameraController pose', () => {
  it('places the camera at focus + (altitude + radius) along the view direction', () => {
    const pose = make().update(0);
    expect(pose.focusId).toBe('earth');
    expect(pose.focusPoint).toEqual([1e11, 0, 0]);
    expect(pose.position[0]).toBeCloseTo(1e11 + 1e7 + 6.371e6, -1);
    expect(pose.position[1]).toBeCloseTo(0, 3);
    expect(pose.altitudeM).toBeCloseTo(1e7, -1);
  });
  it('follows a moving focus body', () => {
    const moving: FocusSource = { position: () => [5, 6, 7], radius: () => 1 };
    const c = new CameraController(moving, { focusId: 'earth', altitudeM: 10, yaw: 0, pitch: 0 });
    expect(c.update(0).focusPoint).toEqual([5, 6, 7]);
  });
});

describe('zoom and orbit', () => {
  it('zooms in log space', () => {
    const c = make();
    c.zoom(Math.LN2);
    expect(c.update(0).altitudeM / 1e7).toBeCloseTo(2, 9);
    c.zoom(-2 * Math.LN2);
    expect(c.update(0).altitudeM / 1e7).toBeCloseTo(0.5, 9);
  });
  it('clamps to 2% of the radius above the surface and to the maximum distance', () => {
    const c = make();
    c.zoom(-100);
    expect(c.update(0).altitudeM).toBeCloseTo(MIN_ALTITUDE_FRACTION * 6.371e6, 3);
    c.zoom(100);
    expect(c.update(0).altitudeM).toBeCloseTo(MAX_CAMERA_DISTANCE_M, -3);
  });
  it('clamps pitch and lets yaw wrap freely', () => {
    const c = make();
    c.orbit(10, 10);
    expect(c.pitch).toBeCloseTo(MAX_PITCH, 12);
    c.orbit(0, -20);
    expect(c.pitch).toBeCloseTo(-MAX_PITCH, 12);
    expect(c.yaw).toBeCloseTo(10, 12);
  });
});

describe('sunwardYaw', () => {
  it('points from the body back toward the origin', () => {
    expect(Math.cos(sunwardYaw([1e11, 0, 0]))).toBeCloseTo(-1, 12);
    expect(Math.sin(sunwardYaw([0, 1e11, 0]))).toBeCloseTo(-1, 12);
  });
});

describe('flyTo', () => {
  it('ignores the current focus and does nothing visible', () => {
    const c = make();
    c.flyTo('earth');
    expect(c.isFlying).toBe(false);
  });
  it('rises above both bodies mid-flight, then lands sunward of the target at 4 radii', () => {
    const c = make();
    c.flyTo('neptune');
    expect(c.isFlying).toBe(true);
    expect(c.displayId).toBe('neptune');
    const mid = c.update(FLIGHT_SECONDS / 2);
    expect(mid.altitudeM).toBeGreaterThan(1e12);
    expect(c.isFlying).toBe(true);
    const end = c.update(FLIGHT_SECONDS);
    expect(c.isFlying).toBe(false);
    expect(end.focusId).toBe('neptune');
    expect(end.focusPoint).toEqual([4.5e12, 0, 0]);
    expect(end.altitudeM).toBeCloseTo(4 * 2.4622e7, -1);
    expect(end.position[0]).toBeLessThan(4.5e12);
    expect(c.pitch).toBeCloseTo(DEFAULT_PITCH, 12);
  });
  it('ignores zoom, orbit and a second flight while flying', () => {
    const c = make();
    c.flyTo('neptune');
    const before = c.yaw;
    c.zoom(5);
    c.orbit(1, 1);
    c.flyTo('sun');
    expect(c.yaw).toBe(before);
    expect(c.displayId).toBe('neptune');
  });
});
