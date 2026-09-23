import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_CREDIT, formatGravity, kindLabel, mapNote } from '../../src/ui/bodyText';

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
