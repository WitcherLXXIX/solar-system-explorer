import { describe, expect, it } from 'vitest';
import { MIN_SKY_LABEL_OPACITY, visibleSkyLabels, type SkyLabelItem } from '../../src/ui/skyStarLabels';

const VIEW = { width: 1280, height: 720 };
const item = (index: number, x: number, y: number, priority: number, inFront = true): SkyLabelItem => ({ index, x, y, inFront, priority });

describe('visibleSkyLabels', () => {
  const items = [item(0, 100, 100, 5), item(1, 105, 102, 9), item(2, 600, 300, 1)];
  it('shows nothing when the Labels toggle or the Night sky toggle is off (enabled false) or the fade has not begun', () => {
    expect(visibleSkyLabels(items, 1, false, VIEW)).toEqual([]);
    expect(visibleSkyLabels(items, 0, true, VIEW)).toEqual([]);
    expect(visibleSkyLabels(items, MIN_SKY_LABEL_OPACITY / 2, true, VIEW)).toEqual([]);
  });
  it('declutters: of two labels closer than 22 px the higher priority survives', () => {
    expect(visibleSkyLabels(items, 1, true, VIEW).sort()).toEqual([1, 2]);
  });
  it('drops stars behind the camera and stars off screen', () => {
    expect(visibleSkyLabels([item(0, 100, 100, 1, false)], 1, true, VIEW)).toEqual([]);
    expect(visibleSkyLabels([item(0, -80, 100, 1), item(1, 100, 900, 1), item(2, 1400, 10, 1)], 1, true, VIEW)).toEqual([]);
  });
  it('keeps a label just inside the 50 px screen margin', () => {
    expect(visibleSkyLabels([item(0, -40, 100, 1)], 1, true, VIEW)).toEqual([0]);
  });
});
