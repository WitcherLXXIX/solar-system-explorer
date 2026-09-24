import { describe, expect, it } from 'vitest';
import { beltOpacity } from '../../src/render/orbitFade';
import { BELT_NOTE } from '../../src/ui/bodyText';

describe('beltOpacity', () => {
  it('hides the belts at planet scale and shows them at full-system scale', () => {
    expect(beltOpacity(1)).toBe(0);
    expect(beltOpacity(1e9)).toBe(0); // close to a planet: no scattering of far dots
    expect(beltOpacity(2e9)).toBe(0);
    expect(beltOpacity(2e10)).toBeCloseTo(0.8, 12);
    expect(beltOpacity(1.2e13)).toBeCloseTo(0.8, 12); // the maximum camera distance
  });
  it('is smooth and never decreases with altitude', () => {
    expect(beltOpacity(1.1e10)).toBeCloseTo(0.4, 12); // the midpoint of the ramp
    let previous = 0;
    for (let a = 1e9; a < 1e13; a *= 1.3) {
      expect(beltOpacity(a)).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = beltOpacity(a);
    }
  });
});

describe('BELT_NOTE', () => {
  it('says the belts are schematic and not individual real objects, and that the named bodies are real', () => {
    expect(BELT_NOTE).toMatch(/schematic/);
    expect(BELT_NOTE).toMatch(/not individual real objects/);
    expect(BELT_NOTE).toMatch(/named/);
  });
});
