export type Vec3 = readonly [number, number, number];
/** Three COLUMNS: the body's x, y and z axes expressed in world coordinates. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Interpolates angles (radians) along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * t;
}

/** m times v; `m` holds three COLUMNS, so the result is the columns weighted by the components of v. */
export function mulMat3Vec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
    m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
    m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
  ];
}

/** a times b (b is applied first): each column of the product is `a` applied to the matching column of `b`. */
export function mulMat3(a: Mat3, b: Mat3): Mat3 {
  return [mulMat3Vec(a, b[0]), mulMat3Vec(a, b[1]), mulMat3Vec(a, b[2])];
}

/** Rotates a vector by `t` radians counter-clockwise about the z axis. */
export function rotZ(v: Vec3, t: number): Vec3 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
}

/** Rotates a vector by `t` radians counter-clockwise about the x axis. */
export function rotX(v: Vec3, t: number): Vec3 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}
