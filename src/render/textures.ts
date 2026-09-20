import * as THREE from 'three';
import { textureFileName } from '../catalog/textureFiles';
import type { MapKind } from './textureManager';

const loader = new THREE.TextureLoader();

/** Resolves to the texture, or null if it fails to load (callers keep the lower tier or the flat colour). */
export function loadTexture(stem: string, kind: MapKind): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    loader.load(
      `${import.meta.env.BASE_URL}textures/${textureFileName(stem)}`,
      (texture) => {
        // Colour, night lights and ring colour are sRGB images; the cloud map is coverage data and stays linear.
        texture.colorSpace = kind === 'clouds' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        resolve(texture);
      },
      undefined,
      () => {
        console.warn(`texture ${stem} failed to load`);
        resolve(null);
      },
    );
  });
}
