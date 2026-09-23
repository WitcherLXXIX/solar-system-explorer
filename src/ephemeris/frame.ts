import { BODIES, type BodyId } from '../catalog/bodies';
import { add, type Mat3, type Vec3 } from '../math';
import { bodyOrientation, bodyRelativePosition } from './ephemeris';

export interface FrameEntry {
  position: Vec3;
  orientation: Mat3;
}
export type Frame = Record<BodyId, FrameEntry>;

const ORIGIN: Vec3 = [0, 0, 0];

/** BODIES lists every parent before its children, so a body's position is its parent's (already computed) plus its own relative offset. */
export function computeFrame(date: Date): Frame {
  const frame = {} as Record<BodyId, FrameEntry>;
  for (const body of BODIES) {
    const relative = bodyRelativePosition(body.id, date);
    const base = body.parent === null || body.parent === 'sun' ? ORIGIN : frame[body.parent].position;
    frame[body.id] = {
      position: body.parent === null || body.parent === 'sun' ? relative : add(base, relative),
      orientation: bodyOrientation(body.id, date),
    };
  }
  return frame;
}
