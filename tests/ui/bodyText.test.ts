import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_CREDIT, kindLabel, mapNote } from '../../src/ui/bodyText';

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
