import * as THREE from 'three';
import { BODIES, type BodyId } from '../catalog/bodies';
import type { Frame } from '../ephemeris/frame';
import { length, type Vec3 } from '../math';
import { DEG } from '../units';
import { BodyView, type RenderInfo } from './bodyView';
import { nearPlane, orbitLineOpacity, toRenderSpace } from './cameraRelative';
import { OrbitLine } from './orbitLine';

export type { RenderInfo } from './bodyView';

export const FOV_DEG = 50;
/** Phase-4 "scale knob", together with the nearPlane cap, MAX_CAMERA_DISTANCE_M, MIN_ALTITUDE_FRACTION and SPRITE_THRESHOLD_PX. */
export const FAR_M = 1e15;

export interface FrameInput {
  frame: Frame;
  cameraPos: Vec3;
  focusPoint: Vec3;
  altitudeM: number;
  date: Date;
  showOrbits: boolean;
}

export class SolarScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, FAR_M);
  private readonly scene = new THREE.Scene();
  // decay 0 is a deliberate deviation from physical inverse-square falloff: with it Neptune would be about 900x dimmer than
  // Earth. With no falloff outer planets stay readable, and the light direction still gives correct phases.
  private readonly sunLight = new THREE.PointLight(0xffffff, Math.PI, 0, 0);
  private readonly views = new Map<BodyId, BodyView>();
  private readonly orbits = new Map<BodyId, OrbitLine>();
  private width = 1;
  private height = 1;
  private lastInput: FrameInput | null = null;

  constructor(canvas: HTMLCanvasElement, startDate: Date) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.04), this.sunLight);
    for (const body of BODIES) {
      const view = new BodyView(body);
      this.views.set(body.id, view);
      this.scene.add(view.mesh, view.sprite);
      if (body.kind === 'planet') {
        const orbit = new OrbitLine(body.id, body.color, startDate);
        this.orbits.set(body.id, orbit);
        this.scene.add(orbit.line);
      }
    }
  }

  get fovYRad(): number {
    return FOV_DEG * DEG;
  }
  get viewportHeight(): number {
    return this.height;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  render(input: FrameInput): Map<BodyId, RenderInfo> {
    this.lastInput = input;
    const focusRel = toRenderSpace(input.focusPoint, input.cameraPos);
    this.camera.position.set(0, 0, 0); // camera-relative rendering: the camera is always the origin
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(focusRel[0], focusRel[1], focusRel[2]);
    this.camera.near = nearPlane(input.altitudeM);
    this.camera.far = FAR_M;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    const sunRel = toRenderSpace(input.frame.sun.position, input.cameraPos);
    this.sunLight.position.set(sunRel[0], sunRel[1], sunRel[2]);

    const info = new Map<BodyId, RenderInfo>();
    for (const body of BODIES) {
      const entry = input.frame[body.id];
      const view = this.views.get(body.id)!;
      const result = view.update(entry, input.cameraPos, input.frame.sun.position, this.fovYRad, this.height);
      info.set(body.id, result);
      const orbit = this.orbits.get(body.id);
      if (orbit) {
        const opacity = input.showOrbits ? orbitLineOpacity(result.distanceM, length(entry.position)) : 0;
        orbit.update(input.cameraPos, input.date, opacity);
      }
    }
    this.renderer.render(this.scene, this.camera);
    return info;
  }

  /** CSS-pixel screen position of a camera-relative point (Three.js axes). */
  projectToScreen(rel: Vec3): { x: number; y: number; inFront: boolean } {
    const v = new THREE.Vector3(rel[0], rel[1], rel[2]).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.width,
      y: ((1 - v.y) / 2) * this.height,
      inFront: v.z < 1,
    };
  }

  /** Renders once more and counts non-black pixels in a 64x64 patch at the centre (for the smoke test). */
  centreLitPixels(): number {
    if (!this.lastInput) return 0;
    this.render(this.lastInput);
    const gl = this.renderer.getContext();
    const size = 64;
    const buffer = new Uint8Array(size * size * 4);
    gl.readPixels(
      Math.floor((gl.drawingBufferWidth - size) / 2), Math.floor((gl.drawingBufferHeight - size) / 2),
      size, size, gl.RGBA, gl.UNSIGNED_BYTE, buffer,
    );
    let lit = 0;
    for (let i = 0; i < buffer.length; i += 4) {
      if (buffer[i]! + buffer[i + 1]! + buffer[i + 2]! > 30) lit++;
    }
    return lit;
  }
}
