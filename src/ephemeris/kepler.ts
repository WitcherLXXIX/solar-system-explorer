import { cross, type Mat3, type Vec3 } from '../math';
import { DAYS_PER_YEAR, DEG } from '../units';

const TWO_PI = 2 * Math.PI;

/**
 * Solves Kepler's equation M = E - e sin E for the eccentric anomaly E (radians, in [-pi, pi]) by Newton iteration.
 * The mean anomaly may be any number of turns away. Only elliptical orbits (0 <= e < 1) are supported.
 */
export function solveKepler(meanAnomaly: number, e: number): number {
  if (!(e >= 0 && e < 1)) throw new Error(`eccentricity ${e} is not elliptical`);
  const m = meanAnomaly - TWO_PI * Math.round(meanAnomaly / TWO_PI);
  let big = e < 0.8 ? m : Math.sign(m) * Math.PI; // pi is a safe start for very eccentric orbits
  for (let i = 0; i < 60; i++) {
    const step = (big - e * Math.sin(big) - m) / (1 - e * Math.cos(big));
    big -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return big;
}

/**
 * `count` time offsets in days, from now, that step the ECCENTRIC anomaly evenly through one whole orbit starting at the
 * body's current position (the first offset is 0). Sampling an orbit evenly in time crowds the samples at the far end of a
 * very eccentric orbit and leaves long straight chords at perihelion; even steps in eccentric anomaly are dense where the
 * orbit curves. `meanAnomalyRad` is the mean anomaly now and `meanMotionRadPerDay` the mean anomaly rate.
 */
export function eccentricSampleDays(meanAnomalyRad: number, e: number, meanMotionRadPerDay: number, count: number): Float64Array {
  const e0 = solveKepler(meanAnomalyRad, e);
  const m0 = e0 - e * Math.sin(e0);
  const out = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    const big = e0 + (TWO_PI * k) / count;
    out[k] = (big - e * Math.sin(big) - m0) / meanMotionRadPerDay;
  }
  return out;
}

/** A mean-element orbit: angles in degrees, epoch as a Julian date in TDB, precession rates in degrees per Julian year (signed). */
export interface OrbitalElements {
  epochJd: number;
  aKm: number;
  e: number;
  iDeg: number;
  /** Longitude of the ascending node, measured in the reference plane from its ascending node on the J2000 equator. */
  nodeDeg: number;
  /** Argument of periapsis, measured from the ascending node. */
  periDeg: number;
  meanAnomalyDeg: number;
  meanMotionDegPerDay: number;
  nodeRateDegPerYear: number;
  periRateDegPerYear: number;
}

/** Position (metres) relative to the parent, in the frame of the element reference plane, at Julian date `jd` (TDB). */
export function planePosition(el: OrbitalElements, jd: number): Vec3 {
  const days = jd - el.epochJd;
  const years = days / DAYS_PER_YEAR;
  const anomaly = (el.meanAnomalyDeg + el.meanMotionDegPerDay * days) * DEG;
  const node = (el.nodeDeg + el.nodeRateDegPerYear * years) * DEG;
  const peri = (el.periDeg + el.periRateDegPerYear * years) * DEG;
  const inc = el.iDeg * DEG;
  const a = el.aKm * 1000;
  const big = solveKepler(anomaly, el.e);
  // Position in the orbit plane, x toward periapsis.
  const px = a * (Math.cos(big) - el.e);
  const py = a * Math.sqrt(1 - el.e * el.e) * Math.sin(big);
  // Turn by the argument of periapsis, tilt by the inclination, turn by the node (z-x-z Euler rotation).
  const cw = Math.cos(peri);
  const sw = Math.sin(peri);
  const x1 = cw * px - sw * py;
  const y1 = sw * px + cw * py;
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const y2 = ci * y1;
  const z2 = si * y1;
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  return [cn * x1 - sn * y2, sn * x1 + cn * y2, z2];
}

/**
 * The axes of a reference plane in the J2000 equatorial frame, as three columns: z is the plane's pole (right ascension
 * and declination in degrees), x is the plane's ascending node on the equator (right ascension of the pole + 90 degrees),
 * y = z cross x. This is how JPL's satellite mean elements measure their node angle.
 */
export function poleFrame(poleRaDeg: number, poleDecDeg: number): Mat3 {
  const ra = poleRaDeg * DEG;
  const dec = poleDecDeg * DEG;
  const z: Vec3 = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const x: Vec3 = [-Math.sin(ra), Math.cos(ra), 0];
  return [x, cross(z, x), z];
}
