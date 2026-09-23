export interface ImageSize {
  width: number;
  height: number;
  format: 'jpeg' | 'png';
}

const u32 = (b: Uint8Array, at: number): number => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;

/** Reads the pixel size from a JPEG (its SOF marker) or a PNG (its IHDR chunk) without decoding it; null for anything else. */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { format: 'png', width: u32(bytes, 16), height: u32(bytes, 20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1]!;
      if (marker === 0xff) {
        i++; // fill byte
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2; // markers without a length
        continue;
      }
      const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrameHeader) {
        return { format: 'jpeg', height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! };
      }
      i += 2 + ((bytes[i + 2]! << 8) | bytes[i + 3]!);
    }
  }
  return null;
}

/** True for a full-sphere simple cylindrical map: the width is twice the height, within `tolerance` (a fraction). */
export function isGlobalMapShape(size: { width: number; height: number }, tolerance = 0.05): boolean {
  if (size.height <= 0) return false;
  return Math.abs(size.width / size.height - 2) <= 2 * tolerance;
}
