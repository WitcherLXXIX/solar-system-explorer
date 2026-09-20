import { describe, expect, it } from 'vitest';
import type { BodyId } from '../../src/catalog/bodies';
import { isLabelOccluded, layoutLabels, type ScreenBody } from '../../src/ui/labelLayout';

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

describe('isLabelOccluded', () => {
  const body = (id: BodyId, x: number, distanceM: number, screenDiameterPx: number, inFront = true): ScreenBody => ({
    id, x, y: 100, inFront, distanceM, screenDiameterPx,
  });
  const far = body('mars', 500, 2e11, 10);

  it('hides a body whose centre is covered by a nearer, larger disc', () => {
    const near = body('earth', 520, 1e11, 200); // radius 100 px, 20 px away
    expect(isLabelOccluded(far, [near, far])).toBe(true);
  });
  it('keeps the label when the nearer disc is too far away on screen', () => {
    const near = body('earth', 800, 1e11, 200);
    expect(isLabelOccluded(far, [near, far])).toBe(false);
  });
  it('keeps the label when the covering disc is farther than the target', () => {
    const behind = body('earth', 500, 3e11, 200);
    expect(isLabelOccluded(far, [behind, far])).toBe(false);
  });
  it('keeps the label when the nearer disc is smaller, e.g. a planet in front of the Sun centre', () => {
    const sun = body('sun', 500, 1.5e11, 60);
    const planet = body('mercury', 500, 5e10, 4); // nearer, but tiny
    expect(isLabelOccluded(sun, [sun, planet])).toBe(false);
  });
  it('ignores an occluder behind the camera', () => {
    const near = body('earth', 500, 1e11, 200, false);
    expect(isLabelOccluded(far, [near, far])).toBe(false);
  });
  it('never occludes itself', () => {
    expect(isLabelOccluded(far, [far])).toBe(false);
  });
});
