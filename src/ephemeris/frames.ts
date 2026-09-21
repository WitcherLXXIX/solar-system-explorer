import { Rotation_EQJ_ECL } from 'astronomy-engine';
import { mulMat3, type Mat3 } from '../math';
import { poleFrame } from './kepler';

// astronomy-engine stores its rotation transposed: RotateVector computes x' = rot[0][0] x + rot[1][0] y + rot[2][0] z, so
// each ROW rot[j] is the ecliptic image of equatorial axis j, which is exactly one column of our Mat3.
const rot = Rotation_EQJ_ECL().rot;

/** J2000 equatorial to J2000 ecliptic, as three columns (the ecliptic components of the equatorial x, y and z axes). */
export const EQJ_TO_ECL: Mat3 = [
  [rot[0]![0]!, rot[0]![1]!, rot[0]![2]!],
  [rot[1]![0]!, rot[1]![1]!, rot[1]![2]!],
  [rot[2]![0]!, rot[2]![1]!, rot[2]![2]!],
];

/** A satellite element reference plane: the J2000 ecliptic, or any plane given by its pole (J2000 equatorial, degrees). */
export type PlaneFrame = 'ecliptic' | { poleRaDeg: number; poleDecDeg: number };

/** The plane's axes expressed in the ecliptic frame (columns): multiply a plane-frame vector by this to get ecliptic coordinates. */
export function planeToEcliptic(frame: PlaneFrame): Mat3 {
  if (frame === 'ecliptic') return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return mulMat3(EQJ_TO_ECL, poleFrame(frame.poleRaDeg, frame.poleDecDeg));
}
