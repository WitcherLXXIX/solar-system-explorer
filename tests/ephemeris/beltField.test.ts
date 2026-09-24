import { Body, PlanetOrbitalPeriod } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { getBody } from '../../src/catalog/bodies';
import {
  type BeltField, JUPITER_A_AU, KIRKWOOD_GAPS_AU, KUIPER_BELT_SPEC, MAIN_BELT_SPEC, NEPTUNE_A_AU, PLUTINO_A_AU, TWOTINO_A_AU, generateBelt,
  kuiperBeltDensity, mainBeltDensity, mulberry32, propagateBelt, resonanceAu, secondsSinceJ2000,
} from '../../src/ephemeris/beltField';
import { planePosition, type OrbitalElements } from '../../src/ephemeris/kepler';
import { length, type Vec3 } from '../../src/math';
import { AU_M, DEG, G, J2000_JD, SUN_GM_M3_S2 } from '../../src/units';

const countIn = (values: Float64Array, lo: number, hi: number): number => values.filter((v) => v >= lo && v < hi).length;

describe('constants', () => {
  it('takes the giant planets\' semi-major axes from astronomy-engine periods (Kepler III), within 0.1% of the tabulated ones', () => {
    expect(JUPITER_A_AU).toBeCloseTo((PlanetOrbitalPeriod(Body.Jupiter) / 365.25) ** (2 / 3), 12);
    expect(JUPITER_A_AU / 5.2026).toBeGreaterThan(0.999);
    expect(JUPITER_A_AU / 5.2026).toBeLessThan(1.001);
    expect(NEPTUNE_A_AU / 30.07).toBeGreaterThan(0.998);
    expect(NEPTUNE_A_AU / 30.07).toBeLessThan(1.002);
  });
  it('places the Kirkwood gaps and the plutino resonance where resonance arithmetic puts them', () => {
    // Computed 2026-09-23 with node from astronomy-engine periods: 2.5005, 2.8237, 2.9566, 3.2766 AU; Neptune 3:2 39.386, 2:1 47.713.
    expect(KIRKWOOD_GAPS_AU[0]!).toBeCloseTo(2.5005, 3);
    expect(KIRKWOOD_GAPS_AU[1]!).toBeCloseTo(2.8237, 3);
    expect(KIRKWOOD_GAPS_AU[2]!).toBeCloseTo(2.9566, 3);
    expect(KIRKWOOD_GAPS_AU[3]!).toBeCloseTo(3.2766, 3);
    expect(PLUTINO_A_AU).toBeCloseTo(39.386, 2);
    expect(TWOTINO_A_AU).toBeCloseTo(47.713, 2);
  });
  it('resonanceAu follows the period ratio: a 1:1 resonance is the planet\'s own orbit and 8:1 is a quarter of it', () => {
    expect(resonanceAu(5, 1, 1)).toBe(5);
    expect(resonanceAu(8, 1, 8)).toBeCloseTo(2, 12);
  });
  it('uses a solar GM that agrees with G times the catalog Sun mass', () => {
    expect(Math.abs(SUN_GM_M3_S2 / (G * getBody('sun').massKg!) - 1)).toBeLessThan(1e-3);
  });
});

