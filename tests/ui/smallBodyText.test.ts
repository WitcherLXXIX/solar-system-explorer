import { describe, expect, it } from 'vitest';
import { SMALL_BODY_NOTE, TAIL_NOTE, dayLengthText, kindLabel } from '../../src/ui/bodyText';
import { splitSmallBodies } from '../../src/ui/bodyTree';

describe('kindLabel for small bodies', () => {
  it('names each new kind', () => {
    expect(kindLabel('asteroid', null)).toBe('Asteroid');
    expect(kindLabel('tno', null)).toBe('Trans-Neptunian object');
    expect(kindLabel('comet', null)).toBe('Comet');
  });
  it('keeps the old labels', () => {
    expect(kindLabel('planet', null)).toBe('Planet');
    expect(kindLabel('moon', 'Mars')).toBe('Moon of Mars');
  });
});

describe('dayLengthText', () => {
  it('shows a dash, never NaN, when the spin is unknown', () => {
    expect(dayLengthText(null)).toBe('—');
  });
  it('formats a known period like the rest of the panel', () => {
    expect(dayLengthText(5.342)).toMatch(/h/);
    expect(dayLengthText(-5832.5)).toMatch(/h|d/);
  });
});

describe('the honesty notes', () => {
  it('say what is schematic and what is stylised', () => {
    expect(SMALL_BODY_NOTE).toMatch(/JPL/);
    expect(SMALL_BODY_NOTE).toMatch(/two-body/);
    expect(TAIL_NOTE).toMatch(/away from the Sun/);
    expect(TAIL_NOTE).toMatch(/not a physical simulation/);
  });
});

describe('splitSmallBodies', () => {
  it('separates the small bodies and keeps input order in both lists', () => {
    const list = [
      { id: 'sun', kind: 'star' as const }, { id: 'vesta', kind: 'asteroid' as const }, { id: 'earth', kind: 'planet' as const },
      { id: 'halley', kind: 'comet' as const }, { id: 'moon', kind: 'moon' as const }, { id: 'pallas', kind: 'asteroid' as const },
    ];
    const { main, small } = splitSmallBodies(list);
    expect(main.map((b) => b.id)).toEqual(['sun', 'earth', 'moon']);
    expect(small.map((b) => b.id)).toEqual(['vesta', 'halley', 'pallas']);
  });
});
