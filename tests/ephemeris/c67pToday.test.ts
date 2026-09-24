import { describe, expect, it } from 'vitest';
import { bodyRelativePosition } from '../../src/ephemeris/ephemeris';
import { dot, length, type Vec3 } from '../../src/math';
import { AU_M, DEG } from '../../src/units';
import { dateFromTdbJd } from './testDates';

/**
 * 67P at JD 2461304.5 TDB (2026-09-21), the app's present day. The pair was dropped from the Horizons reference set because it is
 * outside the 5 degree / 3 percent ceiling; this test records how far outside, so the README figure is backed by a check.
 * JPL Horizons vector table, record 90000703 (epoch 2457305.5, the SBDB epoch of the stored elements), heliocentric ecliptic
 * J2000, km, fetched once on 2026-09-24 via ssd.jpl.nasa.gov/api/horizons.api (not fetched twice like the main reference set).
 */
const HORIZONS_KM: Vec3 = [-1.552063062819442e7, -6.805903158071359e8, -3.645234501669222e7];

describe('67P today (a known two-body failure, disclosed in the README)', () => {
  it('is off Horizons by about 1.35 degrees in direction and about 6 percent in distance', () => {
    const horizons: Vec3 = [HORIZONS_KM[0] * 1000, HORIZONS_KM[1] * 1000, HORIZONS_KM[2] * 1000];
    const model = bodyRelativePosition('c67p', dateFromTdbJd(2461304.5));
    const angle = Math.acos(dot(horizons, model) / (length(horizons) * length(model))) / DEG;
    const distance = length(model) / length(horizons) - 1;
    expect(angle).toBeGreaterThan(1.3);
    expect(angle).toBeLessThan(1.4);
    expect(distance).toBeGreaterThan(0.055);
    expect(distance).toBeLessThan(0.065);
    expect(length(horizons) / AU_M).toBeCloseTo(4.557, 2);
  });
});
