import { describe, expect, it } from 'vitest';
import { generateBelt, propagateBelt, secondsSinceJ2000, type BeltField } from '../../src/ephemeris/beltField';
import {
  OORT_APOAPSIS_LIMIT_AU, OORT_CLOUD_SPEC, OORT_ECCENTRICITY_MAX, OORT_FADE_HIGH_M, OORT_FADE_LOW_M, OORT_MAX_OPACITY,
  OORT_PERIAPSIS_MIN_AU, generateOortCloud, oortDensity, oortOpacity,
} from '../../src/ephemeris/oortField';
import { AU_M, DEG } from '../../src/units';

const cloud = generateOortCloud();
const N = cloud.count;

/** Ecliptic positions in AU (undoing the Three.js axis swap that propagateBelt applies) at `date`, camera at the origin. */
function positionsAu(field: BeltField, date: Date): Float64Array {
  const out = new Float32Array(3 * field.count);
  propagateBelt(field, secondsSinceJ2000(date), [0, 0, 0], out);
  const ecl = new Float64Array(3 * field.count);
  for (let i = 0; i < field.count; i++) {
    ecl[3 * i] = out[3 * i]! / AU_M;
    ecl[3 * i + 1] = -out[3 * i + 2]! / AU_M;
    ecl[3 * i + 2] = out[3 * i + 1]! / AU_M;
  }
  return ecl;
}

describe('the schematic Oort cloud orbits', () => {
  it('has 15,000 points with semi-major axes between 2,000 and 50,000 AU', () => {
    expect(OORT_CLOUD_SPEC.count).toBe(15_000);
    expect(N).toBe(15_000);
    expect(Math.min(...cloud.aAu)).toBeGreaterThanOrEqual(2000); // measured 2000.54
    expect(Math.max(...cloud.aAu)).toBeLessThan(50_000); // measured 49965
  });
  it('keeps every orbit elliptical, with periapsis above 200 AU and apoapsis inside the spec\'s roughly 100,000 AU', () => {
    for (let i = 0; i < N; i++) {
      const a = cloud.aAu[i]!;
      const e = cloud.e[i]!;
      expect(e).toBeLessThanOrEqual(OORT_ECCENTRICITY_MAX);
      expect(a * (1 - e)).toBeGreaterThanOrEqual(OORT_PERIAPSIS_MIN_AU - 1e-9); // measured minimum 200.43
      expect(a * (1 + e)).toBeLessThanOrEqual(OORT_APOAPSIS_LIMIT_AU); // measured maximum 95,728
    }
  });
  it('spreads the semi-major axes evenly in log(a): 2,000-10,000 and 10,000-50,000 AU hold about half each', () => {
    const inner = cloud.aAu.filter((a) => a < 10_000).length; // measured 7420 of 15000
    expect(inner).toBeGreaterThan(0.45 * N);
    expect(inner).toBeLessThan(0.55 * N);
  });
  it('has isotropic orbit planes: about half retrograde, mean cos(inclination) near zero, inclinations up to 180 degrees', () => {
    let retrograde = 0;
    let sumCos = 0;
    for (let i = 0; i < N; i++) {
      if (cloud.incDeg[i]! > 90) retrograde++;
      sumCos += Math.cos(cloud.incDeg[i]! * DEG);
    }
    expect(retrograde).toBeGreaterThan(0.47 * N); // measured 7456
    expect(retrograde).toBeLessThan(0.53 * N);
    expect(Math.abs(sumCos / N)).toBeLessThan(0.02); // measured 0.0014
    expect(Math.max(...cloud.incDeg)).toBeGreaterThan(170);
    expect(Math.max(...cloud.incDeg)).toBeLessThanOrEqual(180);
  });
  it('is the same cloud every time (fixed seed)', () => {
    const again = generateOortCloud();
    expect(Array.from(again.aAu.slice(0, 20))).toEqual(Array.from(cloud.aAu.slice(0, 20)));
    expect(Array.from(again.meanAnomalyDeg.slice(0, 20))).toEqual(Array.from(cloud.meanAnomalyDeg.slice(0, 20)));
  });
  it('does not change the flat belts: a non-isotropic spec still draws inclination from the Rayleigh cap', () => {
    const flat = generateBelt({ ...OORT_CLOUD_SPEC, isotropic: false, inclinationSigmaDeg: 8, inclinationMaxDeg: 30, count: 500 });
    expect(Math.max(...flat.incDeg)).toBeLessThanOrEqual(30);
  });
});

