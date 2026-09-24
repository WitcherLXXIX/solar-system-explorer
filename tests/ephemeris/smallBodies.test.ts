import { describe, expect, it } from 'vitest';
import { BODIES, getBody, type BodyId } from '../../src/catalog/bodies';
import { SMALL_BODIES } from '../../src/catalog/smallBodies';
import { SMALL_BODY_ELEMENTS } from '../../src/catalog/smallBodyElements';
import { bodyOrientation, bodyPosition, bodyRelativePosition, orbitalPeriodDays, sampleOrbit } from '../../src/ephemeris/ephemeris';
import { computeFrame } from '../../src/ephemeris/frame';
import { dot, length, sub, type Vec3 } from '../../src/math';
import { AU_M, DEG } from '../../src/units';
import { REFERENCE_ELEMENTS } from '../catalog/smallBodiesReference';
import { REFERENCE_EPOCHS_JD } from './horizonsReference';
import { SMALL_BODY_STATES } from './smallBodiesReference';
import { dateFromTdbJd } from './testDates';

const IDS = SMALL_BODIES.map((b) => b.id);
const elements = (id: BodyId) => SMALL_BODY_ELEMENTS[id]!.elements;
const angleDeg = (a: Vec3, b: Vec3): number => Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (length(a) * length(b))))) / DEG;

describe('the catalog with the small bodies joined', () => {
  it('has 43 bodies with every parent before its children and the eight small bodies last', () => {
    expect(BODIES).toHaveLength(43);
    expect(BODIES.slice(-IDS.length).map((b) => b.id)).toEqual(IDS);
    expect(IDS).toHaveLength(8);
    const seen = new Set<BodyId>();
    for (const b of BODIES) {
      if (b.parent !== null) expect(seen.has(b.parent), b.id).toBe(true);
      seen.add(b.id);
    }
  });
  it('reports each small body\'s period from the catalog', () => {
    for (const id of IDS) expect(orbitalPeriodDays(id)).toBe(getBody(id).orbitPeriodDays);
  });
});

describe('small-body positions', () => {
  it('stay finite and between perihelion and aphelion at today and 500 years either side', () => {
    for (const iso of ['1526-09-23T00:00:00Z', '2026-09-23T00:00:00Z', '2526-09-23T00:00:00Z']) {
      for (const id of IDS) {
        const el = elements(id);
        const q = el.aKm * 1000 * (1 - el.e);
        const big = el.aKm * 1000 * (1 + el.e);
        const r = length(bodyRelativePosition(id, new Date(iso)));
        expect(Number.isFinite(r), `${id} ${iso}`).toBe(true);
        expect(r, `${id} ${iso}`).toBeGreaterThanOrEqual(q * (1 - 1e-9));
        expect(r, `${id} ${iso}`).toBeLessThanOrEqual(big * (1 + 1e-9));
      }
    }
  });
  it('are at their perihelion distance at the SBDB time of perihelion (a physics check that needs no Horizons)', () => {
    for (const id of IDS) {
      const ref = REFERENCE_ELEMENTS[id]!;
      const r = length(bodyRelativePosition(id, dateFromTdbJd(ref.tpJd))) / AU_M;
      expect(Math.abs(r - ref.qAu) / ref.qAu, id).toBeLessThan(1e-5);
    }
  });
  it('are heliocentric: a small body\'s world position is its relative position', () => {
    const date = new Date('2026-09-23T00:00:00Z');
    for (const id of IDS) expect(bodyPosition(id, date)).toEqual(bodyRelativePosition(id, date));
  });
});

describe('small-body orbit lines', () => {
  const start = new Date('2026-09-23T00:00:00Z');
  it('start at the body and stay on the orbit', () => {
    for (const id of IDS) {
      const samples = sampleOrbit(id, start, 720);
      const now = bodyRelativePosition(id, start);
      expect(length(sub([samples[0]!, samples[1]!, samples[2]!], now)), id).toBeLessThan(1);
      const el = elements(id);
      const q = el.aKm * 1000 * (1 - el.e);
      const big = el.aKm * 1000 * (1 + el.e);
      for (let k = 0; k < 720; k++) {
        const r = Math.hypot(samples[3 * k]!, samples[3 * k + 1]!, samples[3 * k + 2]!);
        expect(r, `${id} sample ${k}`).toBeGreaterThanOrEqual(q * (1 - 1e-9));
        expect(r, `${id} sample ${k}`).toBeLessThanOrEqual(big * (1 + 1e-9));
      }
    }
  });
  it('leave no long chords, even for the most eccentric comets', () => {
    // Bound 0.03 of the semi-major axis: even 720 steps in eccentric anomaly give about 0.0087 a at e = 0.967 (Task 1), so this
    // has room; measured worst case over the eight bodies: 0.008727 a (2026-09-23).
    for (const id of IDS) {
      const samples = sampleOrbit(id, start, 720);
      let worst = 0;
      for (let k = 0; k < 720; k++) {
        const j = (k + 1) % 720;
        worst = Math.max(worst, Math.hypot(samples[3 * k]! - samples[3 * j]!, samples[3 * k + 1]! - samples[3 * j + 1]!, samples[3 * k + 2]! - samples[3 * j + 2]!));
      }
      expect(worst / (elements(id).aKm * 1000), id).toBeLessThan(0.03);
    }
  });
});

