import { describe, expect, it } from 'vitest';
import { MAX_FRAME_DT_S, frameDelta } from '../../src/clock/frameDelta';

describe('frameDelta', () => {
  it('is zero on the first frame (no previous timestamp)', () => {
    expect(frameDelta(1234, null)).toBe(0);
  });
  it('converts milliseconds to seconds for a normal frame', () => {
    expect(frameDelta(1016, 1000)).toBeCloseTo(0.016, 12);
  });
  it('never goes negative when the timestamp runs backwards', () => {
    expect(frameDelta(990, 1000)).toBe(0);
  });
  it('caps a long pause (background tab) at the maximum step', () => {
    expect(frameDelta(1_000_000, 0)).toBe(MAX_FRAME_DT_S);
    expect(MAX_FRAME_DT_S).toBe(0.1);
  });
  it('returns 0 for NaN or infinite inputs', () => {
    expect(frameDelta(NaN, 1000)).toBe(0);
    expect(frameDelta(1000, NaN)).toBe(0);
    expect(frameDelta(Infinity, 1000)).toBe(0);
    expect(frameDelta(1000, -Infinity)).toBe(0);
  });
});
