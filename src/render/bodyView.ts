import * as THREE from 'three';
import { isStarKind, type BodyData } from '../catalog/bodies';
import type { FrameEntry } from '../ephemeris/frame';
import type { Vec3 } from '../math';
import { AtmosphereEffect } from './atmosphere';
import { SPRITE_THRESHOLD_PX, apparentDiameterPx, toRenderSpace } from './cameraRelative';
import { CloudEffect } from './clouds';
import { CometTailEffect } from './cometTail';
import { getDotTexture } from './dotTexture';
import { pickMeshDetail, type MeshDetail } from './lod';
import { orientationToThree } from './orientation';
import { RingEffect } from './rings';
import { nearStarSpriteVisible, starSpriteStyle, type StarSpriteStyle } from './starPoints';
import { SPRITE_MIN_SIZE_PX, illuminationFraction, spriteAppearance } from './sprite';
import { createSurfaceMaterial, dummyTexture } from './surfaceMaterial';
import type { TextureManager } from './textureManager';

export interface RenderInfo {
  /** Camera-relative position in Three.js axes, metres. */
  rel: Vec3;
  distanceM: number;
  screenDiameterPx: number;
}

/** Everything an effect (atmosphere, rings, clouds) needs about one body this frame. All directions are unit vectors. */
export interface BodyRenderState {
  data: BodyData;
  /** Body centre relative to the camera, Three.js axes, metres. */
  rel: Vec3;
  /**
   * Body orientation (Three.js axes); the sphere mesh's local +Y is the pole, the equator is local y = 0.
   * quaternion, sunLocal and camLocal are valid every frame, also while the body is drawn as a sprite.
   */
  quaternion: THREE.Quaternion;
  /** From the body toward the Sun, Three.js axes. */
  sunDir: THREE.Vector3;
  /** Camera position relative to the body centre, in body radii, Three.js axes. */
  camRelBody: THREE.Vector3;
  /** The same two vectors in the body's local axes. */
  sunLocal: THREE.Vector3;
  camLocal: THREE.Vector3;
  screenDiameterPx: number;
  /** True when the body is drawn as a sphere (false: point sprite). */
  asSphere: boolean;
  effectsEnabled: boolean;
  /** True when this body holds its 8K maps this frame. */
  hiRes: boolean;
  /** The camera's near plane this frame, in metres. */
  nearM: number;
  /** Distance from the body to the Sun this frame, metres (from float64-differenced camera-relative positions). */
  sunDistanceM: number;
}

export interface BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  update(state: BodyRenderState): void;
}

export interface BodyUpdateContext {
  cameraPos: Vec3;
  /** Sun position in the world frame (metres), and relative to the camera in Three.js axes. */
  sunPos: Vec3;
  sunRel: Vec3;
  fovYRad: number;
  viewportHeightPx: number;
  hiRes: boolean;
  effectsEnabled: boolean;
  nearM: number;
}

const farGeometry = new THREE.SphereGeometry(1, 128, 96);
let nearGeometry: THREE.SphereGeometry | null = null;
/** About 200k vertices; built the first time a body gets close enough to need it. */
function getNearGeometry(): THREE.SphereGeometry {
  nearGeometry ??= new THREE.SphereGeometry(1, 512, 384);
  return nearGeometry;
}

export class BodyView {
  /** Everything the scene must add: the sphere, the sprite and any effect objects. */
  readonly objects: THREE.Object3D[] = [];
  readonly hasHiRes: boolean;
  private readonly mesh: THREE.Mesh;
  private readonly sprite: THREE.Points;
  private readonly spriteMaterial: THREE.PointsMaterial;
  private readonly surface: THREE.ShaderMaterial;
  private readonly effects: BodyEffect[];
  private detail: MeshDetail = 'far';
  /** Set for the nearby stars only: their dot size and opacity come from the spectral class instead of the planet sprite model. */
  private readonly starStyle: StarSpriteStyle | null;
  private hiRes = false;
  private readonly sunDir = new THREE.Vector3();
  private readonly camRelBody = new THREE.Vector3();
  private readonly sunLocal = new THREE.Vector3();
  private readonly camLocal = new THREE.Vector3();
  private readonly inverseQuat = new THREE.Quaternion();