describe('mulberry32', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('the schematic main belt', () => {
  const field = generateBelt(MAIN_BELT_SPEC);
  it('has about 4000 points, all inside 2.1-3.3 AU with elliptical orbits', () => {
    expect(field.count).toBe(4000);
    expect(Math.min(...field.aAu)).toBeGreaterThanOrEqual(2.1);
    expect(Math.max(...field.aAu)).toBeLessThan(3.3);
    for (let i = 0; i < field.count; i++) {
      expect(field.e[i]!).toBeGreaterThanOrEqual(0);
      expect(field.e[i]!).toBeLessThanOrEqual(0.3);
      expect(field.aAu[i]! * (1 - field.e[i]!)).toBeGreaterThanOrEqual(1.5 - 1e-9);
    }
  });
  it('is the same belt every time (fixed seed)', () => {
    const again = generateBelt(MAIN_BELT_SPEC);
    expect(Array.from(again.aAu.slice(0, 20))).toEqual(Array.from(field.aAu.slice(0, 20)));
  });
  it('is emptied at the first three Kirkwood gaps: the gap window holds under half the points of its flanking windows', () => {
    // Measured 2026-09-23 (gap window, inner flank, outer flank): 46/127/137, 42/151/170, 49/155/153.
    for (const gap of KIRKWOOD_GAPS_AU.slice(0, 3)) {
      const inGap = countIn(field.aAu, gap - 0.02, gap + 0.02);
      const flanks = (countIn(field.aAu, gap - 0.06, gap - 0.02) + countIn(field.aAu, gap + 0.02, gap + 0.06)) / 2;
      expect(inGap, `gap at ${gap.toFixed(3)} AU`).toBeLessThan(0.5 * flanks);
    }
  });
  it('is thin at the 2:1 gap next to the outer edge: fewer points than the inner flank', () => {
    const gap = KIRKWOOD_GAPS_AU[3]!; // measured 27 in the gap window against 107 in the inner flank
    expect(countIn(field.aAu, gap - 0.02, gap + 0.02)).toBeLessThan(0.5 * countIn(field.aAu, gap - 0.06, gap - 0.02));
  });
  it('has a broad, low-eccentricity, inclined distribution', () => {
    const mean = (values: Float64Array): number => values.reduce((s, v) => s + v, 0) / values.length;
    // Measured 2026-09-23: mean eccentricity 0.111, mean inclination 9.98 degrees.
    expect(mean(field.e)).toBeGreaterThan(0.08);
    expect(mean(field.e)).toBeLessThan(0.14);
    expect(mean(field.incDeg)).toBeGreaterThan(8);
    expect(mean(field.incDeg)).toBeLessThan(12);
    expect(Math.max(...field.incDeg)).toBeLessThanOrEqual(30);
  });
  it('has a density profile that dips at every gap and is never zero', () => {
    for (const gap of KIRKWOOD_GAPS_AU) expect(mainBeltDensity(gap)).toBeLessThan(0.3 * mainBeltDensity(gap + 0.08));
    for (let a = 2.1; a <= 3.3; a += 0.01) {
      expect(mainBeltDensity(a)).toBeGreaterThan(0);
      expect(mainBeltDensity(a)).toBeLessThanOrEqual(1);
    }
  });
});

describe('the schematic Kuiper belt', () => {
  const field = generateBelt(KUIPER_BELT_SPEC);
  it('has about 3000 points inside 30-50 AU whose perihelia stay beyond Neptune', () => {
    expect(field.count).toBe(3000);
    expect(Math.min(...field.aAu)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...field.aAu)).toBeLessThan(50);
    for (let i = 0; i < field.count; i++) expect(field.aAu[i]! * (1 - field.e[i]!)).toBeGreaterThanOrEqual(30 - 1e-9);
  });
  it('is concentrated in the classical belt (40-48 AU) and bumps up at the plutino resonance', () => {
    // Measured 2026-09-23: 61.9% of the points in 40-48 AU; plutino window 215 against an inner flank of 60.
    expect(countIn(field.aAu, 40, 48) / field.count).toBeGreaterThan(0.5);
    expect(countIn(field.aAu, PLUTINO_A_AU - 0.4, PLUTINO_A_AU + 0.4)).toBeGreaterThan(2 * countIn(field.aAu, PLUTINO_A_AU - 1.6, PLUTINO_A_AU - 0.8));
    expect(kuiperBeltDensity(PLUTINO_A_AU)).toBeGreaterThan(kuiperBeltDensity(PLUTINO_A_AU - 1.5));
  });
  it('is flatter than isotropic but wider than the main belt', () => {
    const mean = (values: Float64Array): number => values.reduce((s, v) => s + v, 0) / values.length;
    // Measured 2026-09-23: mean inclination 12.55 degrees, mean eccentricity 0.082.
    expect(mean(field.incDeg)).toBeGreaterThan(10);
    expect(mean(field.incDeg)).toBeLessThan(15);
    expect(mean(field.e)).toBeLessThan(0.15);
  });
});

