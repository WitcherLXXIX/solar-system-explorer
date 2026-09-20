import { describe, expect, it } from 'vitest';
import {
  apparentDiameterPx, eclipticToThree, nearPlane, orbitLineOpacity, toRenderSpace,
} from '../../src/render/cameraRelative';
import type { Vec3 } from '../../src/math';
import { AU_M, DEG } from '../../src/units';

describe('eclipticToThree', () => {
  it('maps ecliptic north to up and is a proper rotation', () => {
    // toBeCloseTo per component: toEqual would distinguish +0 from -0.
    const close = (actual: Vec3, expected: Vec3) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 12));
    close(eclipticToThree([0, 0, 1]), [0, 1, 0]);
    close(eclipticToThree([1, 0, 0]), [1, 0, 0]);
    close(eclipticToThree([0, 1, 0]), [0, 0, -1]);
  });
});

describe('toRenderSpace', () => {
  it('keeps metre precision 4.5e12 m from the origin', () => {
    const camera: Vec3 = [4.5e12, 2.0e12, -3.0e11];
    const world: Vec3 = [4.5e12 + 1000.123, 2.0e12, -3.0e11];
    const rel = toRenderSpace(world, camera);
    const expected = world[0] - camera[0];
    expect(rel[0]).toBeCloseTo(expected, 9);
    expect(rel[1]).toBeCloseTo(0, 9);
    expect(rel[2]).toBeCloseTo(0, 9);
    expect(Math.abs(Math.fround(rel[0]) - expected)).toBeLessThan(1e-4);
  });
  it('shows why: subtracting after casting to float32 loses hundreds of metres', () => {
    const naive = Math.fround(4.5e12 + 1000) - Math.fround(4.5e12);
    expect(Math.abs(naive - 1000)).toBeGreaterThan(100);
  });
});

describe('apparentDiameterPx', () => {
  const fov = 50 * DEG;
  it('is tiny for Earth seen from 1 AU', () => {
    expect(apparentDiameterPx(6.371e6, AU_M, fov, 1000)).toBeCloseTo(0.0913, 3);
  });
  it('grows as the camera approaches', () => {
    expect(apparentDiameterPx(6.371e6, 2e7, fov, 1000)).toBeGreaterThan(apparentDiameterPx(6.371e6, 2e8, fov, 1000));
  });
});

describe('orbitLineOpacity', () => {
  it('fades out close to the body, where polyline chords would show', () => {
    expect(orbitLineOpacity(1e6, 1.5e11)).toBe(0);
    expect(orbitLineOpacity(1e11, 1.5e11)).toBeCloseTo(0.55, 12);
    const mid = orbitLineOpacity(0.01 * 1.5e11, 1.5e11);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(0.55);
  });
});

describe('nearPlane', () => {
  it('scales with altitude within sane bounds', () => {
    expect(nearPlane(1e5)).toBeCloseTo(5000, 6);
    expect(nearPlane(1)).toBe(1);
    // capped low so a zoomed-out camera passing through a body is not cut off by a huge near plane
    expect(nearPlane(1e13)).toBe(1e7);
    expect(nearPlane(1e9)).toBe(1e7);
    expect(nearPlane(1e8)).toBeCloseTo(5e6, 6);
  });
});
