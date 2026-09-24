import { describe, expect, it } from 'vitest';
import { BODIES, BODY_IDS, getBody } from '../../src/catalog/bodies';
import { bodyPosition } from '../../src/ephemeris/ephemeris';
import { computeFrame } from '../../src/ephemeris/frame';
import { length, sub } from '../../src/math';
import { LIGHT_YEAR_M } from '../../src/units';

const DATE = new Date('2026-09-20T12:00:00Z');

describe('computeFrame', () => {
  it('puts every star at its fixed catalog position: 4.2465 to 11.4039 ly from the Sun, and the same at 1700, 2026 and 2300', () => {
    const stars = BODIES.filter((b) => b.kind === 'nearstar');
    expect(stars).toHaveLength(12);
    const early = computeFrame(new Date('1700-01-01T00:00:00Z'));
    const now = computeFrame(DATE);
    const late = computeFrame(new Date('2300-12-31T00:00:00Z'));
    for (const star of stars) {
      const distanceLy = length(now[star.id].position) / LIGHT_YEAR_M;
      expect(distanceLy, star.id).toBeGreaterThan(4.24);
      expect(distanceLy, star.id).toBeLessThan(11.41);
      expect(early[star.id].position, star.id).toEqual(now[star.id].position);
      expect(late[star.id].position, star.id).toEqual(now[star.id].position);
      expect(now[star.id].orientation.every((axis) => axis.every(Number.isFinite)), star.id).toBe(true);
    }
    expect(length(now.proxima.position) / LIGHT_YEAR_M).toBeCloseTo(4.2465, 9);
    expect(length(now.cygni61a.position) / LIGHT_YEAR_M).toBeCloseTo(11.4039, 9);
  });
  it('has an entry for every body with finite numbers', () => {
    const frame = computeFrame(DATE);
    expect(BODY_IDS).toHaveLength(55);
    for (const id of BODY_IDS) {
      const entry = frame[id];
      expect(entry.position.every(Number.isFinite), id).toBe(true);
      expect(entry.orientation.every((axis) => axis.every(Number.isFinite)), id).toBe(true);
    }
    expect(Math.hypot(...frame.sun.position)).toBeLessThan(1);
  });
  it('lists every parent before its children', () => {
    BODIES.forEach((b, index) => {
      if (b.parent !== null) expect(BODIES.findIndex((p) => p.id === b.parent), b.id).toBeLessThan(index);
    });
  });
  it('equals the heliocentric parent-chain sum for every body', () => {
    const frame = computeFrame(DATE);
    for (const id of BODY_IDS) expect(frame[id].position, id).toEqual(bodyPosition(id, DATE));
  });
  it('keeps every moon outside its parent\'s surface and within 1e10 m of it', () => {
    const frame = computeFrame(DATE);
    for (const b of BODIES.filter((x) => x.kind === 'moon')) {
      const d = length(sub(frame[b.id].position, frame[b.parent!].position));
      expect(d, b.id).toBeGreaterThan(getBody(b.parent!).radiusM);
      expect(d, b.id).toBeLessThan(1e10);
    }
  });
  it('places the dwarf planets at plausible heliocentric distances (2 to 100 AU)', () => {
    const frame = computeFrame(DATE);
    for (const id of ['pluto', 'ceres', 'eris', 'haumea', 'makemake'] as const) {
      const au = length(frame[id].position) / 149_597_870_700;
      expect(au, id).toBeGreaterThan(2);
      expect(au, id).toBeLessThan(100);
    }
  });
});
