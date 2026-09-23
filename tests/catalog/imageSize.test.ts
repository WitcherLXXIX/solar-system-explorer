import { describe, expect, it } from 'vitest';
import { imageSize, isGlobalMapShape } from '../../src/catalog/imageSize';

/** A minimal JPEG prefix: SOI, an APP0 segment (length 4: two payload bytes), then a baseline SOF0 marker for `w` x `h`. */
function jpegHeader(w: number, h: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
}

/** A minimal PNG prefix: the signature and an IHDR chunk for `w` x `h`. */
function pngHeader(w: number, h: number): Uint8Array {
  const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...u32(w), ...u32(h), 8, 2, 0, 0, 0]);
}

describe('imageSize', () => {
  it('reads a JPEG, skipping the APP0 segment', () => {
    expect(imageSize(jpegHeader(2048, 1024))).toEqual({ format: 'jpeg', width: 2048, height: 1024 });
    expect(imageSize(jpegHeader(4096, 2048))).toEqual({ format: 'jpeg', width: 4096, height: 2048 });
  });
  it('reads a PNG', () => {
    expect(imageSize(pngHeader(2048, 1024))).toEqual({ format: 'png', width: 2048, height: 1024 });
    expect(imageSize(pngHeader(8192, 4096))).toEqual({ format: 'png', width: 8192, height: 4096 });
  });
  it('returns null for anything else, including an HTML error page and an empty file', () => {
    expect(imageSize(new TextEncoder().encode('<!doctype html><html>not an image</html>'))).toBeNull();
    expect(imageSize(new Uint8Array(0))).toBeNull();
  });
});

describe('isGlobalMapShape', () => {
  it('accepts 2:1 within 5% and rejects everything else', () => {
    expect(isGlobalMapShape({ width: 2048, height: 1024 })).toBe(true);
    expect(isGlobalMapShape({ width: 2048, height: 1000 })).toBe(true); // ratio 2.048
    expect(isGlobalMapShape({ width: 2048, height: 900 })).toBe(false); // ratio 2.28
    expect(isGlobalMapShape({ width: 1024, height: 1024 })).toBe(false); // a polar or orthographic square
    expect(isGlobalMapShape({ width: 4096, height: 1024 })).toBe(false);
  });
});
