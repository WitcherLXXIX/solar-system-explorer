import { mulMat3, rotX, rotZ, type Mat3, type Vec3 } from '../math';
import { DEG } from '../units';
import { EQJ_TO_ECL } from './frames';

/**
 * IAU rotation model, linear terms only (no libration or precession series): the north pole at J2000 and the prime
 * meridian angle W = W0 + rate * d, d in days since J2000 (TT).
 */
export interface IauRotation {
  raDeg: number;
  decDeg: number;
  w0Deg: number;
  wRateDegPerDay: number;
}

/**
 * Body axes in the J2000 equatorial frame (columns x = prime meridian, y, z = north pole):
 * R = Rz(alpha + 90 deg) Rx(90 deg - delta) Rz(W), the same composition as astronomy-engine's RotationAxis frame.
 */
export function iauAxesEqj(r: IauRotation, ttDays: number): Mat3 {
  const w = (r.w0Deg + r.wRateDegPerDay * ttDays) * DEG;
  const tilt = Math.PI / 2 - r.decDeg * DEG;
  const turn = r.raDeg * DEG + Math.PI / 2;
  const column = (e: Vec3): Vec3 => rotZ(rotX(rotZ(e, w), tilt), turn);
  return [column([1, 0, 0]), column([0, 1, 0]), column([0, 0, 1])];
}

/** The same axes in the ecliptic frame, the convention of `bodyOrientation`. */
export function iauOrientation(r: IauRotation, ttDays: number): Mat3 {
  return mulMat3(EQJ_TO_ECL, iauAxesEqj(r, ttDays));
}
