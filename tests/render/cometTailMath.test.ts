import { describe, expect, it } from 'vitest';
import {
  TAIL_COLOR_DUST, TAIL_COLOR_ION, TAIL_FULL_AU, TAIL_GONE_AU, TAIL_MAX_LENGTH_AU, TAIL_PEAK_ALPHA, tailActivity, tailAlpha, tailColor,
  tailDirection, tailLengthM, tailZoomFade,
} from '../../src/render/cometTailMath';
import { AU_M } from '../../src/units';

describe('tailDirection', () => {
  it('points from the Sun through the comet, away from the Sun', () => {
    expect(tailDirection([3, 0, 4])).toEqual([0.6000000000000001, 0, 0.8]);
    const d = tailDirection([-2e11, 1e11, 5e10]);
    expect(Math.hypot(...d)).toBeCloseTo(1, 12);
    expect(d[0]).toBeLessThan(0); // the comet is at -x of the Sun, so the tail streams toward -x
  });
  it('refuses a comet sitting on the Sun', () => {
    expect(() => tailDirection([0, 0, 0])).toThrow();
  });
});

describe('tailActivity and tailLengthM', () => {
  it('is 1 inside 1 AU (Halley at its perihelion, 0.587 AU, is at full strength) and 0 from 4 AU outward', () => {
    expect(TAIL_FULL_AU).toBe(1);
    expect(TAIL_GONE_AU).toBe(4);
    expect(tailActivity(0.587)).toBe(1);
    expect(tailActivity(1)).toBe(1);
    expect(tailActivity(4)).toBe(0);
    expect(tailActivity(35)).toBe(0);
  });
  it('falls smoothly in between (values computed with node: 2 AU 0.7407, 2.5 AU 0.5, 3.5 AU 0.0741)', () => {
    expect(tailActivity(2)).toBeCloseTo(0.7407407, 6);
    expect(tailActivity(2.5)).toBeCloseTo(0.5, 12);
    expect(tailActivity(3.5)).toBeCloseTo(0.0740741, 6);
  });
  it('never increases with distance', () => {
    let previous = 1;
    for (let r = 0.1; r < 6; r += 0.05) {
      expect(tailActivity(r)).toBeLessThanOrEqual(previous + 1e-12);
      previous = tailActivity(r);
    }
  });
  it('gives a 0.3 AU tail at full strength, half of that at half strength, and none at zero', () => {
    expect(TAIL_MAX_LENGTH_AU).toBe(0.3);
    expect(tailLengthM(1)).toBeCloseTo(0.3 * AU_M, 3);
    expect(tailLengthM(0.5)).toBeCloseTo(0.15 * AU_M, 3);
    expect(tailLengthM(0)).toBe(0);
  });
});

describe('tailZoomFade', () => {
  it('hides a tail under 2 px, fades to full at 8 px and stays full', () => {
    expect(tailZoomFade(0)).toBe(0);
    expect(tailZoomFade(2)).toBe(0);
    expect(tailZoomFade(5)).toBeCloseTo(0.5, 12);
    expect(tailZoomFade(8)).toBe(1);
    expect(tailZoomFade(500)).toBe(1);
  });
});

describe('tailAlpha and tailColor', () => {
  it('is brightest at the nucleus on the axis and dies at the far end and at the edges', () => {
    expect(tailAlpha(0, 0, 1)).toBeCloseTo(TAIL_PEAK_ALPHA, 12);
    expect(tailAlpha(1, 0, 1)).toBe(0);
    expect(tailAlpha(0.5, 1, 1)).toBe(0);
    expect(tailAlpha(0.5, -1, 1)).toBe(0);
  });
  it('matches values computed with node (0.5 along on the axis 0.18143, and half way across at half brightness 0.02268)', () => {
    expect(tailAlpha(0.5, 0, 1)).toBeCloseTo(0.1814323, 6);
    expect(tailAlpha(0.5, 0.5, 0.5)).toBeCloseTo(0.0226790, 6);
  });
  it('is symmetric across the tail, scales with brightness and is zero outside the tail', () => {
    expect(tailAlpha(0.3, 0.4, 1)).toBeCloseTo(tailAlpha(0.3, -0.4, 1), 12);
    expect(tailAlpha(0.3, 0.4, 0.5)).toBeCloseTo(0.5 * tailAlpha(0.3, 0.4, 1), 12);
    expect(tailAlpha(-0.1, 0, 1)).toBe(0);
    expect(tailAlpha(1.1, 0, 1)).toBe(0);
    expect(tailAlpha(0.5, 1.5, 1)).toBe(0);
    expect(tailAlpha(0.5, 0, 0)).toBe(0);
  });
  it('shades from dust to ion colour', () => {
    expect(tailColor(0)).toEqual([...TAIL_COLOR_DUST]);
    expect(tailColor(1)).toEqual([...TAIL_COLOR_ION]);
    expect(tailColor(0.5)[0]).toBeCloseTo(0.775, 12);
    expect(tailColor(-3)).toEqual([...TAIL_COLOR_DUST]);
    expect(tailColor(9)).toEqual([...TAIL_COLOR_ION]);
  });
});
