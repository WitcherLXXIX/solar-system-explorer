import { describe, expect, it } from 'vitest';
import { isSmallBodyKind, type BodyId } from '../../src/catalog/bodies';
import { SMALL_BODIES } from '../../src/catalog/smallBodies';
import { SMALL_BODY_ELEMENTS } from '../../src/catalog/smallBodyElements';
import { AU_M, G, SUN_GM_M3_S2 } from '../../src/units';
import { REFERENCE_ELEMENTS } from './smallBodiesReference';
import { NO_SECOND_SOURCE, SECOND_SOURCE } from './smallBodiesSecondSource';

/**
 * The ids this catalog file must hold. Quaoar, Orcus, Sedna and Gonggong were dropped: no radius is published on any allowed
 * domain (see docs/small-body-sources.md). Task 6 extends the list with the four comets.
 */
const EXPECTED_IDS: readonly BodyId[] = ['vesta', 'pallas', 'hygiea', 'juno'];
const relDiff = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
const wrapDeg = (d: number): number => ((d + 540) % 360) - 180;

describe('small-body catalog', () => {
  it('holds exactly the expected bodies, in order', () => {
    expect(SMALL_BODIES.map((b) => b.id)).toEqual([...EXPECTED_IDS]);
  });
  it('makes each a small body orbiting the Sun from SBDB elements, drawn in a plain colour', () => {
    for (const b of SMALL_BODIES) {
      expect(isSmallBodyKind(b.kind), b.id).toBe(true);
      expect(b.parent, b.id).toBe('sun');
      expect(b.orbitSource, b.id).toBe('elements');
      expect(SMALL_BODY_ELEMENTS[b.id], b.id).toBeDefined();
      expect(Object.keys(b.maps), b.id).toEqual([]);
      expect(b.orbitPeriodDays ?? 0, b.id).toBeGreaterThan(0);
      expect(b.radiusM, b.id).toBeGreaterThan(0);
      expect(b.source.length, b.id).toBeGreaterThan(30);
      expect(b.color, b.id).toMatch(/^#[0-9a-f]{6}$/);
      if (b.rotationPeriodH !== null) expect(Number.isFinite(b.rotationPeriodH) && b.rotationPeriodH !== 0, b.id).toBe(true);
    }
  });
  it('has exactly one element set per body and none for anything else', () => {
    expect(Object.keys(SMALL_BODY_ELEMENTS).sort()).toEqual(SMALL_BODIES.map((b) => b.id).sort());
    expect(Object.keys(REFERENCE_ELEMENTS).sort()).toEqual(SMALL_BODIES.map((b) => b.id).sort());
  });
  it('agrees with itself: gravity is G m / r^2, and no mass means no gravity', () => {
    for (const b of SMALL_BODIES) {
      if (b.massKg === null) {
        expect(b.surfaceGravity, b.id).toBeNull();
      } else {
        expect(relDiff(b.surfaceGravity!, (G * b.massKg) / b.radiusM ** 2), b.id).toBeLessThan(0.01);
      }
    }
  });
});

describe('small-body elements', () => {
  it('are elliptical, in the ecliptic, with sane angles and no precession', () => {
    for (const b of SMALL_BODIES) {
      const set = SMALL_BODY_ELEMENTS[b.id]!;
      const el = set.elements;
      expect(set.frame, b.id).toBe('ecliptic');
      expect(el.e, b.id).toBeGreaterThan(0);
      expect(el.e, b.id).toBeLessThan(1);
      expect(el.aKm, b.id).toBeGreaterThan(1e8);
      expect(el.iDeg, b.id).toBeGreaterThanOrEqual(0);
      expect(el.iDeg, b.id).toBeLessThanOrEqual(180);
      for (const angle of [el.nodeDeg, el.periDeg, el.meanAnomalyDeg]) {
        expect(angle, b.id).toBeGreaterThanOrEqual(0);
        expect(angle, b.id).toBeLessThan(360);
      }
      expect(el.meanMotionDegPerDay, b.id).toBeGreaterThan(0);
      expect(el.nodeRateDegPerYear, b.id).toBe(0);
      expect(el.periRateDegPerYear, b.id).toBe(0);
      expect(el.epochJd, b.id).toBeGreaterThan(2_400_000);
      expect(el.epochJd, b.id).toBeLessThan(2_500_000);
      expect(set.source.length, b.id).toBeGreaterThan(30);
    }
  });
  it('sit in the right region for their kind', () => {
    for (const b of SMALL_BODIES) {
      const aAu = (SMALL_BODY_ELEMENTS[b.id]!.elements.aKm * 1000) / AU_M;
      if (b.kind === 'asteroid') {
        expect(aAu, b.id).toBeGreaterThan(2);
        expect(aAu, b.id).toBeLessThan(3.5);
      }
      if (b.kind === 'tno') expect(aAu, b.id).toBeGreaterThan(30);
      if (b.kind === 'comet') expect(SMALL_BODY_ELEMENTS[b.id]!.elements.e, b.id).toBeGreaterThan(0.5);
    }
  });
  it('satisfy n * P = 360 (mean motion against the catalog period: two different SBDB fields)', () => {
    for (const b of SMALL_BODIES) {
      expect(relDiff(360 / SMALL_BODY_ELEMENTS[b.id]!.elements.meanMotionDegPerDay, b.orbitPeriodDays!), b.id).toBeLessThan(1e-5);
    }
  });
  it('satisfy Kepler\'s third law with the solar GM', () => {
    for (const b of SMALL_BODIES) {
      const a = SMALL_BODY_ELEMENTS[b.id]!.elements.aKm * 1000;
      const periodDays = (2 * Math.PI * Math.sqrt(a ** 3 / SUN_GM_M3_S2)) / 86_400;
      expect(relDiff(periodDays, b.orbitPeriodDays!), b.id).toBeLessThan(1e-4);
    }
  });
  it('agree with the independent SBDB fields q, tp, per and epoch', () => {
    for (const b of SMALL_BODIES) {
      const el = SMALL_BODY_ELEMENTS[b.id]!.elements;
      const ref = REFERENCE_ELEMENTS[b.id]!;
      expect(el.epochJd, b.id).toBe(ref.epochJd);
      expect(relDiff((el.aKm * 1000 * (1 - el.e)) / AU_M, ref.qAu), `${b.id} perihelion distance`).toBeLessThan(1e-6);
      expect(relDiff(ref.periodDays, b.orbitPeriodDays!), `${b.id} period`).toBeLessThan(1e-6);
      // Mean anomaly at the epoch must equal n (epoch - tp), modulo a full turn.
      const expected = el.meanMotionDegPerDay * (el.epochJd - ref.tpJd);
      expect(Math.abs(wrapDeg(el.meanAnomalyDeg - expected)), `${b.id} mean anomaly against the time of perihelion`).toBeLessThan(0.01 + 1e-8 * Math.abs(expected));
    }
  });
});

describe('second sources', () => {
  it('cover every body except at most three, with a stated reason for each exception', () => {
    for (const b of SMALL_BODIES) expect(SECOND_SOURCE[b.id] !== undefined || NO_SECOND_SOURCE[b.id] !== undefined, b.id).toBe(true);
    expect(Object.keys(NO_SECOND_SOURCE).length).toBeLessThanOrEqual(3);
    for (const reason of Object.values(NO_SECOND_SOURCE)) expect(reason.length).toBeGreaterThan(20);
  });
  it('agree with the catalog radius within 10% and the catalog period within 0.1%', () => {
    for (const [id, second] of Object.entries(SECOND_SOURCE)) {
      const b = SMALL_BODIES.find((x) => x.id === id);
      expect(b, id).toBeDefined();
      expect(second.source.length, id).toBeGreaterThan(20);
      if (second.radiusM !== undefined) expect(relDiff(b!.radiusM, second.radiusM), `${id} radius`).toBeLessThan(0.1);
      if (second.orbitPeriodDays !== undefined) expect(relDiff(b!.orbitPeriodDays!, second.orbitPeriodDays), `${id} period`).toBeLessThan(1e-3);
    }
  });
});

describe('wrapDeg (the helper the mean-anomaly check uses)', () => {
  it('wraps angles into (-180, 180]', () => {
    expect(wrapDeg(350)).toBeCloseTo(-10, 12);
    expect(wrapDeg(-350)).toBeCloseTo(10, 12);
    expect(wrapDeg(720)).toBeCloseTo(0, 12);
  });
});
