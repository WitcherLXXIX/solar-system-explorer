import { BODY_IDS, type BodyId } from '../catalog/bodies';
import type { Mat3, Vec3 } from '../math';
import { bodyOrientation, bodyPosition } from './ephemeris';

export interface FrameEntry {
  position: Vec3;
  orientation: Mat3;
}
export type Frame = Record<BodyId, FrameEntry>;

export function computeFrame(date: Date): Frame {
  const frame = {} as Record<BodyId, FrameEntry>;
  for (const id of BODY_IDS) {
    frame[id] = { position: bodyPosition(id, date), orientation: bodyOrientation(id, date) };
  }
  return frame;
}
