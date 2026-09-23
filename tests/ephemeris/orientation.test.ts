import { describe, expect, it } from 'vitest';
import { BODIES, getBody, type BodyId } from '../../src/catalog/bodies';
import { bodyOrientation, bodyRelativePosition, orbitalPeriodDays } from '../../src/ephemeris/ephemeris';
import { cross, dot, length, sub, type Vec3 } from '../../src/math';
import { DAY_S, DEG } from '../../src/units';

const MOONS = BODIES.filter((b) => b.kind === 'moon').map((b) => b.id);
const DATES = [new Date('2000-01-01T12:00:00Z'), new Date('2026-09-21T00:00:00Z')];
const angle = (a: Vec3, b: Vec3): number => Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (length(a) * length(b))))) / DEG;

describe('moon orientation', () => {
  it('has 21 moons under test', () => {
    expect(MOONS).toHaveLength(21);
  });
  it('keeps the prime meridian within 20 degrees of the parent (tidal locking, including the unmodelled libration)', () => {
    for (const id of MOONS) {
      for (const date of DATES) {
        const x = bodyOrientation(id, date)[0];
        const towardParent = sub([0, 0, 0], bodyRelativePosition(id, date));
        expect(angle(x, towardParent), `${id} at ${date.toISOString()}`).toBeLessThan(20);
      }
    }
  });
  it('spins in the sense of the orbit: over a tenth of an orbit the prime meridian turns about the orbit normal, the way the moon moves', () => {
    for (const id of MOONS) {
      const date = DATES[1]!;
      const period = orbitalPeriodDays(id)!;
      const later = new Date(date.getTime() + (period / 10) * DAY_S * 1000);
      const r0 = bodyRelativePosition(id, date);
      const r1 = bodyRelativePosition(id, later);
      const normal = cross(r0, r1);
      const x0 = bodyOrientation(id, date)[0];
      const x1 = bodyOrientation(id, later)[0];
      expect(dot(cross(x0, x1), normal), id).toBeGreaterThan(0);
    }
  });
  it('turns about once per orbit: after one period the prime meridian is back within 25 degrees', () => {
    for (const id of MOONS) {
      const date = DATES[1]!;
      const later = new Date(date.getTime() + orbitalPeriodDays(id)! * DAY_S * 1000);
      expect(angle(bodyOrientation(id, date)[0], bodyOrientation(id, later)[0]), id).toBeLessThan(25);
    }
  });
  it('gives the Moon a pole within 3 degrees of the ecliptic pole (its true tilt is 1.54 degrees)', () => {
    for (const date of DATES) expect(angle(bodyOrientation('moon', date)[2], [0, 0, 1])).toBeLessThan(3);
  });
});

describe('dwarf planet orientation', () => {
  it('returns orthonormal axes for every dwarf planet, spinning at the catalog rate', () => {
    for (const id of ['pluto', 'ceres', 'eris', 'haumea', 'makemake'] as BodyId[]) {
      const date = DATES[1]!;
      const [x, y, z] = bodyOrientation(id, date);
      expect(length(x), id).toBeCloseTo(1, 9);
      expect(length(y), id).toBeCloseTo(1, 9);
      expect(dot(x, y), id).toBeCloseTo(0, 9);
      expect(dot(cross(x, y), z), id).toBeCloseTo(1, 9);
      // A tenth of a rotation later the prime meridian has turned by 36 degrees (a pole fixed within the interval).
      const tenth = (Math.abs(getBody(id).rotationPeriodH!) / 10) * 3600 * 1000;
      const later = bodyOrientation(id, new Date(date.getTime() + tenth))[0];
      expect(angle(x, later), id).toBeGreaterThan(20);
      expect(angle(x, later), id).toBeLessThan(50);
    }
  });
});