  constructor(
    private readonly data: BodyData,
    private readonly textures: TextureManager,
  ) {
    this.hasHiRes = data.maps.color?.hi !== undefined;
    if (data.kind === 'nearstar' && data.spectralType === undefined) throw new Error(`${data.id} is a nearby star with no spectral type`);
    this.starStyle = data.kind === 'nearstar' && data.spectralType !== undefined ? starSpriteStyle(data.spectralType) : null;
    this.surface = createSurfaceMaterial(data.color, isStarKind(data.kind));
    this.mesh = new THREE.Mesh(farGeometry, this.surface);
    this.mesh.scale.setScalar(data.radiusM);
    this.mesh.frustumCulled = false;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    // depthTest on, so a nearer body's sphere hides a far body's dot; depthWrite off, so dots never hide each other.
    this.spriteMaterial = new THREE.PointsMaterial({
      color: data.color, size: SPRITE_MIN_SIZE_PX, sizeAttenuation: false, map: getDotTexture(),
      transparent: true, depthTest: true, depthWrite: false, alphaTest: 0.01,
    });
    this.sprite = new THREE.Points(geometry, this.spriteMaterial);
    this.sprite.frustumCulled = false;
    this.sprite.renderOrder = 10;

    this.effects = this.createEffects();
    this.objects.push(this.mesh, this.sprite);
    for (const effect of this.effects) this.objects.push(...effect.objects);
  }

  /** One effect per catalog feature. Later tasks add one line each here. */
  private createEffects(): BodyEffect[] {
    const effects: BodyEffect[] = [];
    if (this.data.atmosphere) effects.push(new AtmosphereEffect(this.data));
    if (this.data.rings) effects.push(new RingEffect(this.data, this.surface, this.textures));
    if (this.data.maps.clouds && this.data.cloudShellFraction !== undefined) effects.push(new CloudEffect(this.data, this.textures));
    if (this.data.kind === 'comet') effects.push(new CometTailEffect(this.data));
    return effects;
  }

  get isHiRes(): boolean {
    return this.hiRes;
  }

  /** True when this body's comet tail was drawn in the last update. */
  get tailVisible(): boolean {
    return this.effects.some((effect) => effect instanceof CometTailEffect && effect.shown);
  }

  /** Hides the body's point sprite for this frame (call after `update`); the scene uses it when a moon's dot would sit on its parent's. */
  hideSprite(): void {
    this.sprite.visible = false;
  }

  /** Distance and apparent size, cheap enough to run for every body before the frame's texture budget is decided. */
  measure(
    entry: FrameEntry, cameraPos: Vec3, fovYRad: number, viewportHeightPx: number,
  ): { distanceM: number; screenDiameterPx: number } {
    const rel = toRenderSpace(entry.position, cameraPos);
    const distanceM = Math.hypot(rel[0], rel[1], rel[2]);
    return { distanceM, screenDiameterPx: apparentDiameterPx(this.data.radiusM, distanceM, fovYRad, viewportHeightPx) };
  }

