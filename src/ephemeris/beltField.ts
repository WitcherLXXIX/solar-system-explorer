import { Body, PlanetOrbitalPeriod } from 'astronomy-engine';
import { smoothstep, type Vec3 } from '../math';
import { AU_M, DAYS_PER_YEAR, DEG, SUN_GM_M3_S2 } from '../units';
import { solveKepler } from './kepler';

/** A small deterministic random number generator (mulberry32): the same seed always gives the same belt. Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semi-major axis in AU implied by astronomy-engine's orbital period (Kepler's third law with the Sun's mass alone). */
const semiMajorAxisAu = (body: Body): number => (PlanetOrbitalPeriod(body) / DAYS_PER_YEAR) ** (2 / 3);
export const JUPITER_A_AU = semiMajorAxisAu(Body.Jupiter);
export const NEPTUNE_A_AU = semiMajorAxisAu(Body.Neptune);

/** Semi-major axis (AU) of a body that completes `bodyOrbits` orbits while a planet at `aPlanetAu` completes `planetOrbits` (a mean-motion resonance). */
export function resonanceAu(aPlanetAu: number, planetOrbits: number, bodyOrbits: number): number {
  return aPlanetAu * (planetOrbits / bodyOrbits) ** (2 / 3);
}

/** The main-belt Kirkwood gaps: the 3:1, 5:2, 7:3 and 2:1 resonances with Jupiter. */
export const KIRKWOOD_GAPS_AU: readonly number[] = [
  resonanceAu(JUPITER_A_AU, 1, 3), resonanceAu(JUPITER_A_AU, 2, 5), resonanceAu(JUPITER_A_AU, 3, 7), resonanceAu(JUPITER_A_AU, 1, 2),
];
/** Neptune's 3:2 resonance (the plutinos) and 2:1 resonance (the twotinos). */
export const PLUTINO_A_AU = resonanceAu(NEPTUNE_A_AU, 3, 2);
export const TWOTINO_A_AU = resonanceAu(NEPTUNE_A_AU, 2, 1);

const gaussian = (x: number, centre: number, sigma: number): number => Math.exp(-0.5 * ((x - centre) / sigma) ** 2);

/**
 * Relative density (0 to 1) of the schematic main belt at semi-major axis `aAu`: a broad hump centred near 2.75 AU with a
 * floor, and a narrow dip (90% deep, 0.02 AU wide) at each Kirkwood gap. These are shape numbers chosen for appearance, not
 * fitted to a catalogue; the belt is schematic.
 */
export function mainBeltDensity(aAu: number): number {
  let d = 0.4 + 0.6 * gaussian(aAu, 2.75, 0.4);
  for (const gap of KIRKWOOD_GAPS_AU) d *= 1 - 0.9 * gaussian(aAu, gap, 0.02);
  return d;
}

/**
 * Relative density (0 to 1) of the schematic Kuiper belt: a thin floor across 30-50 AU, a broad classical belt (about
 * 40-48 AU) and a bump at the plutino resonance. Shape numbers chosen for appearance; the belt is schematic.
 */
export function kuiperBeltDensity(aAu: number): number {
  const classical = smoothstep(38, 41, aAu) * (1 - smoothstep(47, 50, aAu));
  return Math.min(1, 0.25 + 0.6 * classical + 0.5 * gaussian(aAu, PLUTINO_A_AU, 0.6));
}

export interface BeltSpec {
  count: number;
  seed: number;
  aMinAu: number;
  aMaxAu: number;
  /** Relative density in (0, 1] at a semi-major axis in AU; points are drawn by rejection against it. */
  density: (aAu: number) => number;
  /** Eccentricity is Rayleigh distributed with this scale, then limited so the perihelion stays above `qMinAu`. */
  eccentricitySigma: number;
  eccentricityMax: number;
  qMinAu: number;
  /** Inclination (degrees) is Rayleigh distributed with this scale and capped. */
  inclinationSigmaDeg: number;
  inclinationMaxDeg: number;
}

/** About 4000 points between 2.1 and 3.3 AU. Every number is a schematic tuning value, not a measured population statistic. */
export const MAIN_BELT_SPEC: BeltSpec = {
  count: 4000, seed: 20260923, aMinAu: 2.1, aMaxAu: 3.3, density: mainBeltDensity,
  eccentricitySigma: 0.09, eccentricityMax: 0.3, qMinAu: 1.5, inclinationSigmaDeg: 8, inclinationMaxDeg: 30,
};

/** About 3000 points between 30 and 50 AU. Every number is a schematic tuning value, not a measured population statistic. */
export const KUIPER_BELT_SPEC: BeltSpec = {
  count: 3000, seed: 19300218, aMinAu: 30, aMaxAu: 50, density: kuiperBeltDensity,
  eccentricitySigma: 0.07, eccentricityMax: 0.25, qMinAu: 30, inclinationSigmaDeg: 10, inclinationMaxDeg: 35,
};

