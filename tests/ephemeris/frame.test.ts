import { describe, expect, it } from 'vitest';
import { BODIES, BODY_IDS, getBody } from '../../src/catalog/bodies';
import { bodyPosition } from '../../src/ephemeris/ephemeris';
import { computeFrame } from '../../src/ephemeris/frame';
import { length, sub } from '../../src/math';

const DATE = new Date('2026-09-20T12:00:00Z');

describe('computeFrame', () => {
  it('has an entry for every body with finite numbers', () => {
    const frame = computeFrame(DATE);
    expect(BODY_IDS).toHaveLength(43);
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