describe('propagateBelt', () => {
  it('puts a circular, flat point at (a, 0, 0) at time zero and a quarter turn later at (0, a, 0), in Three.js axes', () => {
    const a = 2 * AU_M;
    const period = 2 * Math.PI * Math.sqrt(a ** 3 / SUN_GM_M3_S2);
    // Built by hand: a flat circular orbit with node = periapsis = 0, so the basis is the x and y axes.
    const one: BeltField = {
      count: 1, aAu: Float64Array.of(2), e: Float64Array.of(0), incDeg: Float64Array.of(0), nodeDeg: Float64Array.of(0),
      periDeg: Float64Array.of(0), meanAnomalyDeg: Float64Array.of(0), meanMotion: Float64Array.of((2 * Math.PI) / period),
      basis: Float64Array.of(1, 0, 0, 0, 1, 0),
    };
    const out = new Float32Array(3);
    propagateBelt(one, 0, [0, 0, 0], out);
    expect(out[0]! / a).toBeCloseTo(1, 6);
    expect(out[1]!).toBeCloseTo(0, 0);
    expect(out[2]!).toBeCloseTo(0, 0);
    propagateBelt(one, period / 4, [0, 0, 0], out);
    expect(out[0]! / a).toBeCloseTo(0, 6);
    expect(out[2]! / a).toBeCloseTo(-1, 6); // world +y is Three.js -z
  });
  it('agrees with the phase-2b Kepler propagator (planePosition) for every point of the real generator', () => {
    const field = generateBelt(MAIN_BELT_SPEC);
    const seconds = secondsSinceJ2000(new Date('2031-03-05T00:00:00Z'));
    const out = new Float32Array(3 * field.count);
    propagateBelt(field, seconds, [0, 0, 0], out);
    for (const i of [0, 1, 17, 999, 2500, 3999]) {
      const elements: OrbitalElements = {
        epochJd: J2000_JD, aKm: (field.aAu[i]! * AU_M) / 1000, e: field.e[i]!, iDeg: field.incDeg[i]!, nodeDeg: field.nodeDeg[i]!,
        periDeg: field.periDeg[i]!, meanAnomalyDeg: field.meanAnomalyDeg[i]!, meanMotionDegPerDay: (field.meanMotion[i]! / DEG) * 86_400,
        nodeRateDegPerYear: 0, periRateDegPerYear: 0,
      };
      const want = planePosition(elements, J2000_JD + seconds / 86_400);
      const got: Vec3 = [out[3 * i]!, -out[3 * i + 2]!, out[3 * i + 1]!]; // Three.js (x, z, -y) back to ecliptic (x, y, z)
      expect(length([got[0] - want[0], got[1] - want[1], got[2] - want[2]]) / length(want), `point ${i}`).toBeLessThan(1e-6);
    }
  });
  it('subtracts the camera in float64 before the cast: a camera 1000 m from a point 4e11 m from the Sun sees 1000 m, not float32 noise', () => {
    const field = generateBelt({ ...MAIN_BELT_SPEC, count: 1 });
    const seconds = 1e8;
    const el: OrbitalElements = {
      epochJd: J2000_JD, aKm: (field.aAu[0]! * AU_M) / 1000, e: field.e[0]!, iDeg: field.incDeg[0]!, nodeDeg: field.nodeDeg[0]!,
      periDeg: field.periDeg[0]!, meanAnomalyDeg: field.meanAnomalyDeg[0]!, meanMotionDegPerDay: (field.meanMotion[0]! / DEG) * 86_400,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    };
    const world = planePosition(el, J2000_JD + seconds / 86_400); // an independent float64 position of the same point
    const camera: Vec3 = [world[0] + 1000, world[1], world[2]];
    const out = new Float32Array(3);
    propagateBelt(field, seconds, camera, out);
    // A float32 position at 4e11 m rounds to about 3e4 m, so casting before subtracting could never land within 1 m of -1000.
    expect(Math.abs(out[0]! + 1000)).toBeLessThan(1);
    expect(Math.abs(out[1]!)).toBeLessThan(1);
    expect(Math.abs(out[2]!)).toBeLessThan(1);
  });
  it('stays finite and inside each belt\'s outer bound for dates a thousand years either side of today (time-bar extremes)', () => {
    for (const spec of [MAIN_BELT_SPEC, KUIPER_BELT_SPEC]) {
      const field = generateBelt({ ...spec, count: 500 });
      const out = new Float32Array(3 * field.count);
      for (const years of [-1000, 1000]) {
        propagateBelt(field, years * 365.25 * 86_400, [0, 0, 0], out);
        for (let i = 0; i < field.count; i++) {
          const r = Math.hypot(out[3 * i]!, out[3 * i + 1]!, out[3 * i + 2]!);
          expect(Number.isFinite(r), `${years} years, point ${i}`).toBe(true);
          expect(r).toBeLessThan(1.31 * spec.aMaxAu * AU_M); // r <= a (1 + e) with e <= 0.3
        }
      }
    }
  });
  it('is fast enough to run every frame: 7000 points well under 10 ms on average', () => {
    const main = generateBelt(MAIN_BELT_SPEC);
    const kuiper = generateBelt(KUIPER_BELT_SPEC);
    const outMain = new Float32Array(3 * main.count);
    const outKuiper = new Float32Array(3 * kuiper.count);
    const start = performance.now();
    for (let k = 0; k < 20; k++) {
      propagateBelt(main, 1e8 + k * 1000, [1e11, 2e11, 3e9], outMain);
      propagateBelt(kuiper, 1e8 + k * 1000, [1e11, 2e11, 3e9], outKuiper);
    }
    expect((performance.now() - start) / 20).toBeLessThan(50);
  });
});

describe('secondsSinceJ2000', () => {
  it('is zero at 2000-01-01 12:00 UTC and a day later 86400', () => {
    expect(secondsSinceJ2000(new Date('2000-01-01T12:00:00Z'))).toBe(0);
    expect(secondsSinceJ2000(new Date('2000-01-02T12:00:00Z'))).toBe(86_400);
  });
});
