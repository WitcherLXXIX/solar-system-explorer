import { describe, expect, it } from 'vitest';
import { MIN_ALTITUDE_FRACTION } from '../../src/camera/cameraController';
import { BODIES, BODY_IDS, getBody, type BodyId } from '../../src/catalog/bodies';
import { allTextureFiles, textureFileName } from '../../src/catalog/textureFiles';

describe('catalog', () => {
  it('lists the Sun and eight planets in order', () => {
    expect(BODY_IDS.slice(0, 9)).toEqual(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    expect(BODY_IDS).toHaveLength(43);
  });
  it('has unique ids and finite, positive physical values', () => {
    expect(new Set(BODIES.map((b) => b.id)).size).toBe(BODIES.length);
    for (const b of BODIES) {
      expect(b.radiusM, b.id).toBeGreaterThan(0);
      expect(b.massKg ?? 1, b.id).toBeGreaterThan(0);
      expect(b.surfaceGravity ?? 1, b.id).toBeGreaterThan(0);
      expect(b.meanTempK ?? 1, b.id).toBeGreaterThan(0);
      expect(Number.isFinite(b.rotationPeriodH ?? 1), b.id).toBe(true);
      expect(b.rotationPeriodH, b.id).not.toBe(0);
      expect(b.maps.color?.lo.length ?? 1, b.id).toBeGreaterThan(0);
      expect(b.source.length, b.id).toBeGreaterThan(0);
    }
  });
  it('matches well-known values', () => {
    expect(getBody('earth').radiusM).toBeCloseTo(6_371_000, -3);
    expect(getBody('sun').radiusM).toBeCloseTo(695_700_000, -3);
    expect(getBody('jupiter').massKg! / 1.898e27).toBeCloseTo(1, 2);
    expect(getBody('sun').kind).toBe('star');
    expect(getBody('earth').kind).toBe('planet');
  });
  it('marks retrograde rotators with negative periods', () => {
    expect(getBody('venus').rotationPeriodH).toBeLessThan(0);
    expect(getBody('uranus').rotationPeriodH).toBeLessThan(0);
    expect(getBody('earth').rotationPeriodH).toBeGreaterThan(0);
  });
});

describe('phase 2a catalog data', () => {
  const ids = (pick: (b: (typeof BODIES)[number]) => unknown): BodyId[] => BODIES.filter((b) => pick(b)).map((b) => b.id);

  it('has 8K maps exactly where the source provides them', () => {
    expect(ids((b) => b.maps.color?.hi)).toEqual(['sun', 'mercury', 'earth', 'mars', 'jupiter', 'saturn', 'moon']);
  });
  it('uses the 4K cloud-top map as the Venus base map', () => {
    expect(getBody('venus').maps.color?.lo).toBe('4k_venus_atmosphere');
  });
  it('gives Earth night and cloud maps with 2K and 8K tiers', () => {
    const earth = getBody('earth');
    expect(earth.maps.night).toEqual({ lo: '2k_earth_nightmap', hi: '8k_earth_nightmap' });
    expect(earth.maps.clouds).toEqual({ lo: '2k_earth_clouds', hi: '8k_earth_clouds' });
    expect(earth.oceanGlint).toBeDefined();
  });
  it('attaches atmospheres to Earth, Venus, Mars and the four giants only', () => {
    expect(ids((b) => b.atmosphere)).toEqual(['venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan', 'pluto']);
    for (const b of BODIES) {
      if (!b.atmosphere) continue;
      const a = b.atmosphere;
      expect(a.heightFraction, b.id).toBeGreaterThan(0);
      expect(a.scaleHeightFraction, b.id).toBeGreaterThan(0);
      expect(a.scaleHeightFraction, b.id).toBeLessThan(a.heightFraction);
      expect(a.mieScaleHeightFraction, b.id).toBeGreaterThan(0);
      expect(a.mieG, b.id).toBeGreaterThan(-1);
      expect(a.mieG, b.id).toBeLessThan(1);
    }
  });
  it('attaches rings to the four giants, textured for Saturn and procedural for the rest', () => {
    expect(ids((b) => b.rings)).toEqual(['jupiter', 'saturn', 'uranus', 'neptune']);
    expect(getBody('saturn').rings?.alphaMap).toEqual({ lo: '2k_saturn_ring_alpha', hi: '8k_saturn_ring_alpha' });
    for (const id of ['jupiter', 'uranus', 'neptune'] as const) {
      expect(getBody(id).rings?.alphaMap, id).toBeUndefined();
      expect(getBody(id).rings?.bands?.length ?? 0, id).toBeGreaterThan(0);
    }
  });
  it('orders ring radii and keeps every procedural band inside them, outside the planet', () => {
    for (const b of BODIES) {
      if (!b.rings) continue;
      const { innerM, outerM, bands } = b.rings;
      expect(innerM, b.id).toBeGreaterThan(b.radiusM);
      expect(outerM, b.id).toBeGreaterThan(innerM);
      for (const band of bands ?? []) {
        const lo = (band.centerKm - band.widthKm / 2) * 1000;
        const hi = (band.centerKm + band.widthKm / 2) * 1000;
        expect(lo, `${b.id} band ${band.centerKm}`).toBeGreaterThanOrEqual(innerM);
        expect(hi, `${b.id} band ${band.centerKm}`).toBeLessThanOrEqual(outerM);
        expect(band.opacity, b.id).toBeGreaterThan(0);
        expect(band.opacity, b.id).toBeLessThanOrEqual(1);
      }
    }
  });
  it('keeps the cloud shell below the camera minimum altitude', () => {
    const earth = getBody('earth');
    expect(earth.cloudShellFraction).toBeDefined();
    expect(earth.cloudShellFraction!).toBeLessThan(MIN_ALTITUDE_FRACTION);
  });
});

describe('textureFiles', () => {
  it('names ring alpha strips as PNG and everything else as JPEG', () => {
    expect(textureFileName('8k_saturn_ring_alpha')).toBe('8k_saturn_ring_alpha.png');
    expect(textureFileName('8k_mars')).toBe('8k_mars.jpg');
  });
  it('lists every file the catalog references exactly once', () => {
    const files = allTextureFiles();
    expect(new Set(files).size).toBe(files.length);
    for (const f of [
      '2k_sun.jpg', '8k_sun.jpg', '2k_mercury.jpg', '8k_mercury.jpg', '4k_venus_atmosphere.jpg',
      '2k_earth_daymap.jpg', '8k_earth_daymap.jpg', '2k_earth_nightmap.jpg', '8k_earth_nightmap.jpg',
      '2k_earth_clouds.jpg', '8k_earth_clouds.jpg', '2k_mars.jpg', '8k_mars.jpg', '2k_jupiter.jpg', '8k_jupiter.jpg',
      '2k_saturn.jpg', '8k_saturn.jpg', '2k_saturn_ring_alpha.png', '8k_saturn_ring_alpha.png', '2k_uranus.jpg', '2k_neptune.jpg',
    ]) {
      expect(files, f).toContain(f);
    }
    expect(files).not.toContain('2k_venus_surface.jpg');
  });
});
