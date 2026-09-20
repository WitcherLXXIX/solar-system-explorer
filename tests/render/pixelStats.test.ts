import { describe, expect, it } from 'vitest';
import { classifyPixel } from '../../src/render/pixelStats';

describe('classifyPixel', () => {
  it('treats black as unlit and anything brighter than a faint grey as lit', () => {
    expect(classifyPixel(0, 0, 0).lit).toBe(false);
    expect(classifyPixel(5, 5, 5).lit).toBe(false);
    expect(classifyPixel(20, 20, 20).lit).toBe(true);
  });
  it('flags city-light orange as warm and neutral grey or blue as not warm', () => {
    expect(classifyPixel(200, 150, 60).warm).toBe(true);
    expect(classifyPixel(90, 90, 90).warm).toBe(false);
    expect(classifyPixel(40, 80, 200).warm).toBe(false);
  });
  it('flags atmosphere and ocean blue as blue', () => {
    expect(classifyPixel(40, 90, 200).blue).toBe(true);
    expect(classifyPixel(200, 150, 60).blue).toBe(false);
    expect(classifyPixel(100, 100, 100).blue).toBe(false);
  });
});
