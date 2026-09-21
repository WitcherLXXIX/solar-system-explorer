import { describe, expect, it } from 'vitest';
import {
  density, MIE_EXTINCTION_FACTOR, opticalDepth, opticalExtinction, raySphere, SHADOW_EDGE, shadowFactor, useSkyPass, viewSegment,
} from '../../src/render/atmosphereMath';

describe('raySphere', () => {
  it('returns entry and exit distances for a ray that crosses the sphere', () => {
    const hit = raySphere([0, 0, 3], [0, 0, -1], 1)!;
    expect(hit[0]).toBeCloseTo(2, 12);
    expect(hit[1]).toBeCloseTo(4, 12);
  });
  it('returns null on a miss and a negative entry from inside', () => {
    expect(raySphere([0, 5, 3], [0, 0, -1], 1)).toBeNull();
    const inside = raySphere([0, 0, 0.5], [0, 0, 1], 1)!;
    expect(inside[0]).toBeLessThan(0);
    expect(inside[1]).toBeCloseTo(0.5, 12);
  });
});

describe('density and opticalDepth', () => {
  it('falls off exponentially and is 1 at and below the surface', () => {
    expect(density(0, 0.01)).toBe(1);
    expect(density(-1, 0.01)).toBe(1);
    expect(density(0.01, 0.01)).toBeCloseTo(Math.exp(-1), 12);
  });
  it('matches the analytic vertical optical depth H(1 - exp(-h/H))', () => {
    const H = 0.00126;
    const shellHeight = 0.0157;
    const od = opticalDepth([0, 1, 0], [0, 1, 0], shellHeight, H, 256);
    const analytic = H * (1 - Math.exp(-shellHeight / H));
    expect(od / analytic).toBeGreaterThan(0.999);
    expect(od / analytic).toBeLessThan(1.001);
  });
  it('is much larger along a grazing path than straight up', () => {
    const H = 0.00126;
    const shell = 1.0157;
    const origin = [-2, 1.0005, 0] as const;
    const seg = viewSegment(origin, [1, 0, 0], shell)!;
    const grazing = opticalDepth([origin[0] + seg[0], origin[1], 0], [1, 0, 0], seg[1] - seg[0], H, 256);
    const vertical = opticalDepth([0, 1, 0], [0, 1, 0], 0.0157, H, 256);
    expect(grazing).toBeGreaterThan(5 * vertical);
  });
});

describe('viewSegment', () => {
  it('stops at the surface when the ray hits the planet', () => {
    const seg = viewSegment([0, 0, 3], [0, 0, -1], 1.0157)!;
    expect(seg[0]).toBeCloseTo(3 - 1.0157, 12);
    expect(seg[1]).toBeCloseTo(2, 12);
  });
  it('starts at the camera when the camera is inside the shell', () => {
    const seg = viewSegment([0, 0, 1.005], [0, 0, -1], 1.0157)!;
    expect(seg[0]).toBe(0);
    expect(seg[1]).toBeCloseTo(0.005, 12);
  });
  it('covers the full shell chord for a ray that misses the planet', () => {
    const seg = viewSegment([-2, 1.01, 0], [1, 0, 0], 1.0157)!;
    const half = Math.sqrt(1.0157 * 1.0157 - 1.01 * 1.01);
    expect(seg[1] - seg[0]).toBeCloseTo(2 * half, 10);
  });
  it('returns null when the ray misses the shell', () => {
    expect(viewSegment([0, 3, 3], [0, 0, -1], 1.0157)).toBeNull();
  });
});

describe('shadowFactor', () => {
  const sun = [0, 0, 1] as const;
  it('is fully lit on the sunward hemisphere, even directly in line with the planet', () => {
    expect(shadowFactor([0, 0, 1.01], sun)).toBe(1);
    expect(shadowFactor([0.3, 0, 1.01], sun)).toBe(1);
    expect(shadowFactor([0.2, 0.2, 0], sun)).toBe(1); // on the terminator plane
  });
  it('is fully dark behind the planet, inside its cylindrical shadow', () => {
    expect(shadowFactor([0, 0, -1.01], sun)).toBe(0);
    expect(shadowFactor([0.5, 0, -1.2], sun)).toBe(0);
    expect(shadowFactor([0, SHADOW_EDGE - 0.001, -1.01], sun)).toBe(0);
  });
  it('is fully lit behind the planet once clear of the shadow cylinder', () => {
    expect(shadowFactor([0, 1.0, -1.01], sun)).toBe(1);
    expect(shadowFactor([1.02, 0, -0.2], sun)).toBe(1);
  });
  it('is 0.5 at the middle of the soft edge and does not reach the previous wide 0.95 edge', () => {
    const mid = (SHADOW_EDGE + 1) / 2;
    expect(shadowFactor([mid, 0, -0.5], sun)).toBeCloseTo(0.5, 12);
    expect(SHADOW_EDGE).toBeGreaterThanOrEqual(0.97);
  });
  it('is monotonic non-decreasing with distance from the sun axis, and does not depend on the depth behind the planet', () => {
    let last = -1;
    for (let r = 0.9; r <= 1.1; r += 0.001) {
      const f = shadowFactor([r, 0, -0.7], sun);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
    expect(shadowFactor([0.99, 0, -0.1], sun)).toBeCloseTo(shadowFactor([0.99, 0, -3], sun), 12);
  });
  it('uses the perpendicular distance for any sun direction', () => {
    const s = [0.6, 0, 0.8] as const;
    // Perpendicular distance 1.0 from the axis, behind the planet: lit. Perpendicular distance 0.9: dark.
    expect(shadowFactor([-0.3, 1.0, -0.4], s)).toBe(1);
    expect(shadowFactor([-0.3, 0.9, -0.4], s)).toBe(0);
  });
});

describe('useSkyPass', () => {
  it('is true inside the shell mesh and false well outside it', () => {
    expect(useSkyPass(1.03, 1.0557, 0.0001)).toBe(true);
    expect(useSkyPass(1.2, 1.0557, 0.01)).toBe(false);
  });
  it('stays true while the near plane would clip the mesh front faces just outside it', () => {
    // 5% of the altitude is the near plane: at 360 km over Earth (radii: 1.0565) it is about 18 km = 0.0028 radii.
    expect(useSkyPass(1.0565, 1.0557, 0.0028)).toBe(true);
    // Once the camera is farther from the mesh than the near plane, the front faces are drawn normally.
    expect(useSkyPass(1.0557 + 0.0029, 1.0557, 0.0028)).toBe(false);
  });
});

describe('opticalExtinction', () => {
  it('adds Rayleigh per channel and Mie with the extinction factor (values computed by hand)', () => {
    // Rayleigh (1, 2, 3) x od 0.5 = (0.5, 1, 1.5); Mie 10 x 1.1 x od 0.2 = 2.2 added to every channel.
    const tau = opticalExtinction([1, 2, 3], 10, 0.5, 0.2);
    expect(tau[0]).toBeCloseTo(2.7, 12);
    expect(tau[1]).toBeCloseTo(3.2, 12);
    expect(tau[2]).toBeCloseTo(3.7, 12);
    expect(MIE_EXTINCTION_FACTOR).toBe(1.1);
  });
});
