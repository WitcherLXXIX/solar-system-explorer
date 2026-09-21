/** Formats a number as a GLSL float literal: `5` becomes `5.0` (a bare integer is not a float in GLSL); fractions and exponent forms pass through. */
export function glslFloat(x: number): string {
  if (!Number.isFinite(x)) throw new Error(`not a finite GLSL float: ${x}`);
  const s = String(x);
  return /^-?\d+$/.test(s) ? `${s}.0` : s;
}
