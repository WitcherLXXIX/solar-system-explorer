import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_CREDIT, DEEP_SPACE_NOTE, SKY_NOTE, STAR_NOTE, deepSpaceCaption, formatGravity, kindLabel, mapNote } from '../../src/ui/bodyText';

describe('deep-space notes', () => {
  it('says the heliosphere and Oort cloud are schematic, nothing solid, and no individual Oort object has been observed', () => {
    expect(DEEP_SPACE_NOTE).toMatch(/schematic/);
    expect(DEEP_SPACE_NOTE).toMatch(/termination shock/);
    expect(DEEP_SPACE_NOTE).toMatch(/heliopause/);
    expect(DEEP_SPACE_NOTE).toMatch(/Oort/);
    expect(DEEP_SPACE_NOTE).toMatch(/nothing solid/);
    expect(DEEP_SPACE_NOTE).toContain('94 AU');
    expect(DEEP_SPACE_NOTE).toContain('120 AU');
    expect(DEEP_SPACE_NOTE).toContain('15,000');
    expect(DEEP_SPACE_NOTE).toContain('mostly between 2,000 and 100,000 AU');
  });
  it("says a star's position is real and fixed but its radius is schematic", () => {
    expect(STAR_NOTE).toMatch(/Gaia/);
    expect(STAR_NOTE).toMatch(/fixed/);
    expect(STAR_NOTE).toMatch(/schematic/);
  });
  it('shows the on-screen caption only when the shells can be seen (from 1.5e13 m up) and the toggle is on', () => {
    expect(deepSpaceCaption(1e9, true)).toBe('');
    expect(deepSpaceCaption(1.49e13, true)).toBe('');
    expect(deepSpaceCaption(1.5e13, true)).toMatch(/schematic/);
    expect(deepSpaceCaption(1e17, true)).toMatch(/Heliosphere/);
    expect(deepSpaceCaption(1e17, true)).toMatch(/Oort/);
    expect(deepSpaceCaption(1e17, false)).toBe('');
  });
});

describe('kindLabel', () => {
  it('names each kind, and the parent of a moon', () => {
    expect(kindLabel('star', null)).toBe('Star (G2V)');
    expect(kindLabel('planet', null)).toBe('Planet');
    expect(kindLabel('dwarf', null)).toBe('Dwarf planet');
    expect(kindLabel('moon', 'Jupiter')).toBe('Moon of Jupiter');
    expect(kindLabel('moon', 'Pluto')).toBe('Moon of Pluto');
  });
  it('still says Moon when the parent name is missing', () => {
    expect(kindLabel('moon', null)).toBe('Moon');
  });
  it('names a nearby star with its spectral type', () => {
    expect(kindLabel('nearstar', null, 'M5.5Ve')).toBe('Nearby star (M5.5Ve)');
    expect(kindLabel('nearstar', null)).toBe('Nearby star');
  });
});

describe('mapNote', () => {
  it('says plainly when there is no global map', () => {
    expect(mapNote(false)).toBe('No global map available: plain colour shown.');
    expect(mapNote(false, 'ignored')).toBe('No global map available: plain colour shown.');
  });
  it('credits the map, defaulting to Solar System Scope', () => {
    expect(mapNote(true)).toBe(`Map: ${DEFAULT_MAP_CREDIT}`);
    expect(mapNote(true, 'NASA/JPL-Caltech/USGS')).toBe('Map: NASA/JPL-Caltech/USGS');
    expect(DEFAULT_MAP_CREDIT).toContain('CC BY 4.0');
  });
});

describe('formatGravity', () => {
  it('keeps three significant figures so tiny moons do not show zero', () => {
    expect(formatGravity(0.0025)).toBe('0.00250 m/s²');
    expect(formatGravity(0.00577)).toBe('0.00577 m/s²');
    expect(formatGravity(0.284)).toBe('0.284 m/s²');
    expect(formatGravity(9.81)).toBe('9.81 m/s²');
    expect(formatGravity(274)).toBe('274 m/s²');
  });
});

describe('SKY_NOTE', () => {
  it('says the stars are real but shown in direction only, and gives the counts and the source', () => {
    expect(SKY_NOTE).toContain('direction');
    expect(SKY_NOTE).toContain('not at its real distance');
    expect(SKY_NOTE).toContain('48');
    expect(SKY_NOTE).toContain('5,022');
    expect(SKY_NOTE).toContain('HYG');
  });
});
