/// <reference path="../../node.d.ts" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BACKGROUND_STARS, NOTABLE_STARS, SKY_STAR_SOURCE } from '../../src/catalog/skyStars';

const csvLines = (name: string): string[][] => {
  const path = fileURLToPath(new URL(`../../docs/data/${name}`, import.meta.url));
  return readFileSync(path, 'utf8').trim().split('\n').slice(1).map((line: string) => line.split(','));
};

describe('notable stars match docs/data/notable-stars-hyg.csv exactly', () => {
  const rows = csvLines('notable-stars-hyg.csv');
  it('has 48 rows of 8 fields and the same count in the catalog', () => {
    expect(rows).toHaveLength(48);
    for (const row of rows) expect(row).toHaveLength(8);
    expect(NOTABLE_STARS).toHaveLength(48);
  });
  it('stores every field of every row, in order', () => {
    rows.forEach((row, i) => {
      const s = NOTABLE_STARS[i]!;
      expect(s.name, `row ${i}`).toBe(row[0]);
      expect(s.raHours, s.name).toBe(Number(row[1]));
      expect(s.decDeg, s.name).toBe(Number(row[2]));
      expect(s.mag, s.name).toBe(Number(row[3]));
      expect(s.distancePc, s.name).toBe(Number(row[4]));
      expect(s.spectralType, s.name).toBe(row[5]);
      expect(s.colorIndex, s.name).toBe(Number(row[6]));
      expect(s.constellation, s.name).toBe(row[7]);
    });
  });
  it('starts with Sirius and every star is at most magnitude 2.0 with a finite position', () => {
    expect(NOTABLE_STARS[0]!.name).toBe('Sirius');
    for (const s of NOTABLE_STARS) {
      expect(s.mag).toBeLessThanOrEqual(2.0);
      expect(s.raHours).toBeGreaterThanOrEqual(0);
      expect(s.raHours).toBeLessThan(24);
      expect(Math.abs(s.decDeg)).toBeLessThanOrEqual(90);
    }
  });
});

describe('background stars match docs/data/background-starfield-hyg.csv exactly', () => {
  const rows = csvLines('background-starfield-hyg.csv');
  it('has 5022 rows of 4 fields and the same count in the catalog', () => {
    expect(rows).toHaveLength(5022);
    for (const row of rows) expect(row).toHaveLength(4);
    expect(BACKGROUND_STARS).toHaveLength(5022);
  });
  it('stores every value of every row, in order', () => {
    rows.forEach((row, i) => {
      const s = BACKGROUND_STARS[i]!;
      expect(s[0], `row ${i}`).toBe(Number(row[0]));
      expect(s[1], `row ${i}`).toBe(Number(row[1]));
      expect(s[2], `row ${i}`).toBe(Number(row[2]));
      expect(s[3], `row ${i}`).toBe(Number(row[3]));
    });
  });
  it('is naked-eye only (mag <= 6.0), and has no NaN anywhere', () => {
    for (const s of BACKGROUND_STARS) {
      expect(s[2]).toBeLessThanOrEqual(6.0);
      for (const v of s) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('provenance', () => {
  it('names HYG v4.4 and the licence', () => {
    expect(SKY_STAR_SOURCE).toContain('HYG');
    expect(SKY_STAR_SOURCE).toContain('CC BY-SA 4.0');
  });
});
