import { describe, expect, it } from 'vitest';
import {
  MOON_LABEL_RADII, MOON_ORBIT_FULL_RADII, MOON_ORBIT_GONE_RADII, labelPriority, moonLabelVisible, moonOrbitOpacity,
  orbitStaleMs, spriteHiddenByParent, starLabelVisible, STAR_LABEL_MIN_ALTITUDE_M,
} from '../../src/render/orbitFade';

const R = 1e9; // a moon orbit radius

describe('moonOrbitOpacity', () => {
  it('is the full 0.55 when the camera is near the parent but well away from the moon', () => {
    expect(moonOrbitOpacity(5 * R, 5 * R, R)).toBeCloseTo(0.55, 12);
  });
  it('fades to nothing once the camera is 60 orbit radii from the parent', () => {
    expect(moonOrbitOpacity(MOON_ORBIT_GONE_RADII * R, MOON_ORBIT_GONE_RADII * R, R)).toBe(0);
    expect(moonOrbitOpacity(1e6 * R, 1e6 * R, R)).toBe(0);
  });
  it('is half-faded at the midpoint of the fade band (37.5 radii): 0.275', () => {
    expect(moonOrbitOpacity(37.5 * R, 37.5 * R, R)).toBeCloseTo(0.275, 12);
    expect(MOON_ORBIT_FULL_RADII).toBe(15);
  });
  it('still uses the near-moon rule: the line vanishes when the camera is within 0.4% of the orbit radius of the moon', () => {
    expect(moonOrbitOpacity(R, 0.003 * R, R)).toBe(0);
    expect(moonOrbitOpacity(R, 0.05 * R, R)).toBeCloseTo(0.55, 12);
  });
});

describe('moonLabelVisible', () => {
  it('shows moon labels only within 25 orbit radii of the parent', () => {
    expect(MOON_LABEL_RADII).toBe(25);
    expect(moonLabelVisible(24 * R, R)).toBe(true);
    expect(moonLabelVisible(25 * R, R)).toBe(false);
    expect(moonLabelVisible(1e4 * R, R)).toBe(false);
  });
});

describe('orbitStaleMs', () => {
  it('is ten orbital periods for a moon: the Moon\'s 27.321661 days give 23,605,915,104 ms', () => {
    expect(orbitStaleMs(27.321661)).toBeCloseTo(23_605_915_104, 0);
    expect(orbitStaleMs(0.3189)).toBeCloseTo(275_529_600, 0); // Phobos: about 3.2 days
  });
  it('never goes below one day or above ten years', () => {
    expect(orbitStaleMs(0.05)).toBe(86_400_000);
    expect(orbitStaleMs(60_190)).toBe(315_576_000_000); // Neptune: capped at ten Julian years
  });
});

describe('labelPriority', () => {
  it('ranks every planet, dwarf planet and the Sun above every moon', () => {
    const ganymede = labelPriority('moon', 2_634_100); // the largest moon in the catalog
    expect(labelPriority('planet', 2_439_400)).toBeGreaterThan(ganymede); // Mercury, the smallest planet
    expect(labelPriority('dwarf', 4.7e5)).toBeGreaterThan(ganymede); // about Ceres
    expect(labelPriority('star', 6.957e8)).toBeGreaterThan(labelPriority('planet', 6.9911e7));
  });
  it('orders bodies of the same kind by radius', () => {
    expect(labelPriority('moon', 2_574_700)).toBeGreaterThan(labelPriority('moon', 1_737_400));
  });
});

describe('spriteHiddenByParent', () => {
  it('hides a moon whose dot overlaps its parent\'s dot', () => {
    expect(spriteHiddenByParent({ x: 100, y: 100, drawnPx: 4 }, { x: 102, y: 100, drawnPx: 6 })).toBe(true);
  });
  it('keeps a moon whose dot is clear of the parent', () => {
    expect(spriteHiddenByParent({ x: 100, y: 100, drawnPx: 4 }, { x: 110, y: 100, drawnPx: 6 })).toBe(false);
  });
  it('treats touching dots as clear (the moon is hidden only when the centres are closer than the summed radii)', () => {
    expect(spriteHiddenByParent({ x: 100, y: 100, drawnPx: 4 }, { x: 105, y: 100, drawnPx: 6 })).toBe(false);
  });
  it('hides a moon that sits inside a large parent disc', () => {
    expect(spriteHiddenByParent({ x: 300, y: 300, drawnPx: 4 }, { x: 320, y: 300, drawnPx: 120 })).toBe(true);
  });
});

describe('star labels', () => {
  it('appear only from about 6.7 AU of altitude up, or when the star is the focused body', () => {
    expect(STAR_LABEL_MIN_ALTITUDE_M).toBe(1e12);
    expect(starLabelVisible(1e7, false)).toBe(false); // close to a planet: twelve stray names would be clutter
    expect(starLabelVisible(9.9e11, false)).toBe(false);
    expect(starLabelVisible(1e12, false)).toBe(true);
    expect(starLabelVisible(1e17, false)).toBe(true);
    expect(starLabelVisible(1e3, true)).toBe(true); // flying to a star keeps its own name
  });
  it('rank below every planet in the declutter, like moons, so a star never hides a planet label', () => {
    expect(labelPriority('nearstar', 1.18e9)).toBeLessThan(labelPriority('planet', 2.4e6));
    expect(labelPriority('nearstar', 1.18e9)).toBeCloseTo(labelPriority('moon', 1.18e9), 12);
    expect(labelPriority('nearstar', 1.18e9)).toBeGreaterThan(labelPriority('nearstar', 1.7e8)); // bigger star wins between the pair Sirius A and B
  });
});
