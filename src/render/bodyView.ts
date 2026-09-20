import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { FrameEntry } from '../ephemeris/frame';
import type { Mat3, Vec3 } from '../math';
import { SPRITE_THRESHOLD_PX, apparentDiameterPx, eclipticToThree, toRenderSpace } from './cameraRelative';
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

const basis = new THREE.Matrix4();
const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();

/**
 * Sphere-mesh local axes: +X = body x (prime meridian), +Y = body z (north pole), +Z = body -y.
 * SphereGeometry puts longitude 0 on local +X and increases east toward local -Z, which matches this.
 */
function orientationToThree(m: Mat3): THREE.Matrix4 {
  const x = eclipticToThree(m[0]);
  const y = eclipticToThree(m[2]);
  const z = eclipticToThree(m[1]);
  bx.set(x[0], x[1], x[2]);
  by.set(y[0], y[1], y[2]);
  bz.set(-z[0], -z[1], -z[2]);
  return basis.makeBasis(bx, by, bz);
}

export class BodyView {
  readonly mesh: THREE.Mesh;
  readonly sprite: THREE.Points;
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
    this.sprite = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: data.color, size: 6, sizeAttenuation: false, map: getDotTexture(),
        transparent: true, depthTest: false, alphaTest: 0.01,
      }),
    );
    this.sprite.frustumCulled = false;
    this.sprite.renderOrder = 10;

    void loadBodyTexture(data.texture).then((texture) => {
      if (!texture) return;
      this.material.map = texture;
      this.material.color.set(0xffffff);
      this.material.needsUpdate = true;
    });
  }

  update(entry: FrameEntry, cameraPos: Vec3, fovYRad: number, viewportHeightPx: number): RenderInfo {
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
    }
    return { rel, distanceM, screenDiameterPx };
  }
}
