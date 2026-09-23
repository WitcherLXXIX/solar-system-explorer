import {
  Body, HelioVector, MakeTime, PlanetOrbitalPeriod, RotateVector, Rotation_EQD_EQJ, Rotation_EQJ_ECL,
  RotationAxis, SiderealTime, Vector,
} from 'astronomy-engine';
import { getBody, type BodyId } from '../catalog/bodies';
import { ROTATIONS } from '../catalog/orbits';
import { add, rotX, rotZ, type Mat3, type Vec3 } from '../math';
import { AU_M, DAY_S, DEG } from '../units';
import { iauOrientation } from './iau';
import { assumedOrientation, lockedOrientation, relativeVelocity } from './locked';
import { aeSatelliteRelative, elementRelative, isAeSatellite } from './moons';

/** Bodies whose heliocentric position astronomy-engine computes directly: the Sun, the planets and Pluto. */
const AE_HELIO: Partial<Record<BodyId, Body>> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

/** Bodies with an astronomy-engine IAU rotation model: those above and the Moon. */
const AE_ROTATION: Partial<Record<BodyId, Body>> = { ...AE_HELIO, moon: Body.Moon };

const EQJ_TO_ECL = Rotation_EQJ_ECL();

/** Position in metres relative to the body's parent (ecliptic J2000). The Sun is the origin; planets and dwarf planets are heliocentric. */
export function bodyRelativePosition(id: BodyId, date: Date): Vec3 {
  const helio = AE_HELIO[id];
  if (helio !== undefined) {
    const v = RotateVector(EQJ_TO_ECL, HelioVector(helio, date));
    return [v.x * AU_M, v.y * AU_M, v.z * AU_M];
  }
  return isAeSatellite(id) ? aeSatelliteRelative(id, date) : elementRelative(id, date);
}

/** Heliocentric position in metres, ecliptic J2000 frame: the parent chain summed in float64. */
export function bodyPosition(id: BodyId, date: Date): Vec3 {
  const parent = getBody(id).parent;
  const relative = bodyRelativePosition(id, date);
  return parent === null || parent === 'sun' ? relative : add(bodyPosition(parent, date), relative);
}

/**
 * Body axes in the ecliptic frame (columns x, y, z; z = north pole, x = prime meridian on the equator).
 *
 * The Sun, planets, Pluto and the Moon use the IAU rotation model from astronomy-engine's RotationAxis:
 * R = Rz(alpha + 90 deg) * Rx(90 deg - delta) * Rz(W), body-fixed to EQJ, then EQJ to ecliptic.
 *
 * Earth is special-cased. Its pole is only about 8 arcseconds from the celestial pole, so the right
 * ascension that RotationAxis reports is ill-conditioned and the frame built from it was measured to be
 * 134 degrees off at J2000 and drifting. Instead Earth's prime meridian (Greenwich) is placed from
 * Greenwich apparent sidereal time in the true equator of date, then rotated to EQJ and the ecliptic.
 *
 * Every other moon and dwarf planet uses its bundled IAU constants when they exist (linear terms only). Without them a
 * moon is treated as tidally locked (prime meridian toward the parent, pole along the orbit normal), and a dwarf planet
 * spins about the ecliptic north pole at its catalog rotation period (its true pole is unknown or unbundled).
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

  const aeBody = AE_ROTATION[id];
  if (aeBody !== undefined) {
    const axis = RotationAxis(aeBody, date);
    const alpha = axis.ra * 15 * DEG; // astronomy-engine gives right ascension in sidereal hours
    const delta = axis.dec * DEG;
    const w = axis.spin * DEG;
    const column = (e: Vec3): Vec3 =>
      toEcliptic(rotZ(rotX(rotZ(e, w), Math.PI / 2 - delta), alpha + Math.PI / 2));
    return [column([1, 0, 0]), column([0, 1, 0]), column([0, 0, 1])];
  }

  const rotation = ROTATIONS[id];
  if (rotation) return iauOrientation(rotation, time.tt);
  const data = getBody(id);
  if (data.kind === 'moon') {
    const at = (dtS: number): Vec3 => bodyRelativePosition(id, new Date(date.getTime() + dtS * 1000));
    return lockedOrientation(at(0), relativeVelocity(at));
  }
  // An unknown spin (comets, some trans-Neptunian objects) keeps the ecliptic axes fixed rather than inventing a period.
  if (data.rotationPeriodH === null) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return assumedOrientation(data.rotationPeriodH, time.tt);
}

/** Orbital period in days: astronomy-engine for the planets and Pluto, the catalog value for moons and other dwarf planets, null for the Sun. */
export function orbitalPeriodDays(id: BodyId): number | null {
  if (id === 'sun') return null;
  const helio = AE_HELIO[id];
  return helio !== undefined ? PlanetOrbitalPeriod(helio) : getBody(id).orbitPeriodDays ?? null;
}

/** `count` positions (xyz triples, metres, relative to the parent) evenly spaced in time over one orbital period from `start`. */
export function sampleOrbit(id: BodyId, start: Date, count: number): Float64Array {
  const period = orbitalPeriodDays(id);
  if (period === null) throw new Error(`${id} has no orbit to sample`);
  const out = new Float64Array(count * 3);
  for (let k = 0; k < count; k++) {
    const date = new Date(start.getTime() + (k / count) * period * DAY_S * 1000);
    out.set(bodyRelativePosition(id, date), 3 * k);
  }
  return out;
}
