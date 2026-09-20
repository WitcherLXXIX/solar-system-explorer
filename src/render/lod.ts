import type { BodyId } from '../catalog/bodies';

export type MeshDetail = 'far' | 'near';

/** Apparent disc diameter (CSS px) at which the detailed sphere mesh turns on, and the lower value it turns off at. */
export const NEAR_MESH_ON_PX = 150;
export const NEAR_MESH_OFF_PX = 120;
/** Apparent disc diameter at which a body asks for its 8K maps, and the lower value it releases them at. */
export const HI_TEXTURE_ON_PX = 600;
export const HI_TEXTURE_OFF_PX = 450;
/** At most this many bodies hold 8K maps at once (an 8K colour map is about 180 MB of GPU memory with mipmaps). */
export const HI_RES_BUDGET = 2;
/** Atmosphere shells are not drawn for bodies smaller than this. */
export const ATMOSPHERE_MIN_PX = 20;

export function pickMeshDetail(screenPx: number, current: MeshDetail): MeshDetail {
  if (current === 'near') return screenPx < NEAR_MESH_OFF_PX ? 'far' : 'near';
  return screenPx >= NEAR_MESH_ON_PX ? 'near' : 'far';
}

export function wantsHiTexture(screenPx: number, currentlyHi: boolean): boolean {
  return currentlyHi ? screenPx >= HI_TEXTURE_OFF_PX : screenPx >= HI_TEXTURE_ON_PX;
}

export interface HiResCandidate {
  id: BodyId;
  screenPx: number;
  wants: boolean;
  hasHi: boolean;
}

/** The bodies that get 8K maps this frame: those that want them and have them, largest on screen first, within the budget. */
export function chooseHiRes(candidates: readonly HiResCandidate[], budget: number): Set<BodyId> {
  return new Set(
    candidates
      .filter((c) => c.wants && c.hasHi)
      .sort((a, b) => b.screenPx - a.screenPx)
      .slice(0, Math.max(0, budget))
      .map((c) => c.id),
  );
}
