import { describe, expect, it } from 'vitest';
import {
  HI_RES_BUDGET, HI_TEXTURE_OFF_PX, HI_TEXTURE_ON_PX, NEAR_MESH_OFF_PX, NEAR_MESH_ON_PX,
  chooseHiRes, pickMeshDetail, wantsHiTexture, type HiResCandidate,
} from '../../src/render/lod';

describe('pickMeshDetail', () => {
  it('switches to the near mesh at the on threshold and back below the off threshold (hysteresis)', () => {
    expect(pickMeshDetail(NEAR_MESH_ON_PX - 1, 'far')).toBe('far');
    expect(pickMeshDetail(NEAR_MESH_ON_PX, 'far')).toBe('near');
    expect(pickMeshDetail(NEAR_MESH_ON_PX - 1, 'near')).toBe('near');
    expect(pickMeshDetail(NEAR_MESH_OFF_PX, 'near')).toBe('near');
    expect(pickMeshDetail(NEAR_MESH_OFF_PX - 1, 'near')).toBe('far');
  });
});

describe('wantsHiTexture', () => {
  it('turns on at 600 px and stays on until below 450 px', () => {
    expect(wantsHiTexture(HI_TEXTURE_ON_PX - 1, false)).toBe(false);
    expect(wantsHiTexture(HI_TEXTURE_ON_PX, false)).toBe(true);
    expect(wantsHiTexture(HI_TEXTURE_ON_PX - 1, true)).toBe(true);
    expect(wantsHiTexture(HI_TEXTURE_OFF_PX, true)).toBe(true);
    expect(wantsHiTexture(HI_TEXTURE_OFF_PX - 1, true)).toBe(false);
  });
});

describe('chooseHiRes', () => {
  const c = (id: HiResCandidate['id'], screenPx: number, wants = true, hasHi = true): HiResCandidate => ({ id, screenPx, wants, hasHi });

  it('has a budget of two', () => {
    expect(HI_RES_BUDGET).toBe(2);
  });
  it('grants the bodies with the largest apparent size within the budget', () => {
    const granted = chooseHiRes([c('earth', 900), c('mars', 700), c('jupiter', 800), c('saturn', 650)], 2);
    expect(granted).toEqual(new Set(['earth', 'jupiter']));
  });
  it('ignores bodies that do not want it or have no hi map', () => {
    const granted = chooseHiRes([c('earth', 900, false), c('uranus', 2000, true, false), c('mars', 700)], 2);
    expect(granted).toEqual(new Set(['mars']));
  });
  it('grants nothing with a zero budget or no candidates', () => {
    expect(chooseHiRes([c('earth', 900)], 0).size).toBe(0);
    expect(chooseHiRes([], 2).size).toBe(0);
  });
  it('does not mutate its input', () => {
    const input = [c('earth', 100), c('mars', 900)];
    chooseHiRes(input, 1);
    expect(input.map((x) => x.id)).toEqual(['earth', 'mars']);
  });
});
