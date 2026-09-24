import { MakeTime, RotateVector, Rotation_EQJ_ECL, Vector } from 'astronomy-engine';
import type { Vec3 } from '../math';
import { DEG, LIGHT_YEAR_M } from '../units';

/** Where a star is in the sky, as the catalog stores it: J2000 equatorial coordinates and a distance. */
export interface StarSky {
  ra: { h: number; m: number; s: number };
  /** The sign applies to the whole angle (so -0 degrees 30 arcminutes is south of the equator). */
  dec: { sign: 1 | -1; d: number; m: number; s: number };
  distanceLy: number;
  /**
   * A schematic display shift toward the north celestial pole, in arcseconds, for a companion whose catalog position is the
   * same as its partner's (Sirius B). Not part of the sourced table; see the plan's Ruling 3.
   */
  schematicOffsetNorthArcsec?: number;
}

/** The same equatorial-to-ecliptic rotation the ephemeris code uses for every body (constant, so the time stamp is irrelevant). */
const EQJ_TO_ECL = Rotation_EQJ_ECL();
const J2000 = MakeTime(new Date(Date.UTC(2000, 0, 1, 12)));

export const hmsToHours = (h: number, m: number, s: number): number => h + m / 60 + s / 3600;

export const dmsToDegrees = (sign: 1 | -1, d: number, m: number, s: number): number => sign * (d + m / 60 + s / 3600);

/** Right ascension (hours) and declination (degrees), J2000, plus a distance in metres, to a heliocentric ecliptic J2000 position in metres. */
export function skyToEcliptic(raHours: number, decDeg: number, distanceM: number): Vec3 {
  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;
  const v = RotateVector(EQJ_TO_ECL, new Vector(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec), J2000));
  return [v.x * distanceM, v.y * distanceM, v.z * distanceM];
}

/** A catalog star's heliocentric position in metres (ecliptic J2000). Fixed: the twelve stars' own motion is invisible over 1700-2300. */
export function nearbyStarPositionM(star: StarSky): Vec3 {
  const decDeg = dmsToDegrees(star.dec.sign, star.dec.d, star.dec.m, star.dec.s) + (star.schematicOffsetNorthArcsec ?? 0) / 3600;
  return skyToEcliptic(hmsToHours(star.ra.h, star.ra.m, star.ra.s), decDeg, star.distanceLy * LIGHT_YEAR_M);
}

/**
 * The unit direction (ecliptic J2000 axes) of a sky object from its J2000 right ascension (hours) and declination (degrees).
 * The night sky's stars use only this: their real direction, not their real distance.
 */
export function raDecToDirection(raHours: number, decDeg: number): Vec3 {
  return skyToEcliptic(raHours, decDeg, 1);
}