describe('small-body orientation', () => {
  it('is always an orthonormal right-handed frame, also when the spin is unknown (fixed ecliptic axes)', () => {
    for (const id of IDS) {
      const [x, y, z] = bodyOrientation(id, new Date('2026-09-23T00:00:00Z'));
      for (const axis of [x, y, z]) expect(length(axis), id).toBeCloseTo(1, 9);
      expect(Math.abs(dot(x, y)), id).toBeLessThan(1e-9);
      expect(Math.abs(dot(x, z)), id).toBeLessThan(1e-9);
      expect(Math.abs(dot(y, z)), id).toBeLessThan(1e-9);
    }
    for (const b of SMALL_BODIES.filter((x) => x.rotationPeriodH === null)) {
      expect(bodyOrientation(b.id, new Date('2026-09-23T00:00:00Z'))).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    }
  });
  it('is computed for the whole frame', () => {
    const frame = computeFrame(new Date('2026-09-23T00:00:00Z'));
    for (const id of IDS) expect(frame[id].position.every(Number.isFinite), id).toBe(true);
  });
});

/**
 * Horizons comparison. Two-body motion from the SBDB osculating epoch ignores planetary perturbations (and, for comets,
 * outgassing), so the error grows with the time from the epoch. The bounds below are MEASURED (fill each in from the run,
 * with the date it was measured at), then set to the measured worst case plus a small margin; they are disclosed in the
 * README. CEILING: if any (body, date) pair is worse than 5 degrees of heliocentric direction or 3% in distance, do not
 * loosen the bound: drop that pair from `smallBodiesReference.ts` with a comment saying it is outside two-body validity,
 * and record a Ruling.
 */
const DEFAULT_PHASE_BOUND_DEG = 1;
const DEFAULT_DISTANCE_BOUND = 0.01;
// Measured 2026-09-24 over the committed epochs (worst angle deg / worst distance ratio, and where), bound = worst plus about 20%
// (Juno's angle bound stays under the 5 degree ceiling). Pairs beyond the ceiling were dropped from smallBodiesReference.ts.
const PHASE_BOUND_DEG: Partial<Record<BodyId, number>> = {
  vesta: 1.75, // 1.4395 at JD 2442413.5
  pallas: 4.3, // 3.5682 at JD 2442413.5
  hygiea: 3.8, // 3.1199 at JD 2457023.5
  juno: 4.9, // 4.5719 at JD 2442413.5
  halley: 0.35, // 0.2883 at JD 2451545.0
  halebopp: 0.8, // 0.6554 at JD 2442413.5
  c67p: 2.7, // 2.2237 at JD 2451545.0
  swifttuttle: 0.26, // 0.2153 at JD 2442413.5
};
const DISTANCE_BOUND: Partial<Record<BodyId, number>> = {
  vesta: 4.5e-3, // 3.711e-3 at JD 2442413.5
  pallas: 2.2e-3, // 1.793e-3 at JD 2442413.5
  hygiea: 1.9e-2, // 1.544e-2 at JD 2469807.5
  juno: 1.1e-2, // 9.165e-3 at JD 2442413.5
  halley: 2.6e-2, // 2.114e-2 at JD 2469807.5
  halebopp: 1.05e-2, // 8.617e-3 at JD 2442413.5
  c67p: 8.5e-3, // 6.922e-3 at JD 2455197.5
  swifttuttle: 3.5e-3, // 2.891e-3 at JD 2442413.5
};

describe('small bodies against Horizons (heliocentric, ecliptic J2000)', () => {
  it('has at least three reference epochs for every body', () => {
    for (const id of IDS) expect(SMALL_BODY_STATES.filter((s) => s.id === id).length, id).toBeGreaterThanOrEqual(3);
    for (const s of SMALL_BODY_STATES) expect(s.center).toBe('sun');
    expect(REFERENCE_EPOCHS_JD.length).toBeGreaterThanOrEqual(3);
  });
  it('stays within the measured bounds at every reference epoch', () => {
    for (const s of SMALL_BODY_STATES) {
      const ours = bodyRelativePosition(s.id, dateFromTdbJd(s.jdTdb));
      const ref: Vec3 = [s.positionKm[0] * 1000, s.positionKm[1] * 1000, s.positionKm[2] * 1000];
      expect(angleDeg(ours, ref), `${s.id} at ${s.jdTdb}`).toBeLessThan(PHASE_BOUND_DEG[s.id] ?? DEFAULT_PHASE_BOUND_DEG);
      expect(Math.abs(length(ours) - length(ref)) / length(ref), `${s.id} distance at ${s.jdTdb}`).toBeLessThan(DISTANCE_BOUND[s.id] ?? DEFAULT_DISTANCE_BOUND);
    }
  });
});
