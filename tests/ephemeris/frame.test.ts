import { describe, expect, it } from 'vitest';
import { BODY_IDS } from '../../src/catalog/bodies';
import { computeFrame } from '../../src/ephemeris/frame';

describe('computeFrame', () => {
  it('has an entry for every body with finite numbers', () => {
    const frame = computeFrame(new Date('2026-09-20T12:00:00Z'));
    for (const id of BODY_IDS) {
      const entry = frame[id];
      expect(entry.position.every(Number.isFinite), id).toBe(true);
      expect(entry.orientation.every((axis) => axis.every(Number.isFinite)), id).toBe(true);
    }
    expect(Math.hypot(...frame.sun.position)).toBeLessThan(1);
  });
});
