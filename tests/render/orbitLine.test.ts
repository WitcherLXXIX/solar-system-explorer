import { describe, expect, it } from 'vitest';
import { OrbitLine } from '../../src/render/orbitLine';
import { sampleOrbit } from '../../src/ephemeris/ephemeris';

const DATE = new Date('2026-09-21T00:00:00Z');

function vertex(line: OrbitLine, i: number): [number, number, number] {
  const p = line.line.geometry.getAttribute('position');
  return [p.getX(i), p.getY(i), p.getZ(i)];
}

describe('OrbitLine', () => {
  it('is hidden and samples nothing until the opacity is above the visibility threshold', () => {
    const orbit = new OrbitLine('moon', '#ffffff');
    orbit.update([1e11, 0, 0], [0, 0, 0], DATE, 0);
    expect(orbit.line.visible).toBe(false);
    expect(vertex(orbit, 0)).toEqual([0, 0, 0]);
  });
  it('draws the orbit around the parent and relative to the camera, in Three.js axes', () => {
    const orbit = new OrbitLine('moon', '#ffffff');
    const parent: [number, number, number] = [1.5e11, 2.5e10, 3e9];
    const camera: [number, number, number] = [1.5e11 + 1e8, 2.5e10 - 2e8, 3e9 + 5e7];
    orbit.update(parent, camera, DATE, 0.5);
    expect(orbit.line.visible).toBe(true);
    const first = sampleOrbit('moon', DATE, 720);
    // ecliptic (x, y, z) maps to Three.js (x, z, -y); the offset parent - camera is added before the float32 cast.
    const [vx, vy, vz] = vertex(orbit, 0);
    expect(vx).toBeCloseTo(first[0]! + (parent[0] - camera[0]), -2);
    expect(vy).toBeCloseTo(first[2]! + (parent[2] - camera[2]), -2);
    expect(vz).toBeCloseTo(-(first[1]! + (parent[1] - camera[1])), -2);
  });
  it('keeps precision when the camera and the parent are both far from the origin (float64 sum before the float32 cast)', () => {
    const orbit = new OrbitLine('io', '#ffffff');
    const parent: [number, number, number] = [7.4e11, 1e10, -3e9]; // Jupiter is about 5 AU from the Sun
    const camera: [number, number, number] = [parent[0] + 4e8, parent[1] - 1e8, parent[2] + 2e7];
    orbit.update(parent, camera, DATE, 0.5);
    const first = sampleOrbit('io', DATE, 720);
    // A float32 subtraction of the two large positions would be off by about 7.4e11 x 6e-8 = 44 km; the float64 sum is good to tens of metres.
    const [vx, vy, vz] = vertex(orbit, 0);
    expect(vx).toBeCloseTo(first[0]! + (parent[0] - camera[0]), -3);
    expect(vy).toBeCloseTo(first[2]! + (parent[2] - camera[2]), -3);
    expect(vz).toBeCloseTo(-(first[1]! + (parent[1] - camera[1])), -3);
  });
  it('re-samples after the orbit goes stale', () => {
    const orbit = new OrbitLine('phobos', '#ffffff');
    orbit.update([0, 0, 0], [1e8, 0, 0], DATE, 0.5);
    const before = vertex(orbit, 0);
    const later = new Date(DATE.getTime() + 400 * 86_400_000); // Phobos: stale after about 3.2 days, and 400 days is a different phase
    orbit.update([0, 0, 0], [1e8, 0, 0], later, 0.5);
    expect(vertex(orbit, 0)).not.toEqual(before);
  });
});
