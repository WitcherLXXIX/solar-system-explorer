import { smoothstep } from '../math';
import { generateBelt, type BeltField, type BeltSpec } from './beltField';

/**
 * The schematic Oort cloud: the same Kepler-point technique as the belts, made spherical. Nothing out there has ever been
 * directly observed, so every number below is an appearance choice, not a measured population statistic; the catalog, the UI
 * and the README say so, and no individual object is named.
 */
export const OORT_A_MIN_AU = 2000;
export const OORT_A_MAX_AU = 50_000;
/** Eccentricity cap: with a_max this puts the largest apoapsis at 97,500 AU, inside the spec's "about 100,000 AU". */
export const OORT_ECCENTRICITY_MAX = 0.95;
export const OORT_APOAPSIS_LIMIT_AU = 100_000;
/** Periapsis floor: keeps every point out beyond the Kuiper belt and scattered disc, so none swings through the planets. */
export const OORT_PERIAPSIS_MIN_AU = 200;

/** Relative density of semi-major axes: proportional to 1/a (uniform in log a), capped at 1. A shape choice, not a fit. */
export function oortDensity(aAu: number): number {
  return Math.min(1, OORT_A_MIN_AU / aAu);
}

/** 15,000 points, isotropic orbit planes (half of them retrograde), Rayleigh eccentricities with scale 0.5. */
export const OORT_CLOUD_SPEC: BeltSpec = {
  count: 15_000, seed: 16_500_000, aMinAu: OORT_A_MIN_AU, aMaxAu: OORT_A_MAX_AU, density: oortDensity,
  eccentricitySigma: 0.5, eccentricityMax: OORT_ECCENTRICITY_MAX, qMinAu: OORT_PERIAPSIS_MIN_AU,
  inclinationSigmaDeg: 0, inclinationMaxDeg: 180, isotropic: true,
};

export function generateOortCloud(spec: BeltSpec = OORT_CLOUD_SPEC): BeltField {
  return generateBelt(spec);
}

/** The cloud is invisible (and not even propagated) below this camera altitude above the focused body, about 670 AU, and reaches full strength at OORT_FADE_HIGH_M. Tunable. */
export const OORT_FADE_LOW_M = 1e14;
export const OORT_FADE_HIGH_M = 1e15;
export const OORT_MAX_OPACITY = 0.7;

/** Opacity of the Oort cloud from the camera's altitude: gone at planet and system scale (a few far dots would read as stars), full from about 6,700 AU out. */
export function oortOpacity(altitudeM: number): number {
  return OORT_MAX_OPACITY * smoothstep(OORT_FADE_LOW_M, OORT_FADE_HIGH_M, altitudeM);
}
