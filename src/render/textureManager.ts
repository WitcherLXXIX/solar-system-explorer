import type * as THREE from 'three';
import type { BodyId, MapSlot } from '../catalog/bodies';

export type MapKind = 'color' | 'night' | 'clouds' | 'ring';
export type TextureLoadFn = (stem: string, kind: MapKind) => Promise<THREE.Texture | null>;

interface Entry {
  lo: THREE.Texture | null;
  hi: THREE.Texture | null;
  loStarted: boolean;
  hiStarted: boolean;
  hiFailed: boolean;
  wantHi: boolean;
}

/**
 * Tiered texture cache. The 2K map of every slot stays resident; the 8K map is loaded only while `get` is called with
 * wantHi, and disposed as soon as it is not wanted. Loads are async and start on demand; `get` never blocks.
 */
export class TextureManager {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly hiResAllowed: boolean,
    private readonly load: TextureLoadFn,
  ) {}

  /** The best texture available right now (8K if wanted and loaded, else 2K), or null while nothing has arrived. */
  get(bodyId: BodyId, kind: MapKind, slot: MapSlot, wantHi: boolean): THREE.Texture | null {
    const key = `${bodyId}:${kind}`;
    let e = this.entries.get(key);
    if (!e) {
      e = { lo: null, hi: null, loStarted: false, hiStarted: false, hiFailed: false, wantHi: false };
      this.entries.set(key, e);
    }
    const entry = e;
    entry.wantHi = wantHi && this.hiResAllowed && slot.hi !== undefined;

    if (!entry.loStarted) {
      entry.loStarted = true;
      void this.load(slot.lo, kind).then((t) => {
        entry.lo = t;
      });
    }
    if (entry.wantHi && slot.hi && !entry.hiStarted && !entry.hiFailed) {
      entry.hiStarted = true;
      void this.load(slot.hi, kind).then((t) => {
        if (!t) {
          entry.hiFailed = true;
          entry.hiStarted = false;
        } else if (!entry.wantHi) {
          t.dispose(); // arrived after it stopped being wanted
          entry.hiStarted = false;
        } else {
          entry.hi = t;
        }
      });
    }
    if (!entry.wantHi && entry.hi) {
      entry.hi.dispose();
      entry.hi = null;
      entry.hiStarted = false;
    }
    return entry.wantHi && entry.hi ? entry.hi : entry.lo;
  }

  /** Number of 8K textures currently held. */
  hiCount(): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.hi) n++;
    return n;
  }
}
