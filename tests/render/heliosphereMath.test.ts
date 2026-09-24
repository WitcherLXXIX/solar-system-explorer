import { describe, expect, it } from 'vitest';
import {
  HELIO_BOUND_AU, HELIO_FADE_HIGH_M, HELIO_FADE_LOW_M, HELIO_MAX_OPACITY, HELIO_STEPS, HELIO_TAU_PER_AU, HELIOPAUSE_AU,
  SHELL_SIGMA_AU, TERMINATION_SHOCK_AU, heliosphereAlpha, heliosphereOpacity, shellDensity, shellDepths, terminationShare,
} from '../../src/render/heliosphereMath';

const K = SHELL_SIGMA_AU * Math.sqrt(2 * Math.PI); // 10.0265 AU: the depth of one radial crossing of one shell

describe('the constants', () => {
  it('put the shells at the spec\'s termination shock and heliopause and bound them four widths beyond the outer one', () => {
    expect(TERMINATION_SHOCK_AU).toBe(94);
    expect(HELIOPAUSE_AU).toBe(120);
    expect(SHELL_SIGMA_AU).toBe(4);
    expect(HELIO_BOUND_AU).toBe(HELIOPAUSE_AU + 4 * SHELL_SIGMA_AU);
    expect(HELIO_STEPS).toBe(64);
  });
});

describe('shellDensity', () => {
  it('peaks at 1 on the shell radius and falls as a Gaussian of width sigma', () => {
    expect(shellDensity(94, 94)).toBe(1);
    expect(shellDensity(98, 94)).toBeCloseTo(Math.exp(-0.5), 12);
    expect(shellDensity(90, 94)).toBeCloseTo(Math.exp(-0.5), 12);
    expect(shellDensity(150, 94)).toBeLessThan(1e-40);
  });
});

describe('shellDepths', () => {
  it('sees one crossing of each shell from the Sun: sigma sqrt(2 pi) = 10.03 AU each', () => {
    const d = shellDepths([0, 0, 0], [1, 0, 0]); // measured 10.026513, 10.026252
    expect(d.ts).toBeCloseTo(K, 2);
    expect(d.hp).toBeCloseTo(K, 2);
  });
  it('sees two crossings of each shell from outside, straight through the centre: 20.05 AU each', () => {
    const d = shellDepths([1000, 0, 0], [-1, 0, 0]); // measured 20.053025, 20.052729
    expect(d.ts).toBeCloseTo(2 * K, 2);
    expect(d.hp).toBeCloseTo(2 * K, 2);
  });
  it('gives the same answer from 1,000 AU and from 670,000 AU (the closest-approach form is stable at the maximum camera distance)', () => {
    const near = shellDepths([1000, 0, 0], [-1, 0, 0]);
    const far = shellDepths([6.7e5, 0, 0], [-1, 0, 0]);
    expect(far.ts).toBeCloseTo(near.ts, 9);
    expect(far.hp).toBeCloseTo(near.hp, 9);
  });
  it('lengthens the path through a shell as the ray slants: 1/sqrt(1 - (b/R)^2) times the radial depth', () => {
    const d = shellDepths([1000, 60, 0], [-1, 0, 0]); // measured 26.135, 23.172
    expect(d.ts / (2 * K / Math.sqrt(1 - (60 / TERMINATION_SHOCK_AU) ** 2))).toBeGreaterThan(0.99);
    expect(d.ts / (2 * K / Math.sqrt(1 - (60 / TERMINATION_SHOCK_AU) ** 2))).toBeLessThan(1.01);
    expect(d.hp / (2 * K / Math.sqrt(1 - (60 / HELIOPAUSE_AU) ** 2))).toBeGreaterThan(0.99);
    expect(d.hp / (2 * K / Math.sqrt(1 - (60 / HELIOPAUSE_AU) ** 2))).toBeLessThan(1.01);
  });
  it('brightens toward the limb: a ray grazing the heliopause (b = 118 AU) is far deeper than one through the centre, and misses the inner shell', () => {
    const limb = shellDepths([1000, 118, 0], [-1, 0, 0]); // measured hp 78.44, ts 3.4e-7
    const centre = shellDepths([1000, 0, 0], [-1, 0, 0]);
    expect(limb.hp).toBeGreaterThan(3 * centre.hp);
    expect(limb.ts).toBeLessThan(1e-5);
  });
  it('sees nothing on a ray that misses the bound, or that points away from an outside camera', () => {
    expect(shellDepths([1000, 200, 0], [-1, 0, 0])).toEqual({ ts: 0, hp: 0 });
    expect(shellDepths([1000, 0, 0], [1, 0, 0])).toEqual({ ts: 0, hp: 0 });
  });
  it('sees only the shells in front of a camera that is inside them (50 AU out looking outward: one crossing each)', () => {
    const d = shellDepths([50, 0, 0], [1, 0, 0]); // measured 10.026513, 10.026220
    expect(d.ts).toBeCloseTo(K, 2);
    expect(d.hp).toBeCloseTo(K, 2);
  });
  it('is converged at 64 steps: within 0.1% of a 256-step march, at the centre and at the limb', () => {
    for (const b of [0, 118]) {
      const coarse = shellDepths([1000, b, 0], [-1, 0, 0]);
      const fine = shellDepths([1000, b, 0], [-1, 0, 0], 256);
      expect(Math.abs(coarse.hp / fine.hp - 1)).toBeLessThan(1e-3);
    }
  });
});

