import { describe, expect, it } from 'vitest';
import { dmsToDegrees, hmsToHours, nearbyStarPositionM, skyToEcliptic, type StarSky } from '../../src/ephemeris/starPosition';
import { length, sub, type Vec3 } from '../../src/math';
import { AU_M, DEG, LIGHT_YEAR_M } from '../../src/units';

const lonDeg = (p: Vec3): number => ((Math.atan2(p[1], p[0]) / DEG) + 360) % 360;
const latDeg = (p: Vec3): number => Math.asin(p[2] / length(p)) / DEG;

const PROXIMA: StarSky = { ra: { h: 14, m: 29, s: 43.0 }, dec: { sign: -1, d: 62, m: 40, s: 46 }, distanceLy: 4.2465 };
const ALPHA_A: StarSky = { ra: { h: 14, m: 39, s: 36.5 }, dec: { sign: -1, d: 60, m: 50, s: 2 }, distanceLy: 4.3441 };
const ALPHA_B: StarSky = { ra: { h: 14, m: 39, s: 35.1 }, dec: { sign: -1, d: 60, m: 50, s: 14 }, distanceLy: 4.3441 };
const SIRIUS_A: StarSky = { ra: { h: 6, m: 45, s: 8.9 }, dec: { sign: -1, d: 16, m: 42, s: 58 }, distanceLy: 8.7094 };
const SIRIUS_B: StarSky = { ...SIRIUS_A, schematicOffsetNorthArcsec: 7.5 };
const CYGNI_A: StarSky = { ra: { h: 21, m: 6, s: 53.9 }, dec: { sign: 1, d: 38, m: 44, s: 58 }, distanceLy: 11.4039 };

describe('sexagesimal conversion', () => {
  it('turns hours, minutes, seconds into decimal hours', () => {
    expect(hmsToHours(14, 29, 43.0)).toBeCloseTo(14.495277777, 8);
    expect(hmsToHours(0, 0, 0)).toBe(0);
  });
  it('turns signed degrees, arcminutes, arcseconds into decimal degrees, the sign applying to the whole angle', () => {
    expect(dmsToDegrees(-1, 62, 40, 46)).toBeCloseTo(-62.679444444, 8);
    expect(dmsToDegrees(1, 4, 41, 36)).toBeCloseTo(4.693333333, 8);
    expect(dmsToDegrees(-1, 0, 30, 0)).toBeCloseTo(-0.5, 12); // a declination just below the equator keeps its sign
  });
});

describe('skyToEcliptic', () => {
  it('puts the vernal equinox on the ecliptic +x axis and the celestial pole at the ecliptic pole tilted by the obliquity', () => {
    const x = skyToEcliptic(0, 0, 10);
    expect(x[0]).toBeCloseTo(10, 9);
    expect(x[1]).toBeCloseTo(0, 9);
    expect(x[2]).toBeCloseTo(0, 9);
    const pole = skyToEcliptic(0, 90, 1);
    expect(pole[2]).toBeCloseTo(Math.cos(23.4392794 * DEG), 5); // the celestial pole is 23.44 degrees from the ecliptic pole
    expect(Math.hypot(pole[0], pole[1])).toBeCloseTo(Math.sin(23.4392794 * DEG), 5);
  });
  it('agrees with an independent rotation by the J2000 obliquity (Sirius, unit direction)', () => {
    const p = skyToEcliptic(hmsToHours(6, 45, 8.9), dmsToDegrees(-1, 16, 42, 58), 1);
    expect(p[0]).toBeCloseTo(-0.18745405, 5);
    expect(p[1]).toBeCloseTo(0.74730289, 5);
    expect(p[2]).toBeCloseTo(-0.6374946, 5);
  });
  it('keeps the requested distance', () => {
    expect(length(skyToEcliptic(3.3, 41.7, 4.02e16))).toBeCloseTo(4.02e16, 0);
  });
});

describe('nearbyStarPositionM', () => {
  it('places Sirius A at ecliptic longitude 104.08 and latitude -39.61 degrees, 8.7094 ly away', () => {
    const p = nearbyStarPositionM(SIRIUS_A);
    expect(lonDeg(p)).toBeCloseTo(104.0816, 3);
    expect(latDeg(p)).toBeCloseTo(-39.6052, 3);
    expect(length(p) / (8.7094 * LIGHT_YEAR_M)).toBeCloseTo(1, 12);
  });
  it('places Proxima Centauri at 4.017e16 m, longitude 239.11, latitude -44.76 (the nearest star)', () => {
    const p = nearbyStarPositionM(PROXIMA);
    expect(length(p)).toBeCloseTo(4.2465 * LIGHT_YEAR_M, -3);
    expect(length(p)).toBeGreaterThan(4.01e16);
    expect(length(p)).toBeLessThan(4.02e16);
    expect(lonDeg(p)).toBeCloseTo(239.1147, 3);
    expect(latDeg(p)).toBeCloseTo(-44.7632, 3);
    for (const [i, expected] of [-1.464255e16, -2.44802e16, -2.829038e16].entries()) expect(p[i]! / expected).toBeCloseTo(1, 6);
  });
  it('places 61 Cygni A, the farthest star, at 1.079e17 m, north of the ecliptic', () => {
    const p = nearbyStarPositionM(CYGNI_A);
    expect(length(p)).toBeCloseTo(11.4039 * LIGHT_YEAR_M, -3);
    expect(lonDeg(p)).toBeCloseTo(336.9567, 3);
    expect(latDeg(p)).toBeCloseTo(51.8992, 3);
  });
  it('separates Alpha Centauri A and B by about 21 AU (3.14e12 m) as two distinct points', () => {
    const a = nearbyStarPositionM(ALPHA_A);
    const b = nearbyStarPositionM(ALPHA_B);
    const separation = length(sub(a, b));
    expect(separation / 3.1424e12).toBeCloseTo(1, 3); // measured 3.142402e12 m = 21.006 AU
    expect(separation / AU_M).toBeGreaterThan(20);
    expect(separation / AU_M).toBeLessThan(22);
  });
  it('gives Sirius B a schematic 7.5 arcsecond offset so it is not on top of Sirius A (about 20 AU apart)', () => {
    const a = nearbyStarPositionM(SIRIUS_A);
    const b = nearbyStarPositionM(SIRIUS_B);
    const separation = length(sub(a, b));
    expect(separation / 2.99605e12).toBeCloseTo(1, 3); // measured 2.996050e12 m = 20.027 AU
    expect(length(b) / length(a)).toBeCloseTo(1, 6); // the offset moves the direction, not the distance
    expect(length(sub(nearbyStarPositionM({ ...SIRIUS_A }), a))).toBe(0); // no offset field, no shift
  });
  it('does not move with time: there is no date argument at all', () => {
    expect(nearbyStarPositionM(PROXIMA)).toEqual(nearbyStarPositionM(PROXIMA));
  });
});
