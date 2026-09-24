import { describe, expect, it } from 'vitest';
import { CameraController, FLIGHT_SECONDS, MAX_CAMERA_DISTANCE_M, type FocusSource } from '../../src/camera/cameraController';
import { getBody } from '../../src/catalog/bodies';
import { NEARBY_STARS } from '../../src/catalog/stars';
import { computeFrame } from '../../src/ephemeris/frame';
import { length } from '../../src/math';

const frame = computeFrame(new Date('2026-09-24T00:00:00Z'));
const source: FocusSource = { position: (id) => frame[id].position, radius: (id) => getBody(id).radiusM };
const make = () => new CameraController(source, { focusId: 'earth', altitudeM: 1e7, yaw: 0, pitch: 0 });

describe('flying to a star', () => {
  it('rises far above the system mid-flight, then lands sunward of Proxima Centauri at 4 of its radii', () => {
    const c = make();
    c.flyTo('proxima');
    expect(c.displayId).toBe('proxima');
    const mid = c.update(FLIGHT_SECONDS / 2);
    expect(mid.altitudeM).toBeGreaterThan(5e16); // 1.3 x the 4.02e16 m trip
    expect(mid.altitudeM).toBeLessThan(MAX_CAMERA_DISTANCE_M);
    expect(mid.position.every(Number.isFinite)).toBe(true);
    const end = c.update(FLIGHT_SECONDS);
    expect(c.isFlying).toBe(false);
    expect(end.focusId).toBe('proxima');
    expect(end.focusPoint).toEqual(frame.proxima.position);
    expect(end.altitudeM / (4 * getBody('proxima').radiusM)).toBeCloseTo(1, 9);
    expect(length(end.position)).toBeLessThan(length(end.focusPoint)); // the camera sits between the star and the Sun
  });
  it('reaches every one of the twelve stars, the farthest (61 Cygni A, 1.08e17 m) included, with finite poses', () => {
    for (const star of NEARBY_STARS) {
      const c = make();
      c.flyTo(star.id);
      const end = c.update(FLIGHT_SECONDS + 0.1);
      expect(end.focusId, star.id).toBe(star.id);
      expect(end.position.every(Number.isFinite), star.id).toBe(true);
      expect(Number.isFinite(end.altitudeM), star.id).toBe(true);
    }
  });
  it('can zoom out to the maximum around a star and back in to 0.2% of its radius', () => {
    const c = make();
    c.snapTo('cygni61a', 1e30, 0, 0);
    expect(c.update(0).altitudeM / MAX_CAMERA_DISTANCE_M).toBeCloseTo(1, 12);
    c.snapTo('siriusb', 1, 0, 0);
    expect(c.update(0).altitudeM / (0.002 * getBody('siriusb').radiusM)).toBeCloseTo(1, 9);
  });
});
