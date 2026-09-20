/** Coarse colour classes for the smoke test's pixel counts (8-bit sRGB values as read from the frame). */
export function classifyPixel(r: number, g: number, b: number): { lit: boolean; warm: boolean; blue: boolean } {
  return {
    lit: r + g + b > 30,
    warm: r > 70 && r > b + 25, // city lights are orange-yellow; clouds and rock are neutral
    blue: b > 80 && b > r * 1.4,
  };
}
