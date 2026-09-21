import {
  Body, HelioVector, MakeTime, PlanetOrbitalPeriod, RotateVector, Rotation_EQD_EQJ, Rotation_EQJ_ECL,
  RotationAxis, SiderealTime, Vector,
} from 'astronomy-engine';
import type { BodyId } from '../catalog/bodies';
import { rotX, rotZ, type Mat3, type Vec3 } from '../math';
import { AU_M, DAY_S, DEG } from '../units';

const AE_BODY: Record<BodyId, Body> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

const EQJ_TO_ECL = Rotation_EQJ_ECL();

/** Heliocentric position in metres, ecliptic J2000 frame. */
export function bodyPosition(id: BodyId, date: Date): Vec3 {
  const v = RotateVector(EQJ_TO_ECL, HelioVector(AE_BODY[id], date));
  return [v.x * AU_M, v.y * AU_M, v.z * AU_M];
}

/**
 * Body axes in the ecliptic frame (columns x, y, z; z = north pole, x = prime meridian on the equator).
 *
 * Most bodies use the IAU rotation model from astronomy-engine's RotationAxis:
 * R = Rz(alpha + 90 deg) * Rx(90 deg - delta) * Rz(W), body-fixed to EQJ, then EQJ to ecliptic.
 *
 * Earth is special-cased. Its pole is only about 8 arcseconds from the celestial pole, so the right
 * ascension that RotationAxis reports is ill-conditioned and the frame built from it was measured to be
 * 134 degrees off at J2000 and drifting. Instead Earth's prime meridian (Greenwich) is placed from
 * Greenwich apparent sidereal time in the true equator of date, then rotated to EQJ and the ecliptic.
 */
export function bodyOrientation(id: BodyId, date: Date): Mat3 {
  const time = MakeTime(date);
  const toEcliptic = (eqj: Vec3): Vec3 => {
    const r = RotateVector(EQJ_TO_ECL, new Vector(eqj[0], eqj[1], eqj[2], time));
    return [r.x, r.y, r.z];
  };

  if (id === 'earth') {
    const gast = SiderealTime(time) * 15 * DEG; // hours to degrees to radians
    const eqdToEqj = Rotation_EQD_EQJ(time);
    const column = (e: Vec3): Vec3 => {
      const eqd = rotZ(e, gast);
      const eqj = RotateVector(eqdToEqj, new Vector(eqd[0], eqd[1], eqd[2], time));
      return toEcliptic([eqj.x, eqj.y, eqj.z]);
    };
    return [column([1, 0, 0]), column([0, 1, 0]), column([0, 0, 1])];
  }

  const axis = RotationAxis(AE_BODY[id], date);
  const alpha = axis.ra * 15 * DEG; // astronomy-engine gives right ascension in sidereal hours
  const delta = axis.dec * DEG;
  const w = axis.spin * DEG;
  const column = (e: Vec3): Vec3 =>
    toEcliptic(rotZ(rotX(rotZ(e, w), Math.PI / 2 - delta), alpha + Math.PI / 2));
  return [column([1, 0, 0]), column([0, 1, 0]), column([0, 0, 1])];
}

export function orbitalPeriodDays(id: BodyId): number | null {
  return id === 'sun' ? null : PlanetOrbitalPeriod(AE_BODY[id]);
}

/** `count` positions (xyz triples, metres) evenly spaced in time over one orbital period from `start`. */
export function sampleOrbit(id: BodyId, start: Date, count: number): Float64Array {
  const period = orbitalPeriodDays(id);
  if (period === null) throw new Error(`${id} has no orbit to sample`);
  const out = new Float64Array(count * 3);
  for (let k = 0; k < count; k++) {
    const date = new Date(start.getTime() + (k / count) * period * DAY_S * 1000);
    out.set(bodyPosition(id, date), 3 * k);
  }
  return out;
}
