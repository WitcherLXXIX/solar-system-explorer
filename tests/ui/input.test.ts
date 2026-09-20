import { describe, expect, it } from 'vitest';
import { ZOOM_SENSITIVITY, wheelToLogDelta } from '../../src/ui/input';

describe('wheelToLogDelta', () => {
  it('scrolling down (positive deltaY) zooms out', () => {
    expect(wheelToLogDelta(100, 0)).toBeCloseTo(100 * ZOOM_SENSITIVITY, 12);
    expect(wheelToLogDelta(-100, 0)).toBeLessThan(0);
  });
  it('normalises line and page delta modes to pixels', () => {
    expect(wheelToLogDelta(3, 1)).toBeCloseTo(3 * 16 * ZOOM_SENSITIVITY, 12);
    expect(wheelToLogDelta(1, 2)).toBeCloseTo(400 * ZOOM_SENSITIVITY, 12);
  });
});
