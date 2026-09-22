import { describe, expect, it } from 'vitest';
import { CORE_BODIES, type BodyData, type BodyId } from '../../src/catalog/bodies';
import { SATELLITE_BODIES } from '../../src/catalog/satellites';
import { G } from '../../src/units';
import { dateFromTdbJd } from './testDates';
import { HORIZONS_STATES, REFERENCE_EPOCHS_JD, REFERENCE_IDS } from './horizonsReference';

const ALL: readonly BodyData[] = [...CORE_BODIES, ...SATELLITE_BODIES];
const body = (id: BodyId): BodyData => ALL.find((b) => b.id === id)!;
const norm = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!);

const EXPECTED_IDS: BodyId[] = [
  'moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea',
  'titan', 'iapetus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'pluto', 'charon', 'ceres', 'eris',
  'haumea', 'makemake',
];

describe('Horizons reference states', () => {
  it('covers 26 bodies at the four epochs, relative to the parent', () => {
    expect([...REFERENCE_IDS].sort()).toEqual([...EXPECTED_IDS].sort());
    expect(REFERENCE_EPOCHS_JD).toEqual([2442413.5, 2451545.0, 2461304.5, 2469807.5]);
    expect(HORIZONS_STATES).toHaveLength(26 * 4);
    for (const id of EXPECTED_IDS) {
      const states = HORIZONS_STATES.filter((s) => s.id === id);
      expect(states.map((s) => s.jdTdb), id).toEqual([...REFERENCE_EPOCHS_JD]);
      for (const s of states) expect(s.center, id).toBe(body(id).parent);
    }
  });
  it('converts a Horizons epoch to a date whose Terrestrial Time matches', () => {
    // 2000-01-01 12:00 TDB is 63.8 s before 12:00 UT plus a few seconds of model difference: within a minute either way.
    const d = dateFromTdbJd(2451545.0);
    expect(Math.abs(d.getTime() - Date.UTC(2000, 0, 1, 12))).toBeLessThan(90_000);
  });
  it('is finite everywhere and moves at a plausible speed', () => {
    for (const s of HORIZONS_STATES) {
      expect([...s.positionKm, ...s.velocityKmS].every(Number.isFinite), s.id).toBe(true);
      expect(norm(s.positionKm), s.id).toBeGreaterThan(1000);
      expect(norm(s.velocityKmS), s.id).toBeGreaterThan(0.001);
      expect(norm(s.velocityKmS), s.id).toBeLessThan(60);
    }
  });
  it('is a bound orbit whose semi-major axis (vis-viva) agrees within 5% with the catalog period (Kepler\'s third law)', () => {
    for (const s of HORIZONS_STATES) {
      const b = body(s.id);
      const parent = body(b.parent!);
      const mu = G * (parent.massKg! + b.massKg!);
      const r = norm(s.positionKm) * 1000;
      const v = norm(s.velocityKmS) * 1000;
      const invA = 2 / r - (v * v) / mu;
      expect(invA, `${s.id} at ${s.jdTdb} is bound`).toBeGreaterThan(0);
      const aState = 1 / invA;
      const aKepler = Math.cbrt((mu * ((b.orbitPeriodDays! * 86_400) / (2 * Math.PI)) ** 2));
      expect(Math.abs(aState - aKepler) / aKepler, `${s.id} at ${s.jdTdb}`).toBeLessThan(0.05);
    }
  });
});
