import * as THREE from 'three';

const loader = new THREE.TextureLoader();

/** Resolves to the texture, or null if it fails to load (callers keep the flat colour). */
export function loadBodyTexture(name: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    loader.load(
      `${import.meta.env.BASE_URL}textures/${name}.jpg`,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        resolve(texture);
      },
      undefined,
      () => {
        console.warn(`texture ${name} failed to load; using flat colour`);
        resolve(null);
      },
    );
  });
}
