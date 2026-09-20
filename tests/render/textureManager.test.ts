import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TextureManager, type MapKind } from '../../src/render/textureManager';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeLoader() {
  const made = new Map<string, THREE.Texture>();
  const load = vi.fn(async (stem: string, _kind: MapKind) => {
    const t = new THREE.Texture();
    vi.spyOn(t, 'dispose');
    made.set(stem, t);
    return t;
  });
  return { load, made };
}
const slot = { lo: '2k_mars', hi: '8k_mars' };

describe('TextureManager', () => {
  it('loads the 2K map once and returns null until it arrives', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    expect(m.get('mars', 'color', slot, false)).toBeNull();
    expect(m.get('mars', 'color', slot, false)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    await flush();
    expect(m.get('mars', 'color', slot, false)).toBe(made.get('2k_mars'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('requests the 8K map only when wanted, and returns it once loaded', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, false);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    m.get('mars', 'color', slot, true);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(m.get('mars', 'color', slot, true)).toBe(made.get('8k_mars'));
    expect(m.hiCount()).toBe(1);
  });

  it('falls back to the 2K map while the 8K map is still loading', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, false);
    await flush();
    expect(m.get('mars', 'color', slot, true)).toBe(made.get('2k_mars'));
  });

  it('disposes the 8K map when it is no longer wanted and returns the 2K map', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, true);
    await flush();
    m.get('mars', 'color', slot, true);
    const hi = made.get('8k_mars')!;
    expect(m.get('mars', 'color', slot, false)).toBe(made.get('2k_mars'));
    expect(hi.dispose).toHaveBeenCalledTimes(1);
    expect(m.hiCount()).toBe(0);
  });

  it('disposes an 8K map that arrives after it stopped being wanted', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, true);
    m.get('mars', 'color', slot, false);
    await flush();
    expect(made.get('8k_mars')!.dispose).toHaveBeenCalledTimes(1);
    expect(m.hiCount()).toBe(0);
  });

  it('never loads 8K when hi-res is not allowed or the slot has no hi map', async () => {
    const a = makeLoader();
    const disallowed = new TextureManager(false, a.load);
    disallowed.get('mars', 'color', slot, true);
    await flush();
    expect(a.load).toHaveBeenCalledTimes(1);
    const b = makeLoader();
    const noHi = new TextureManager(true, b.load);
    noHi.get('uranus', 'color', { lo: '2k_uranus' }, true);
    await flush();
    expect(b.load).toHaveBeenCalledTimes(1);
  });

  it('does not retry an 8K map that failed to load', async () => {
    const load = vi.fn(async (stem: string) => (stem === '8k_mars' ? null : new THREE.Texture()));
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, true);
    await flush();
    m.get('mars', 'color', slot, true);
    await flush();
    m.get('mars', 'color', slot, true);
    await flush();
    expect(load.mock.calls.filter(([stem]) => stem === '8k_mars')).toHaveLength(1);
  });

  it('keeps separate entries per body and per map kind', async () => {
    const { load } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('earth', 'color', { lo: 'a' }, false);
    m.get('earth', 'night', { lo: 'b' }, false);
    m.get('mars', 'color', { lo: 'c' }, false);
    await flush();
    expect(load).toHaveBeenCalledTimes(3);
  });
});
