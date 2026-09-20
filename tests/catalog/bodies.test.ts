import { describe, expect, it } from 'vitest';
import { BODIES, BODY_IDS, getBody } from '../../src/catalog/bodies';

describe('catalog', () => {
  it('lists the Sun and eight planets in order', () => {
    expect(BODY_IDS).toEqual(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  });
  it('has unique ids and finite, positive physical values', () => {
    expect(new Set(BODIES.map((b) => b.id)).size).toBe(BODIES.length);
    for (const b of BODIES) {
      expect(b.radiusM, b.id).toBeGreaterThan(0);
      expect(b.massKg, b.id).toBeGreaterThan(0);
      expect(b.surfaceGravity, b.id).toBeGreaterThan(0);
      expect(b.meanTempK, b.id).toBeGreaterThan(0);
      expect(Number.isFinite(b.rotationPeriodH), b.id).toBe(true);
      expect(b.rotationPeriodH, b.id).not.toBe(0);
      expect(b.texture.length, b.id).toBeGreaterThan(0);
      expect(b.source.length, b.id).toBeGreaterThan(0);
    }
  });
  it('matches well-known values', () => {
    expect(getBody('earth').radiusM).toBeCloseTo(6_371_000, -3);
    expect(getBody('sun').radiusM).toBeCloseTo(695_700_000, -3);
    expect(getBody('jupiter').massKg / 1.898e27).toBeCloseTo(1, 2);
    expect(getBody('sun').kind).toBe('star');
    expect(getBody('earth').kind).toBe('planet');
  });
  it('marks retrograde rotators with negative periods', () => {
    expect(getBody('venus').rotationPeriodH).toBeLessThan(0);
    expect(getBody('uranus').rotationPeriodH).toBeLessThan(0);
    expect(getBody('earth').rotationPeriodH).toBeGreaterThan(0);
  });
});