describe('heliosphereAlpha and terminationShare', () => {
  it('turns the summed depth into an opacity, 1 - exp(-tau), tau = depth x 0.01 per AU', () => {
    expect(HELIO_TAU_PER_AU).toBe(0.01);
    expect(heliosphereAlpha(0, 0)).toBe(0);
    expect(heliosphereAlpha(10.0265, 10.0263)).toBeCloseTo(0.1817, 3); // the view from the Sun, measured 0.18170
    expect(heliosphereAlpha(20.053, 20.0527)).toBeCloseTo(0.3304, 3); // straight through from outside, measured 0.33039
    expect(heliosphereAlpha(20.053, 20.0527, 0.5)).toBeCloseTo(0.1652, 3);
    expect(heliosphereAlpha(3.36e-7, 78.44)).toBeCloseTo(0.5436, 3); // the limb, measured 0.54361
  });
  it('is bounded below 1 and grows with depth', () => {
    expect(heliosphereAlpha(1e6, 1e6)).toBeLessThanOrEqual(1);
    expect(heliosphereAlpha(30, 30)).toBeGreaterThan(heliosphereAlpha(20, 20));
  });
  it('reports the termination shock\'s share of the depth, and zero when there is no depth', () => {
    expect(terminationShare(10, 10)).toBeCloseTo(0.5, 12);
    expect(terminationShare(0, 5)).toBe(0);
    expect(terminationShare(5, 0)).toBe(1);
    expect(terminationShare(0, 0)).toBe(0);
  });
});

describe('heliosphereOpacity', () => {
  it('is zero at planet scale and inside the shells (below 1.5e13 m, about 100 AU): no sky-wide haze', () => {
    expect(HELIO_FADE_LOW_M).toBe(1.5e13);
    expect(HELIO_FADE_HIGH_M).toBe(1e14);
    expect(heliosphereOpacity(1)).toBe(0);
    expect(heliosphereOpacity(1e9)).toBe(0);
    expect(heliosphereOpacity(1e13)).toBe(0);
    expect(heliosphereOpacity(1.5e13)).toBe(0);
  });
  it('ramps to 0.9 by 1e14 m (about 670 AU, well outside the bubble) and stays there out to the 1e17 m maximum', () => {
    expect(HELIO_MAX_OPACITY).toBe(0.9);
    expect(heliosphereOpacity(5.75e13)).toBeCloseTo(0.45, 12); // the midpoint of the ramp
    expect(heliosphereOpacity(1e14)).toBeCloseTo(0.9, 12);
    expect(heliosphereOpacity(1e17)).toBeCloseTo(0.9, 12);
  });
  it('never decreases with altitude', () => {
    let previous = 0;
    for (let a = 1e12; a < 1e17; a *= 1.2) {
      expect(heliosphereOpacity(a)).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = heliosphereOpacity(a);
    }
  });
});
