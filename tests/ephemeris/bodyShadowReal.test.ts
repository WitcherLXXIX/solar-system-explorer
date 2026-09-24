import { Body, GeoMoon, GeoVector, JupiterMoons } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { dot, length, scale, sub, type Vec3 } from '../../src/math';
import { shadowLit } from '../../src/render/bodyShadowMath';

const AU_KM = 149_597_870.7;
const SUN_RADIUS_KM = 695_700;
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737.4;
const JUPITER_RADIUS_KM = 69_911;
const IO_RADIUS_KM = 1821.49;
const v3 = (v: { x: number; y: number; z: number }): Vec3 => [v.x * AU_KM, v.y * AU_KM, v.z * AU_KM];

/** Sunlight fraction at the Moon's centre from Earth's shadow (receiver units: Moon radii). */
function moonLit(iso: string): number {
  const date = new Date(iso);
  const moon = v3(GeoMoon(date));
  const sunFromMoon = sub(v3(GeoVector(Body.Sun, date, false)), moon);
  const dist = length(sunFromMoon);
  return shadowLit(
    [0, 0, 0], scale(sunFromMoon, 1 / dist), { position: scale(moon, -1 / MOON_RADIUS_KM), radius: EARTH_RADIUS_KM / MOON_RADIUS_KM },
    SUN_RADIUS_KM / dist,
  );
}

describe('the real total lunar eclipse of 2026-03-03', () => {
  it('has the Moon in the umbra at the peak and in full sunlight six hours before and six days after', () => {
    expect(moonLit('2026-03-03T11:33:40Z')).toBeLessThan(0.01);
    expect(moonLit('2026-03-03T05:33:40Z')).toBe(1);
    expect(moonLit('2026-03-09T11:33:40Z')).toBe(1);
  });
});

describe("Io's shadow on Jupiter at 2026-09-25T00:59:00Z", () => {
  const date = new Date('2026-09-25T00:59:00Z');
  const io = scale(v3(JupiterMoons(date).io), 1 / JUPITER_RADIUS_KM); // Jupiter radii, Jupiter at the origin
  const sunFromJupiter = sub(v3(GeoVector(Body.Sun, date, false)), v3(GeoVector(Body.Jupiter, date, false)));
  const sunDist = length(sunFromJupiter);
  const sun = scale(sunFromJupiter, 1 / sunDist);
  const tanSun = SUN_RADIUS_KM / sunDist;
  const occluder = { position: io, radius: IO_RADIUS_KM / JUPITER_RADIUS_KM };
  it('darkens the surface point on the shadow axis and leaves the sub-solar point lit', () => {
    const t = dot(io, sun);
    const u = t - Math.sqrt(t * t - (dot(io, io) - 1)); // the near intersection of the axis c - s*u with the unit sphere
    const onAxis = sub(io, scale(sun, u));
    expect(length(onAxis)).toBeCloseTo(1, 9);
    expect(shadowLit(onAxis, sun, occluder, tanSun)).toBeLessThan(0.01);
    expect(shadowLit(sun, sun, occluder, tanSun)).toBe(1);
  });
});
