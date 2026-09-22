import { describe, expect, it } from 'vitest';
import { CORE_BODIES, type BodyData, type BodyId } from '../../src/catalog/bodies';
import { SATELLITE_BODIES } from '../../src/catalog/satellites';
import { G } from '../../src/units';
import { NO_SECOND_SOURCE, SECOND_SOURCE } from './crossCheck';

const EXPECTED_ORDER: BodyId[] = [
  'moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea',
  'titan', 'iapetus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'pluto', 'charon', 'ceres', 'eris',
  'haumea', 'makemake',
];
const ALL: readonly BodyData[] = [...CORE_BODIES, ...SATELLITE_BODIES];
const byId = new Map<BodyId, BodyData>(ALL.map((b) => [b.id, b]));
const body = (id: BodyId): BodyData => byId.get(id)!;
const relDiff = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe('satellite catalog structure', () => {
  it('lists exactly the 26 moons and dwarf planets, parents before children', () => {
    expect(SATELLITE_BODIES.map((b) => b.id)).toEqual(EXPECTED_ORDER);
    expect(new Set(ALL.map((b) => b.id)).size).toBe(35);
  });
  it('has 21 moons and 5 dwarf planets', () => {
    expect(SATELLITE_BODIES.filter((b) => b.kind === 'moon')).toHaveLength(21);
    expect(SATELLITE_BODIES.filter((b) => b.kind === 'dwarf').map((b) => b.id)).toEqual(['pluto', 'ceres', 'eris', 'haumea', 'makemake']);
  });
  it('gives every body a parent that exists and comes earlier in the list (no cycles)', () => {
    ALL.forEach((b, index) => {
      if (b.id === 'sun') {
        expect(b.parent).toBeNull();
        return;
      }
      const parentIndex = ALL.findIndex((p) => p.id === b.parent);
      expect(parentIndex, `${b.id} parent`).toBeGreaterThanOrEqual(0);
      expect(parentIndex, `${b.id} parent order`).toBeLessThan(index);
    });
  });
  it('parents planets and dwarf planets to the Sun, and moons to their planet (Charon to Pluto)', () => {
    for (const b of ALL) {
      if (b.kind === 'planet' || b.kind === 'dwarf') expect(b.parent, b.id).toBe('sun');
    }
    expect(body('moon').parent).toBe('earth');
    expect(['phobos', 'deimos'].map((id) => body(id as BodyId).parent)).toEqual(['mars', 'mars']);
    expect(['io', 'europa', 'ganymede', 'callisto'].map((id) => body(id as BodyId).parent)).toEqual(Array(4).fill('jupiter'));
    expect(['mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'iapetus'].map((id) => body(id as BodyId).parent)).toEqual(Array(7).fill('saturn'));
    expect(['miranda', 'ariel', 'umbriel', 'titania', 'oberon'].map((id) => body(id as BodyId).parent)).toEqual(Array(5).fill('uranus'));
    expect(body('triton').parent).toBe('neptune');
    expect(body('charon').parent).toBe('pluto');
  });
  it('uses astronomy-engine for the planets, the Moon, the Galilean moons and Pluto, and bundled elements for the rest', () => {
    expect(ALL.filter((b) => b.orbitSource === 'astronomy-engine').map((b) => b.id)).toEqual([
      'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon', 'io', 'europa', 'ganymede', 'callisto', 'pluto',
    ]);
    expect(ALL.filter((b) => b.orbitSource === 'elements')).toHaveLength(20);
    expect(body('sun').orbitSource).toBeNull();
  });
});

describe('satellite facts', () => {
  it('has positive numbers, a colour and a source for every entry', () => {
    for (const b of SATELLITE_BODIES) {
      expect(b.radiusM, b.id).toBeGreaterThan(0);
      if (b.massKg !== null) expect(b.massKg, b.id).toBeGreaterThan(0);
      expect(b.orbitPeriodDays, b.id).toBeGreaterThan(0);
      if (b.surfaceGravity !== null) expect(b.surfaceGravity, b.id).toBeGreaterThan(0);
      expect(b.color, b.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(b.source.length, b.id).toBeGreaterThan(20);
      if (b.meanTempK !== null) expect(b.meanTempK, b.id).toBeGreaterThan(0);
    }
  });
  it('has a surface gravity within 3% of G M / r^2', () => {
    for (const b of SATELLITE_BODIES) {
      if (b.massKg === null || b.surfaceGravity === null) continue;
      expect(relDiff(b.surfaceGravity, (G * b.massKg) / (b.radiusM * b.radiusM)), b.id).toBeLessThan(0.03);
    }
  });
  it('has a plausible bulk density (0.4 to 8 g/cm^3), which catches a mass or radius off by a power of ten', () => {
    for (const b of SATELLITE_BODIES) {
      if (b.massKg === null) continue;
      const density = b.massKg / ((4 / 3) * Math.PI * b.radiusM ** 3) / 1000;
      expect(density, b.id).toBeGreaterThan(0.4);
      expect(density, b.id).toBeLessThan(8);
    }
  });
  it('rotates once per orbit for every moon (tidal locking), and Triton, which orbits backwards, is negative', () => {
    for (const b of SATELLITE_BODIES.filter((s) => s.kind === 'moon')) {
      expect(relDiff(Math.abs(b.rotationPeriodH), b.orbitPeriodDays! * 24), b.id).toBeLessThan(0.005);
    }
    expect(body('triton').rotationPeriodH).toBeLessThan(0);
  });
  it('has facts consistent with an independent second source (radius 3%, mass 5%, period 0.1%)', () => {
    for (const b of SATELLITE_BODIES) {
      const second = SECOND_SOURCE[b.id];
      if (!second) continue;
      if (second.radiusM !== undefined) expect(relDiff(b.radiusM, second.radiusM), `${b.id} radius`).toBeLessThan(0.03);
      if (second.massKg !== undefined) expect(relDiff(b.massKg!, second.massKg), `${b.id} mass`).toBeLessThan(0.05);
      if (second.orbitPeriodDays !== undefined) expect(relDiff(b.orbitPeriodDays!, second.orbitPeriodDays), `${b.id} period`).toBeLessThan(0.001);
      expect(second.source.length, b.id).toBeGreaterThan(10);
    }
  });
  it('has a second source for every body except a short, explicit list', () => {
    const missing = SATELLITE_BODIES.map((b) => b.id).filter((id) => !SECOND_SOURCE[id]);
    expect([...missing].sort()).toEqual([...NO_SECOND_SOURCE].sort());
    expect(NO_SECOND_SOURCE.length).toBeLessThanOrEqual(5);
  });
});
