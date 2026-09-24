/// <reference path="../../node.d.ts" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NEARBY_STARS, NEARBY_STAR_BODIES, SOLAR_RADIUS_M, STAR_CLASS_STYLE, spectralClass } from '../../src/catalog/stars';

const SPEC = fileURLToPath(new URL('../../docs/superpowers/specs/2026-09-23-deep-space-design.md', import.meta.url));

interface SpecRow {
  name: string;
  ra: [number, number, number];
  dec: [number, number, number, number];
  distanceLy: number;
  spectralType: string;
}

/** Reads the star table straight out of the approved spec (RA "14h 29m 43.0s", Dec "−62° 40′ 46″" with a real minus sign). */
function specTable(): SpecRow[] {
  const text = readFileSync(SPEC, 'utf8');
  const section = text.split('## Star data')[1]!.split('\n## ')[0]!;
  const rows = section.split('\n').filter((line: string) => line.startsWith('|')).slice(2); // drop the header and the divider
  return rows.map((line: string) => {
    const cells = line.split('|').slice(1, -1).map((c: string) => c.trim());
    const ra = /^(\d+)h (\d+)m ([\d.]+)s$/.exec(cells[1]!);
    const dec = /^([−+-])(\d+)° (\d+)′ (\d+)″$/.exec(cells[2]!);
    if (!ra || !dec) throw new Error(`cannot parse the spec row: ${line}`);
    return {
      name: cells[0]!,
      ra: [Number(ra[1]), Number(ra[2]), Number(ra[3])],
      dec: [dec[1] === '+' ? 1 : -1, Number(dec[2]), Number(dec[3]), Number(dec[4])],
      distanceLy: Number(cells[3]),
      spectralType: cells[4]!,
    };
  });
}

describe('the star catalog matches the spec table exactly', () => {
  const table = specTable();
  it('reads twelve rows from the spec', () => {
    expect(table).toHaveLength(12);
    expect(table[0]!.name).toBe('Proxima Centauri');
    expect(table[0]!.ra).toEqual([14, 29, 43.0]);
    expect(table[0]!.dec).toEqual([-1, 62, 40, 46]);
  });
  it('stores the same twelve stars in the same order with identical name, RA, Dec, distance and spectral type', () => {
    expect(NEARBY_STARS).toHaveLength(12);
    NEARBY_STARS.forEach((star, i) => {
      const row = table[i]!;
      expect(star.name, `row ${i}`).toBe(row.name);
      expect([star.ra.h, star.ra.m, star.ra.s], star.name).toEqual(row.ra);
      expect([star.dec.sign, star.dec.d, star.dec.m, star.dec.s], star.name).toEqual(row.dec);
      expect(star.distanceLy, star.name).toBe(row.distanceLy);
      expect(star.spectralType, star.name).toBe(row.spectralType);
    });
  });
});

describe('catalog structure', () => {
  it('has unique ids and names and a body for every star, none with a parent', () => {
    expect(new Set(NEARBY_STARS.map((s) => s.id)).size).toBe(12);
    expect(new Set(NEARBY_STARS.map((s) => s.name)).size).toBe(12);
    expect(NEARBY_STAR_BODIES.map((b) => b.id)).toEqual(NEARBY_STARS.map((s) => s.id));
    for (const b of NEARBY_STAR_BODIES) {
      expect(b.kind, b.id).toBe('nearstar');
      expect(b.parent, b.id).toBeNull();
      expect(b.orbitSource, b.id).toBeNull();
      expect(b.radiusM, b.id).toBeGreaterThan(0);
      expect(b.rotationPeriodH, b.id).toBeNull();
      expect(b.source, b.id).toMatch(/List of nearest stars/);
      expect(b.source, b.id).toMatch(/schematic/i);
      expect(b.spectralType, b.id).toBeDefined();
    }
  });
  it('orders the stars from the table and reaches out to 11.4 ly, no farther', () => {
    expect(Math.max(...NEARBY_STARS.map((s) => s.distanceLy))).toBe(11.4039);
    expect(Math.min(...NEARBY_STARS.map((s) => s.distanceLy))).toBe(4.2465);
  });
  it('gives only Sirius B a schematic offset (its table position is identical to Sirius A)', () => {
    const withOffset = NEARBY_STARS.filter((s) => s.schematicOffsetNorthArcsec !== undefined).map((s) => s.id);
    expect(withOffset).toEqual(['siriusb']);
  });
});

describe('spectral classes and schematic radii', () => {
  it('reads the class from the spectral type: the first letter, or D for a white dwarf', () => {
    expect(spectralClass('M5.5Ve')).toBe('M');
    expect(spectralClass('G2V')).toBe('G');
    expect(spectralClass('K5.0V')).toBe('K');
    expect(spectralClass('A1V')).toBe('A');
    expect(spectralClass('DA2')).toBe('D');
    expect(NEARBY_STARS.map((s) => spectralClass(s.spectralType))).toEqual(
      ['M', 'G', 'K', 'M', 'M', 'M', 'A', 'D', 'M', 'K', 'M', 'K'],
    );
  });
  it('refuses a class it has no style for, instead of drawing something wrong', () => {
    expect(() => spectralClass('B2V')).toThrow(/spectral class/);
    expect(() => spectralClass('')).toThrow(/spectral class/);
  });
  it('sets each radius from the class, in solar radii (Ruling 4), and the Sun radius matches the Sun body', () => {
    expect(SOLAR_RADIUS_M).toBe(695_700_000);
    const radius = (id: string): number => NEARBY_STAR_BODIES.find((b) => b.id === id)!.radiusM;
    expect(radius('siriusa')).toBeCloseTo(1.7 * SOLAR_RADIUS_M, 0);
    expect(radius('alphacena')).toBeCloseTo(1.1 * SOLAR_RADIUS_M, 0);
    expect(radius('alphacenb')).toBeCloseTo(0.8 * SOLAR_RADIUS_M, 0);
    expect(radius('proxima')).toBeCloseTo(0.25 * SOLAR_RADIUS_M, 0);
    expect(radius('siriusb')).toBeCloseTo(0.01 * SOLAR_RADIUS_M, 0);
    for (const style of Object.values(STAR_CLASS_STYLE)) expect(style.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
