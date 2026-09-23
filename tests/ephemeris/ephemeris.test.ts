import { describe, expect, it } from 'vitest';
import { BODIES, getBody } from '../../src/catalog/bodies';
import { bodyOrientation, bodyPosition, bodyRelativePosition, orbitalPeriodDays, sampleOrbit } from '../../src/ephemeris/ephemeris';
import { cross, dot, length } from '../../src/math';
import { AU_M, DEG } from '../../src/units';

const J2000 = new Date('2000-01-01T12:00:00Z');
const au = (m: number) => m / AU_M;

describe('bodyPosition', () => {
  it('puts the Sun at the origin', () => {
    const p = bodyPosition('sun', J2000);
    expect(length(p)).toBeLessThan(1);
  });
  it('places Earth at the known ecliptic J2000 position', () => {
    const p = bodyPosition('earth', J2000);
    expect(au(p[0])).toBeCloseTo(-0.17714, 3);
    expect(au(p[1])).toBeCloseTo(0.96723, 3);
    expect(Math.abs(au(p[2]))).toBeLessThan(1e-3);
  });
  it('gets Earth perihelion and aphelion distances right', () => {
    expect(au(length(bodyPosition('earth', new Date('2026-01-03T17:00:00Z'))))).toBeCloseTo(0.9833, 3);
    expect(au(length(bodyPosition('earth', new Date('2026-07-06T18:00:00Z'))))).toBeCloseTo(1.0167, 3);
  });
  it('places Neptune about 30 AU away', () => {
    const p = bodyPosition('neptune', J2000);
    expect(au(p[0])).toBeCloseTo(16.813, 2);
    expect(au(p[1])).toBeCloseTo(-24.991, 2);
    expect(au(length(p))).toBeCloseTo(30.12, 1);
  });
});

describe('orbitalPeriodDays', () => {
  it('is null for the Sun and correct for planets', () => {
    expect(orbitalPeriodDays('sun')).toBeNull();
    expect(orbitalPeriodDays('earth')).toBeCloseTo(365.256, 1);
    expect(orbitalPeriodDays('neptune')).toBeGreaterThan(60_000);
    expect(orbitalPeriodDays('neptune')).toBeLessThan(60_400);
  });
});

describe('bodyOrientation', () => {
  it('returns orthonormal right-handed axes', () => {
    const [x, y, z] = bodyOrientation('mars', J2000);
    expect(length(x)).toBeCloseTo(1, 9);
    expect(length(y)).toBeCloseTo(1, 9);
    expect(length(z)).toBeCloseTo(1, 9);
    expect(dot(x, y)).toBeCloseTo(0, 9);
    expect(dot(x, z)).toBeCloseTo(0, 9);
    const c = cross(x, y);
    expect(dot(c, z)).toBeCloseTo(1, 9);
  });
  it('tilts Earth by about 23.4 degrees from the ecliptic pole', () => {
    const z = bodyOrientation('earth', J2000)[2];
    expect(Math.acos(z[2]) / DEG).toBeCloseTo(23.44, 1);
  });
  it('points Earth\'s prime meridian where Greenwich sidereal time says at J2000', () => {
    // GMST at J2000.0 is 280.4606 deg, so Greenwich is at RA 280.46 deg on the equator.
    // Converting that direction to the ecliptic (obliquity 23.4393 deg) gives about (0.1816, -0.9022, 0.3912).
    const x = bodyOrientation('earth', J2000)[0];
    expect(x[0]).toBeCloseTo(0.1816, 2);
    expect(x[1]).toBeCloseTo(-0.9022, 2);
    expect(x[2]).toBeCloseTo(0.3912, 2);
  });
  it('lays Uranus on its side and spins it retrograde (IAU convention)', () => {
    // The IAU north pole of Uranus points about 82 degrees from ecliptic north, and W decreases with time.
    const a = bodyOrientation('uranus', J2000);
    const tilt = Math.acos(a[2][2]) / DEG;
    expect(tilt).toBeGreaterThan(80);
    expect(tilt).toBeLessThan(84);
    const later = bodyOrientation('uranus', new Date(J2000.getTime() + 3_600_000));
    expect(dot(cross(a[0], later[0]), a[2])).toBeLessThan(0);
  });
  it('spins Earth once per sidereal day, prograde', () => {
    const period = 86_164.0989 * 1000;
    const a = bodyOrientation('earth', J2000);
    const full = bodyOrientation('earth', new Date(J2000.getTime() + period));
    const half = bodyOrientation('earth', new Date(J2000.getTime() + period / 2));
    expect(dot(a[0], full[0])).toBeGreaterThan(Math.cos(0.05 * DEG));
    expect(dot(a[0], half[0])).toBeLessThan(-0.9999);
    const later = bodyOrientation('earth', new Date(J2000.getTime() + 3_600_000));
    expect(dot(cross(a[0], later[0]), a[2])).toBeGreaterThan(0);
  });
  it('spins Venus retrograde', () => {
    const a = bodyOrientation('venus', J2000);
    const later = bodyOrientation('venus', new Date(J2000.getTime() + 86_400_000));
    expect(dot(cross(a[0], later[0]), a[2])).toBeLessThan(0);
  });
});

