import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { FrameEntry } from '../ephemeris/frame';
import type { Vec3 } from '../math';
import { SPRITE_THRESHOLD_PX, apparentDiameterPx, toRenderSpace } from './cameraRelative';
import { orientationToThree } from './orientation';
import { SPRITE_MIN_SIZE_PX, illuminationFraction, spriteAppearance } from './sprite';
import { loadBodyTexture } from './textures';

export interface RenderInfo {
  /** Camera-relative position in Three.js axes, metres. */
  rel: Vec3;
  distanceM: number;
  screenDiameterPx: number;
}

const sphereGeometry = new THREE.SphereGeometry(1, 128, 96);

let dotTexture: THREE.CanvasTexture | null = null;
function getDotTexture(): THREE.CanvasTexture {
  if (dotTexture) return dotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  dotTexture = new THREE.CanvasTexture(canvas);
  return dotTexture;
}

export class BodyView {
  readonly mesh: THREE.Mesh;
  readonly sprite: THREE.Points;
  private readonly spriteMaterial: THREE.PointsMaterial;
  private readonly material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;

  constructor(private readonly data: BodyData) {
    this.material =
      data.kind === 'star'
        ? new THREE.MeshBasicMaterial({ color: data.color })
        : new THREE.MeshStandardMaterial({ color: data.color, roughness: 1, metalness: 0 });
    this.mesh = new THREE.Mesh(sphereGeometry, this.material);
    this.mesh.scale.setScalar(data.radiusM);
    this.mesh.frustumCulled = false;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    // depthTest on, so a nearer body's sphere hides a far body's dot; depthWrite off, so dots never hide each other.
    // Size and opacity are set every frame in update().
    this.spriteMaterial = new THREE.PointsMaterial({
      color: data.color, size: SPRITE_MIN_SIZE_PX, sizeAttenuation: false, map: getDotTexture(),
      transparent: true, depthTest: true, depthWrite: false, alphaTest: 0.01,
    });
    this.sprite = new THREE.Points(geometry, this.spriteMaterial);
    this.sprite.frustumCulled = false;
    this.sprite.renderOrder = 10;

    void loadBodyTexture(data.maps.color.lo).then((texture) => {
      if (!texture) return;
      this.material.map = texture;
      this.material.color.set(0xffffff);
      this.material.needsUpdate = true;
    });
  }

  update(entry: FrameEntry, cameraPos: Vec3, sunPos: Vec3, fovYRad: number, viewportHeightPx: number): RenderInfo {
    const rel = toRenderSpace(entry.position, cameraPos);
    const distanceM = Math.hypot(rel[0], rel[1], rel[2]);
    const screenDiameterPx = apparentDiameterPx(this.data.radiusM, distanceM, fovYRad, viewportHeightPx);
    const asSphere = screenDiameterPx >= SPRITE_THRESHOLD_PX;
    this.mesh.visible = asSphere;
    this.sprite.visible = !asSphere;
    if (asSphere) {
      this.mesh.position.set(rel[0], rel[1], rel[2]);
      this.mesh.quaternion.setFromRotationMatrix(orientationToThree(entry.orientation));
    } else {
      this.sprite.position.set(rel[0], rel[1], rel[2]);
      const { sizePx, opacity } = spriteAppearance(
        screenDiameterPx,
        illuminationFraction(entry.position, sunPos, cameraPos),
        this.data.kind === 'star',
      );
      this.spriteMaterial.size = sizePx;
      this.spriteMaterial.opacity = opacity;
    }
    return { rel, distanceM, screenDiameterPx };
  }
}
