import { BODIES, type MapSlot } from './bodies.ts';

/** Ring alpha strips are PNG (they carry an alpha channel); every other map is a JPEG. */
export function textureFileName(stem: string): string {
  return stem.endsWith('_ring_alpha') ? `${stem}.png` : `${stem}.jpg`;
}

/** Every texture file the catalog references, with extension, once each. The download script and the renderer share this list. */
export function allTextureFiles(): string[] {
  const stems = new Set<string>();
  const addSlot = (slot?: MapSlot): void => {
    if (!slot) return;
    stems.add(slot.lo);
    if (slot.hi) stems.add(slot.hi);
  };
  for (const body of BODIES) {
    addSlot(body.maps.color);
    addSlot(body.maps.night);
    addSlot(body.maps.clouds);
    addSlot(body.rings?.alphaMap);
  }
  return [...stems].map(textureFileName);
}
