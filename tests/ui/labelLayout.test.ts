import { describe, expect, it } from 'vitest';
import { layoutLabels } from '../../src/ui/labelLayout';

describe('layoutLabels', () => {
  it('keeps both labels when they are far apart', () => {
    const shown = layoutLabels(
      [{ id: 'earth', x: 0, y: 0, priority: 1 }, { id: 'mars', x: 100, y: 0, priority: 2 }],
      20,
    );
    expect(shown).toEqual(new Set(['earth', 'mars']));
  });
  it('drops the lower-priority label when two collide', () => {
    const shown = layoutLabels(
      [{ id: 'earth', x: 0, y: 0, priority: 1 }, { id: 'venus', x: 5, y: 5, priority: 2 }],
      20,
    );
    expect(shown).toEqual(new Set(['venus']));
  });
  it('is empty for no input', () => {
    expect(layoutLabels([], 20).size).toBe(0);
  });
});