describe('the propagated Oort cloud', () => {
  const at = positionsAu(cloud, new Date('2026-09-24T00:00:00Z'));
  it('is spherical: equal spread along all three ecliptic axes, no drift, all eight octants equally filled', () => {
    const rms = [0, 1, 2].map((k) => {
      let s = 0;
      for (let i = 0; i < N; i++) s += at[3 * i + k]! ** 2;
      return Math.sqrt(s / N);
    }); // measured 13810, 14046, 13881 AU
    expect(Math.max(...rms) / Math.min(...rms)).toBeLessThan(1.1);
    for (let k = 0; k < 3; k++) {
      let sum = 0;
      for (let i = 0; i < N; i++) sum += at[3 * i + k]!;
      expect(Math.abs(sum / N)).toBeLessThan(1000); // measured at most 324 AU
    }
    const octants = new Array<number>(8).fill(0);
    for (let i = 0; i < N; i++) octants[(at[3 * i]! > 0 ? 1 : 0) + (at[3 * i + 1]! > 0 ? 2 : 0) + (at[3 * i + 2]! > 0 ? 4 : 0)]!++;
    for (const count of octants) {
      expect(count).toBeGreaterThan(1650); // measured 1812 to 1928
      expect(count).toBeLessThan(2100);
    }
  });
  it('is sparse and deep: no point inside 200 AU or beyond 100,000 AU, the median near 11,000 AU, nearly all beyond 2,000 AU', () => {
    const r = Array.from({ length: N }, (_, i) => Math.hypot(at[3 * i]!, at[3 * i + 1]!, at[3 * i + 2]!)).sort((a, b) => a - b);
    expect(r[0]!).toBeGreaterThan(OORT_PERIAPSIS_MIN_AU); // measured 287
    expect(r[N - 1]!).toBeLessThan(OORT_APOAPSIS_LIMIT_AU); // measured 90,634
    expect(r[N >> 1]!).toBeGreaterThan(5000); // measured 11,014
    expect(r[N >> 1]!).toBeLessThan(20_000);
    expect(r.filter((x) => x > 2000).length / N).toBeGreaterThan(0.9); // measured 0.966
  });
  it('stays finite and bounded at the ends of the time bar (1700 and 2300)', () => {
    for (const iso of ['1700-01-01T00:00:00Z', '2300-12-31T00:00:00Z']) {
      const p = positionsAu(cloud, new Date(iso));
      let max = 0;
      for (let i = 0; i < p.length; i++) {
        expect(Number.isFinite(p[i]!), iso).toBe(true);
        max = Math.max(max, Math.abs(p[i]!));
      }
      expect(max, iso).toBeLessThan(OORT_APOAPSIS_LIMIT_AU);
    }
  });
  it('subtracts the camera in float64: moving the camera by (1e15, 2e15, -3e15) m shifts every point by the same amount', () => {
    const cam = [1e15, 2e15, -3e15] as const;
    const a = new Float32Array(3 * 200);
    const b = new Float32Array(3 * 200);
    const small = { ...cloud, count: 200 };
    propagateBelt(small, 0, [0, 0, 0], a);
    propagateBelt(small, 0, cam, b);
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(a[3 * i]! - cam[0] - b[3 * i]!)).toBeLessThan(5e9); // float32 spacing at 1e16 is about 1e9
      expect(Math.abs(a[3 * i + 1]! - cam[2] - b[3 * i + 1]!)).toBeLessThan(5e9);
      expect(Math.abs(a[3 * i + 2]! + cam[1] - b[3 * i + 2]!)).toBeLessThan(5e9);
    }
  });
});

describe('oortDensity', () => {
  it('falls as 1/a, so each doubling of the distance holds the same number of orbits', () => {
    expect(oortDensity(2000)).toBe(1);
    expect(oortDensity(4000)).toBeCloseTo(0.5, 12);
    expect(oortDensity(50_000)).toBeCloseTo(0.04, 12);
    expect(oortDensity(1000)).toBe(1); // capped at 1 inside the cloud
  });
});

describe('oortOpacity', () => {
  it('is zero at planet and system scale (below 1e14 m, about 670 AU) so nothing is propagated or drawn there', () => {
    expect(OORT_FADE_LOW_M).toBe(1e14);
    expect(OORT_FADE_HIGH_M).toBe(1e15);
    expect(oortOpacity(1)).toBe(0);
    expect(oortOpacity(1e12)).toBe(0);
    expect(oortOpacity(1e14)).toBe(0);
  });
  it('ramps up to 0.7 by 1e15 m and stays there out to the 1e17 m maximum', () => {
    expect(OORT_MAX_OPACITY).toBe(0.7);
    expect(oortOpacity(5.5e14)).toBeCloseTo(0.35, 12); // the midpoint of the ramp
    expect(oortOpacity(1e15)).toBeCloseTo(0.7, 12);
    expect(oortOpacity(1e17)).toBeCloseTo(0.7, 12);
  });
  it('never decreases with altitude', () => {
    let previous = 0;
    for (let a = 1e13; a < 1e17; a *= 1.2) {
      expect(oortOpacity(a)).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = oortOpacity(a);
    }
  });
});