  update(entry: FrameEntry, ctx: BodyUpdateContext): RenderInfo {
    const rel = toRenderSpace(entry.position, ctx.cameraPos);
    const distanceM = Math.hypot(rel[0], rel[1], rel[2]);
    const screenDiameterPx = apparentDiameterPx(this.data.radiusM, distanceM, ctx.fovYRad, ctx.viewportHeightPx);
    const asSphere = screenDiameterPx >= SPRITE_THRESHOLD_PX;
    this.hiRes = ctx.hiRes;
    this.mesh.visible = asSphere;
    this.sprite.visible = this.starStyle ? nearStarSpriteVisible(screenDiameterPx, this.starStyle.sizePx) : !asSphere;

    // Orientation is needed by the effects even while the body is a sprite, so it is set every frame.
    this.mesh.quaternion.setFromRotationMatrix(orientationToThree(entry.orientation));
    if (asSphere) {
      this.detail = pickMeshDetail(screenDiameterPx, this.detail);
      this.mesh.geometry = this.detail === 'near' ? getNearGeometry() : farGeometry;
      this.mesh.position.set(rel[0], rel[1], rel[2]);
    } else {
      this.releaseHiRes();
    }
    if (!asSphere || this.starStyle) {
      this.sprite.position.set(rel[0], rel[1], rel[2]);
      const { sizePx, opacity } = this.starStyle ?? spriteAppearance(
        screenDiameterPx,
        illuminationFraction(entry.position, ctx.sunPos, ctx.cameraPos),
        this.data.kind === 'star',
      );
      this.spriteMaterial.size = sizePx;
      this.spriteMaterial.opacity = opacity;
    }

    // Directions are formed from float64 differences, then held as small unit vectors.
    const radius = this.data.radiusM;
    this.sunDir.set(ctx.sunRel[0] - rel[0], ctx.sunRel[1] - rel[1], ctx.sunRel[2] - rel[2]);
    const sunDistanceM = this.sunDir.length();
    if (this.sunDir.lengthSq() < 1) this.sunDir.set(0, 1, 0); // the Sun itself
    else this.sunDir.normalize();
    this.camRelBody.set(-rel[0] / radius, -rel[1] / radius, -rel[2] / radius);
    this.inverseQuat.copy(this.mesh.quaternion).invert();
    this.sunLocal.copy(this.sunDir).applyQuaternion(this.inverseQuat);
    this.camLocal.copy(this.camRelBody).applyQuaternion(this.inverseQuat);

    const state: BodyRenderState = {
      data: this.data, rel, quaternion: this.mesh.quaternion, sunDir: this.sunDir, camRelBody: this.camRelBody,
      sunLocal: this.sunLocal, camLocal: this.camLocal, screenDiameterPx, asSphere,
      effectsEnabled: ctx.effectsEnabled, hiRes: ctx.hiRes, nearM: ctx.nearM, sunDistanceM,
    };
    if (asSphere) this.updateSurface(state);
    for (const effect of this.effects) effect.update(state);
    return { rel, distanceM, screenDiameterPx };
  }

  /**
   * updateSurface (the only place textures.get runs) is skipped for sprites, so a body that drops from sphere to sprite
   * in one step would keep its 8K maps. Asking for the low tier on every slot disposes them.
   */
  private releaseHiRes(): void {
    const { maps, id } = this.data;
    if (maps.color) this.textures.get(id, 'color', maps.color, false);
    if (maps.night) this.textures.get(id, 'night', maps.night, false);
    if (maps.clouds) this.textures.get(id, 'clouds', maps.clouds, false);
  }

  private updateSurface(state: BodyRenderState): void {
    const u = this.surface.uniforms;
    const color = this.data.maps.color ? this.textures.get(this.data.id, 'color', this.data.maps.color, state.hiRes) : null;
    u.uMap.value = color ?? dummyTexture();
    u.uHasMap.value = color ? 1 : 0;
    u.uSunDir.value.copy(state.sunDir);
    u.uSunLocal.value.copy(state.sunLocal);
    const maps = this.data.maps;
    const night = maps.night ? this.textures.get(this.data.id, 'night', maps.night, state.hiRes) : null;
    const clouds = maps.clouds ? this.textures.get(this.data.id, 'clouds', maps.clouds, state.hiRes) : null;
    const features = state.effectsEnabled;
    u.uNight.value = night ?? dummyTexture();
    u.uHasNight.value = features && night ? 1 : 0;
    u.uClouds.value = clouds ?? dummyTexture();
    u.uHasClouds.value = features && clouds ? 1 : 0;
    const glint = this.data.oceanGlint;
    u.uGlint.value = features && glint ? glint.strength : 0;
    if (glint) u.uShine.value = glint.shininess;
  }
}
