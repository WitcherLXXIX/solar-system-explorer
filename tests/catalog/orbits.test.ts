import { describe, expect, it } from 'vitest';
import { CORE_BODIES, type BodyData, type BodyId } from '../../src/catalog/bodies';
import { ELEMENTS, ROTATIONS } from '../../src/catalog/orbits';
import { SATELLITE_BODIES } from '../../src/catalog/satellites';
import { G } from '../../src/units';

const ALL: readonly BodyData[] = [...CORE_BODIES, ...SATELLITE_BODIES];
const body = (id: BodyId): BodyData => ALL.find((b) => b.id === id)!;
const relDiff = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

const ELEMENT_IDS: BodyId[] = [
  'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan',
  'iapetus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'charon', 'ceres', 'eris', 'haumea', 'makemake',
];

// Documented, ruled exceptions: genuine cross-source discrepancies confirmed by multiple independent re-fetches
// (see task-5-report.md), not transcription errors. io/europa are validation-only (astronomy-engine drives their
// actual rendered position); phobos is rendered from ELEMENTS but the discrepancy is well under a minute of phase.
const PERIOD_TOLERANCE_OVERRIDE: Partial<Record<BodyId, number>> = {
  phobos: 0.0007,
  io: 0.004,
  europa: 0.0075,
};

describe('bundled orbital elements', () => {
  it('has an element set for exactly the 24 expected bodies', () => {
    expect(Object.keys(ELEMENTS).sort()).toEqual([...ELEMENT_IDS].sort());
  });
  it('covers every body whose catalog orbit source is "elements"', () => {
    for (const b of ALL.filter((x) => x.orbitSource === 'elements')) expect(ELEMENTS[b.id], b.id).toBeDefined();
  });
  it('has values in physical ranges and a cited source', () => {
    for (const [id, set] of Object.entries(ELEMENTS)) {
      const el = set.elements;
      expect(el.aKm, id).toBeGreaterThan(1000);
      expect(el.e, id).toBeGreaterThanOrEqual(0);
      expect(el.e, id).toBeLessThan(0.9);
      expect(el.iDeg, id).toBeGreaterThanOrEqual(0);
      expect(el.iDeg, id).toBeLessThanOrEqual(180);
      expect(el.meanMotionDegPerDay, id).toBeGreaterThan(0);
      expect(Math.abs(el.nodeRateDegPerYear), id).toBeLessThan(1000);
      expect(Math.abs(el.periRateDegPerYear), id).toBeLessThan(1000);
      expect(el.epochJd, id).toBeGreaterThan(2_400_000);
      expect(el.epochJd, id).toBeLessThan(2_500_000);
      expect(set.source.length, id).toBeGreaterThan(20);
      if (set.frame !== 'ecliptic') {
        expect(set.frame.poleDecDeg, id).toBeGreaterThanOrEqual(-90);
        expect(set.frame.poleDecDeg, id).toBeLessThanOrEqual(90);
      }
    }
  });
  it('agrees with Kepler\'s third law using the parent and body masses (moons within 1%, dwarf planets within 0.05%)', () => {
    for (const [id, set] of Object.entries(ELEMENTS)) {
      const b = body(id as BodyId);
      const parent = body(b.parent!);
      // Note: massKg is `number | null` for Eris, Haumea and Makemake (Task 4 ruling: no sourced mass on any
      // allowed domain). The `!` below only silences the strict-null-check compile error; it does not change
      // runtime behavior -- `null! + number` is still `NaN` at runtime, so this check still fails loudly (not
      // silently) for those 3 bodies exactly as it would with a plain `+`. See task-5-report.md.
      const mu = G * (parent.massKg! + b.massKg!);
      const keplerDays = (2 * Math.PI * Math.sqrt((set.elements.aKm * 1000) ** 3 / mu)) / 86_400;
      const fromMotion = 360 / set.elements.meanMotionDegPerDay;
      expect(relDiff(fromMotion, keplerDays), id).toBeLessThan(b.kind === 'dwarf' ? 0.0005 : 0.01);
    }
  });
  it('agrees with the catalog period from the independent NSSDC source (sidereal or anomalistic convention, 0.05%)', () => {
    for (const [id, set] of Object.entries(ELEMENTS)) {
      const el = set.elements;
      const catalogDays = body(id as BodyId).orbitPeriodDays!;
      const sidereal = 360 / el.meanMotionDegPerDay;
      // If the table's period is the anomalistic one, the sidereal period differs by the periapsis rate.
      const other = 360 / (el.meanMotionDegPerDay + el.periRateDegPerYear / 365.25);
      const tolerance = PERIOD_TOLERANCE_OVERRIDE[id as BodyId] ?? 0.0005;
      expect(Math.min(relDiff(sidereal, catalogDays), relDiff(other, catalogDays)), id).toBeLessThan(tolerance);
    }
  });
});

describe('bundled IAU rotation constants', () => {
  it('has physical ranges and a source for every entry, and only for non-planet bodies', () => {
    for (const [id, r] of Object.entries(ROTATIONS)) {
      expect(['moon', 'dwarf'], id).toContain(body(id as BodyId).kind);
      expect(r.raDeg, id).toBeGreaterThanOrEqual(0);
      expect(r.raDeg, id).toBeLessThan(360);
      expect(Math.abs(r.decDeg), id).toBeLessThanOrEqual(90);
      expect(Math.abs(r.wRateDegPerDay), id).toBeGreaterThan(0);
      expect(r.source.length, id).toBeGreaterThan(20);
    }
  });
  it('turns once per orbit for a moon and matches the catalog rotation period for a dwarf planet', () => {
    for (const [id, r] of Object.entries(ROTATIONS)) {
      const b = body(id as BodyId);
      const periodDays = 360 / Math.abs(r.wRateDegPerDay);
      if (b.kind === 'moon') expect(relDiff(periodDays, b.orbitPeriodDays!), id).toBeLessThan(0.005);
      else expect(relDiff(periodDays * 24, Math.abs(b.rotationPeriodH)), id).toBeLessThan(0.01);
    }
  });
});