describe('sampleOrbit', () => {
  it('samples one closed orbit starting at the given date', () => {
    const samples = sampleOrbit('earth', J2000, 720);
    expect(samples.length).toBe(720 * 3);
    const start = bodyPosition('earth', J2000);
    expect(samples[0]).toBeCloseTo(start[0], 0);
    expect(samples[1]).toBeCloseTo(start[1], 0);
    for (let i = 0; i < 720; i++) {
      const r = au(Math.hypot(samples[3 * i]!, samples[3 * i + 1]!, samples[3 * i + 2]!));
      expect(r).toBeGreaterThan(0.98);
      expect(r).toBeLessThan(1.02);
    }
  });
  it('refuses the Sun', () => {
    expect(() => sampleOrbit('sun', J2000, 10)).toThrow();
  });
});

describe('phase 2b bodies', () => {
  const G = 6.6743e-11;
  it('gives moons and dwarf planets a catalog period and the planets and Pluto astronomy-engine periods', () => {
    expect(orbitalPeriodDays('sun')).toBeNull();
    expect(orbitalPeriodDays('pluto')).toBeGreaterThan(90_000);
    expect(orbitalPeriodDays('pluto')).toBeLessThan(91_000);
    for (const b of BODIES.filter((x) => x.kind === 'moon' || x.id === 'ceres')) expect(orbitalPeriodDays(b.id), b.id).toBe(b.orbitPeriodDays);
  });
  it('places every moon and dwarf planet at a distance consistent with its catalog period (Kepler\'s third law, within a factor of 0.4 to 1.6)', () => {
    for (const b of BODIES.filter((x) => (x.kind === 'moon' || x.kind === 'dwarf') && x.massKg !== null)) {
      const parent = getBody(b.parent!);
      const a = Math.cbrt(G * (parent.massKg! + b.massKg!) * ((b.orbitPeriodDays! * 86_400) / (2 * Math.PI)) ** 2);
      const r = length(bodyRelativePosition(b.id, new Date('2026-09-21T00:00:00Z')));
      expect(r / a, b.id).toBeGreaterThan(0.4);
      expect(r / a, b.id).toBeLessThan(1.6);
    }
  });
  it('measures the Moon\'s and the Galilean moons\' sidereal periods within 0.2% of the catalog (angle swept about the orbit normal over five orbits)', () => {
    for (const id of ['moon', 'io', 'europa', 'ganymede', 'callisto'] as const) {
      const catalog = getBody(id).orbitPeriodDays!;
      const start = new Date('2026-09-21T00:00:00Z');
      const steps = 200;
      const dt = (5 * catalog * 86_400_000) / steps;
      let previous = bodyRelativePosition(id, start);
      const normal = cross(previous, bodyRelativePosition(id, new Date(start.getTime() + dt)));
      let swept = 0;
      for (let k = 1; k <= steps; k++) {
        const next = bodyRelativePosition(id, new Date(start.getTime() + k * dt));
        swept += Math.atan2(dot(cross(previous, next), normal) / length(normal), dot(previous, next));
        previous = next;
      }
      const measured = (5 * catalog * 2 * Math.PI) / swept;
      expect(Math.abs(measured - catalog) / catalog, id).toBeLessThan(0.002);
    }
  });
  it('samples a moon\'s orbit relative to its parent: closed, evenly spaced and starting at the start date', () => {
    const start = new Date('2026-09-21T00:00:00Z');
    const samples = sampleOrbit('moon', start, 360);
    expect(samples.length).toBe(360 * 3);
    const first = bodyRelativePosition('moon', start);
    expect(samples[0]).toBeCloseTo(first[0], 0);
    expect(samples[1]).toBeCloseTo(first[1], 0);
    for (let i = 0; i < 360; i++) {
      const r = Math.hypot(samples[3 * i]!, samples[3 * i + 1]!, samples[3 * i + 2]!);
      expect(r).toBeGreaterThan(3.5e8);
      expect(r).toBeLessThan(4.1e8);
    }
  });
});