/** The elements of every point in a belt, in flat typed arrays (no per-point objects), plus the values propagation needs. */
export interface BeltField {
  readonly count: number;
  readonly aAu: Float64Array;
  readonly e: Float64Array;
  readonly incDeg: Float64Array;
  readonly nodeDeg: Float64Array;
  readonly periDeg: Float64Array;
  /** Mean anomaly at J2000, degrees. */
  readonly meanAnomalyDeg: Float64Array;
  /** Mean motion, radians per second. */
  readonly meanMotion: Float64Array;
  /** Six numbers per point: the unit vector toward periapsis then the unit vector 90 degrees ahead of it in the orbit plane (ecliptic J2000). */
  readonly basis: Float64Array;
}

const rayleigh = (u: number, sigma: number): number => sigma * Math.sqrt(-2 * Math.log(1 - u));

/** Builds every point's elements once, from the spec's distributions. Deterministic for a given spec. */
export function generateBelt(spec: BeltSpec, gm: number = SUN_GM_M3_S2): BeltField {
  const rand = mulberry32(spec.seed);
  const n = spec.count;
  const field: BeltField = {
    count: n, aAu: new Float64Array(n), e: new Float64Array(n), incDeg: new Float64Array(n), nodeDeg: new Float64Array(n),
    periDeg: new Float64Array(n), meanAnomalyDeg: new Float64Array(n), meanMotion: new Float64Array(n), basis: new Float64Array(6 * n),
  };
  for (let i = 0; i < n; i++) {
    let a = spec.aMinAu;
    for (let tries = 0; tries < 1000; tries++) {
      a = spec.aMinAu + (spec.aMaxAu - spec.aMinAu) * rand();
      if (rand() < spec.density(a)) break;
    }
    const eLimit = Math.min(spec.eccentricityMax, Math.max(0, 1 - spec.qMinAu / a));
    let e = eLimit;
    for (let tries = 0; tries < 50; tries++) {
      const candidate = rayleigh(rand(), spec.eccentricitySigma);
      if (candidate <= eLimit) {
        e = candidate;
        break;
      }
    }
    const inc = Math.min(rayleigh(rand(), spec.inclinationSigmaDeg), spec.inclinationMaxDeg);
    const node = 360 * rand();
    const peri = 360 * rand();
    const m0 = 360 * rand();
    field.aAu[i] = a;
    field.e[i] = e;
    field.incDeg[i] = inc;
    field.nodeDeg[i] = node;
    field.periDeg[i] = peri;
    field.meanAnomalyDeg[i] = m0;
    field.meanMotion[i] = Math.sqrt(gm / (a * AU_M) ** 3);
    const cn = Math.cos(node * DEG);
    const sn = Math.sin(node * DEG);
    const cw = Math.cos(peri * DEG);
    const sw = Math.sin(peri * DEG);
    const ci = Math.cos(inc * DEG);
    const si = Math.sin(inc * DEG);
    field.basis.set([
      cn * cw - sn * ci * sw, sn * cw + cn * ci * sw, si * sw,
      -cn * sw - sn * ci * cw, -sn * sw + cn * ci * cw, si * cw,
    ], 6 * i);
  }
  return field;
}

/** Seconds from the J2000 epoch (2000-01-01 12:00) to `date`; UTC is used as is (the 69 s to TT is far below what a schematic field shows). */
export function secondsSinceJ2000(date: Date): number {
  return (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 1000;
}

/**
 * Writes every point's position relative to the camera into `out` (three floats per point, Three.js axes: x, z, -y).
 * Each point is propagated with the Kepler solver in float64, the camera position is subtracted in float64, and only that
 * small difference is cast to float32, the same discipline as every other body.
 */
export function propagateBelt(field: BeltField, secondsSinceJ2000: number, cameraPos: Vec3, out: Float32Array): void {
  for (let i = 0; i < field.count; i++) {
    const e = field.e[i]!;
    const a = field.aAu[i]! * AU_M;
    const m = field.meanAnomalyDeg[i]! * DEG + field.meanMotion[i]! * secondsSinceJ2000;
    const big = solveKepler(m, e);
    const px = a * (Math.cos(big) - e);
    const py = a * Math.sqrt(1 - e * e) * Math.sin(big);
    const b = 6 * i;
    const wx = px * field.basis[b]! + py * field.basis[b + 3]!;
    const wy = px * field.basis[b + 1]! + py * field.basis[b + 4]!;
    const wz = px * field.basis[b + 2]! + py * field.basis[b + 5]!;
    out[3 * i] = wx - cameraPos[0];
    out[3 * i + 1] = wz - cameraPos[2];
    out[3 * i + 2] = -(wy - cameraPos[1]);
  }
}
