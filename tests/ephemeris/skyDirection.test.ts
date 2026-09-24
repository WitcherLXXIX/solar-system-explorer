import { describe, expect, it } from 'vitest';
import { NEARBY_STARS } from '../../src/catalog/stars';
import { dmsToDegrees, hmsToHours, nearbyStarPositionM, raDecToDirection } from '../../src/ephemeris/starPosition';
import { length } from '../../src/math';

describe('raDecToDirection', () => {
  it('points the vernal equinox (RA 0, Dec 0) along ecliptic +x', () => {
    const v = raDecToDirection(0, 0);
    expect(v[0]).toBeCloseTo(1, 12);
    expect(v[1]).toBeCloseTo(0, 12);
    expect(v[2]).toBeCloseTo(0, 12);
  });
  it('puts the north celestial pole one obliquity from the ecliptic pole', () => {
    const v = raDecToDirection(0, 90);
    expect(v[0]).toBeCloseTo(0, 12);
    expect(v[1]).toBeCloseTo(0.3977769691, 9);
    expect(v[2]).toBeCloseTo(0.9174821431, 9);
  });
  it('puts RA 6 h, Dec 0 on the ecliptic y-z plane, tilted the other way', () => {
    const v = raDecToDirection(6, 0);
    expect(v[0]).toBeCloseTo(0, 12);
    expect(v[1]).toBeCloseTo(0.9174821431, 9);
    expect(v[2]).toBeCloseTo(-0.3977769691, 9);
  });
  it('places Sirius (CSV row) at a known ecliptic direction', () => {
    const v = raDecToDirection(6.752481, -16.716116);
    expect(v[0]).toBeCloseTo(-0.187456207, 8);
    expect(v[1]).toBeCloseTo(0.747302573, 8);
    expect(v[2]).toBeCloseTo(-0.637494341, 8);
  });
  it('always returns a unit vector', () => {
    for (const [ra, dec] of [[0, 0], [12.3, 45], [23.99, -89.9], [5.5, 0.001]] as const) {
      expect(length(raDecToDirection(ra, dec))).toBeCloseTo(1, 12);
    }
  });
  it('is the same conversion phase 4 uses for the nearby stars (direction of Sirius A)', () => {
    const sirius = NEARBY_STARS.find((s) => s.id === 'siriusa')!;
    const position = nearbyStarPositionM(sirius);
    const d = length(position);
    const direction = raDecToDirection(
      hmsToHours(sirius.ra.h, sirius.ra.m, sirius.ra.s), dmsToDegrees(sirius.dec.sign, sirius.dec.d, sirius.dec.m, sirius.dec.s),
    );
    expect(direction[0]).toBeCloseTo(position[0] / d, 12);
    expect(direction[1]).toBeCloseTo(position[1] / d, 12);
    expect(direction[2]).toBeCloseTo(position[2] / d, 12);
  });
});
