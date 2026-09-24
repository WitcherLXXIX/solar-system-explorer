import { GeoMoon, JupiterMoons, MakeTime } from 'astronomy-engine';
import type { BodyId } from '../catalog/bodies';
import { ELEMENTS, type ElementSet } from '../catalog/orbits';
import { SMALL_BODY_ELEMENTS } from '../catalog/smallBodyElements';
import { mulMat3Vec, type Mat3, type Vec3 } from '../math';
import { AU_M, J2000_JD } from '../units';
import { EQJ_TO_ECL, planeToEcliptic } from './frames';
import { planePosition } from './kepler';

/** Satellites whose parent-relative position astronomy-engine computes (the Moon and Jupiter's four Galilean moons). */
export type AeSatelliteId = 'moon' | 'io' | 'europa' | 'ganymede' | 'callisto';

const AE_SATELLITES: ReadonlySet<BodyId> = new Set<BodyId>(['moon', 'io', 'europa', 'ganymede', 'callisto']);

export function isAeSatellite(id: BodyId): id is AeSatelliteId {
  return AE_SATELLITES.has(id);
}

// JupiterMoons returns all four moons at once, so the four per-body calls in one frame share one evaluation.
let cachedMs = Number.NaN;
let cachedMoons: ReturnType<typeof JupiterMoons> | null = null;

/** Position (ecliptic J2000 metres) of the Moon relative to Earth, or of a Galilean moon relative to Jupiter, from astronomy-engine. */
export function aeSatelliteRelative(id: AeSatelliteId, date: Date): Vec3 {
  let eqj: Vec3;
  if (id === 'moon') {
    const v = GeoMoon(date);
    eqj = [v.x, v.y, v.z];
  } else {
    if (cachedMoons === null || date.getTime() !== cachedMs) {
      cachedMoons = JupiterMoons(date);
      cachedMs = date.getTime();
    }
    const s = cachedMoons[id];
    eqj = [s.x, s.y, s.z];
  }
  const ecl = mulMat3Vec(EQJ_TO_ECL, eqj);
  return [ecl[0] * AU_M, ecl[1] * AU_M, ecl[2] * AU_M];
}

const planeMatrices = new Map<BodyId, Mat3>();

/** The bundled elements of a body: a satellite's mean elements, or a named small body's SBDB osculating elements. */
export function elementSet(id: BodyId): ElementSet | undefined {
  return ELEMENTS[id] ?? SMALL_BODY_ELEMENTS[id];
}

/** Position (ecliptic J2000 metres) relative to the parent at Julian date `jdTdb`, from the bundled elements (Keplerian motion; satellites add secular node and periapsis precession). */
export function elementRelativeJd(id: BodyId, jdTdb: number): Vec3 {
  const set = elementSet(id);
  if (!set) throw new Error(`no orbital elements for ${id}`);
  let toEcliptic = planeMatrices.get(id);
  if (!toEcliptic) {
    toEcliptic = planeToEcliptic(set.frame);
    planeMatrices.set(id, toEcliptic);
  }
  return mulMat3Vec(toEcliptic, planePosition(set.elements, jdTdb));
}

/** As `elementRelativeJd`, at a Date. */
export function elementRelative(id: BodyId, date: Date): Vec3 {
  return elementRelativeJd(id, J2000_JD + MakeTime(date).tt); // Terrestrial Time agrees with TDB to about 2 ms
}
