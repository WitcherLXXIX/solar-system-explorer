import { describe, expect, it } from 'vitest';
import { BODIES } from '../../src/catalog/bodies';
import { ALLOWED_TEXTURE_HOSTS, TEXTURE_SOURCES, isAllowedHost } from '../../src/catalog/textureSources';
import { allTextureFiles, textureFileName } from '../../src/catalog/textureFiles';

describe('isAllowedHost', () => {
  it('allows only the listed hosts over https', () => {
    expect(isAllowedHost('https://photojournal.jpl.nasa.gov/jpeg/PIA00000.jpg')).toBe(true);
    expect(isAllowedHost('https://www.solarsystemscope.com/textures/download/2k_moon.jpg')).toBe(true);
    expect(isAllowedHost('http://photojournal.jpl.nasa.gov/jpeg/PIA00000.jpg')).toBe(false);
    expect(isAllowedHost('https://example.com/a.jpg')).toBe(false);
    expect(isAllowedHost('https://photojournal.jpl.nasa.gov.evil.example/a.jpg')).toBe(false);
    expect(isAllowedHost('not a url')).toBe(false);
  });
  it('lists exactly the domains this project may contact for images', () => {
    expect([...ALLOWED_TEXTURE_HOSTS].sort()).toEqual([
      'astrogeology.usgs.gov', 'photojournal.jpl.nasa.gov', 'planetarymaps.usgs.gov', 'pds-imaging.jpl.nasa.gov',
      'science.nasa.gov', 'ssd.jpl.nasa.gov', 'www.solarsystemscope.com',
    ].sort());
  });
});

describe('texture sources', () => {
  it('has a documented allowed URL, credit and licence for every non-Solar-System-Scope file, and each file is in the catalog', () => {
    const files = new Set(allTextureFiles());
    for (const [file, source] of Object.entries(TEXTURE_SOURCES)) {
      expect(files.has(file), `${file} is referenced by the catalog`).toBe(true);
      expect(isAllowedHost(source.url), `${file} url`).toBe(true);
      expect(source.credit.length, `${file} credit`).toBeGreaterThan(5);
      expect(source.licence.length, `${file} licence`).toBeGreaterThan(5);
      expect(file.endsWith('.jpg'), file).toBe(true);
    }
  });
  it('credits every map that is not from Solar System Scope', () => {
    for (const b of BODIES) {
      const stem = b.maps.color?.lo;
      if (!stem) continue;
      const fromSources = TEXTURE_SOURCES[textureFileName(stem)] !== undefined;
      if (fromSources) expect(b.mapCredit?.length ?? 0, `${b.id} mapCredit`).toBeGreaterThan(5);
    }
  });
  it('never uses an artist-drawn or "fictional" map for a dwarf planet', () => {
    for (const b of BODIES.filter((x) => x.kind === 'dwarf')) {
      const stem = b.maps.color?.lo ?? '';
      expect(stem, b.id).not.toMatch(/fictional/);
      if (stem) expect(TEXTURE_SOURCES[textureFileName(stem)], `${b.id} must come from a real-data source`).toBeDefined();
    }
  });
});
