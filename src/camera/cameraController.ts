import type { BodyId } from '../catalog/bodies';
import { add, clamp, length, lerp, lerpAngle, lerpVec, scale, sub, type Vec3 } from '../math';
import { DEG } from '../units';

export const MAX_CAMERA_DISTANCE_M = 1.2e13;
export const MIN_ALTITUDE_FRACTION = 0.02;
export const FLIGHT_SECONDS = 4;
export const FLY_TO_RADII = 4;
export const DEFAULT_PITCH = 12 * DEG;
export const MAX_PITCH = 89 * DEG;

export interface FocusSource {
  position(id: BodyId): Vec3;
  radius(id: BodyId): number;
}

export interface CameraPose {
  position: Vec3;
  focusPoint: Vec3;
  focusId: BodyId;
  altitudeM: number;
  distanceM: number;
}

/** Yaw that places the camera between the body and the Sun (the Sun is the origin). */
export function sunwardYaw(bodyPosition: Vec3): number {
  return Math.atan2(-bodyPosition[1], -bodyPosition[0]);
}

interface Flight {
  fromId: BodyId;
  toId: BodyId;
  elapsedS: number;
  fromLog: number;
  toLog: number;
  fromYaw: number;
  toYaw: number;
  fromPitch: number;
  toPitch: number;
}

export class CameraController {
  private focusId: BodyId;
  private logAlt: number;
  private flight: Flight | null = null;
  yaw: number;
  pitch: number;

  constructor(
    private readonly source: FocusSource,
    init: { focusId: BodyId; altitudeM: number; yaw: number; pitch: number },
  ) {
    this.focusId = init.focusId;
    this.yaw = init.yaw;
    this.pitch = clamp(init.pitch, -MAX_PITCH, MAX_PITCH);
    this.logAlt = Math.log(this.clampAltitude(init.altitudeM, init.focusId));
  }

  get isFlying(): boolean {
    return this.flight !== null;
  }
  get displayId(): BodyId {
    return this.flight ? this.flight.toId : this.focusId;
  }

  private clampAltitude(altitudeM: number, id: BodyId): number {
    return clamp(altitudeM, MIN_ALTITUDE_FRACTION * this.source.radius(id), MAX_CAMERA_DISTANCE_M);
  }

  /** Positive `deltaLog` zooms out. */
  zoom(deltaLog: number): void {
    if (this.flight) return;
    this.logAlt = Math.log(this.clampAltitude(Math.exp(this.logAlt + deltaLog), this.focusId));
  }

  orbit(dYaw: number, dPitch: number): void {
    if (this.flight) return;
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, -MAX_PITCH, MAX_PITCH);
  }

  flyTo(id: BodyId): void {
    if (this.flight || id === this.focusId) return;
    const target = this.source.position(id);
    this.flight = {
      fromId: this.focusId,
      toId: id,
      elapsedS: 0,
      fromLog: this.logAlt,
      toLog: Math.log(this.clampAltitude(FLY_TO_RADII * this.source.radius(id), id)),
      fromYaw: this.yaw,
      toYaw: length(target) < 1 ? this.yaw : sunwardYaw(target),
      fromPitch: this.pitch,
      toPitch: DEFAULT_PITCH,
    };
  }

  update(dtS: number): CameraPose {
    const flight = this.flight;
    if (flight) {
      flight.elapsedS += dtS;
      const u = clamp(flight.elapsedS / FLIGHT_SECONDS, 0, 1);
      if (u < 1) {
        const s = u * u * (3 - 2 * u);
        const a = this.source.position(flight.fromId);
        const b = this.source.position(flight.toId);
        const base = lerp(flight.fromLog, flight.toLog, s);
        const peak = Math.log(Math.min(1.3 * length(sub(b, a)), MAX_CAMERA_DISTANCE_M));
        const logAlt = base + 4 * s * (1 - s) * Math.max(0, peak - base);
        const radius = lerp(this.source.radius(flight.fromId), this.source.radius(flight.toId), s);
        return this.buildPose(
          lerpVec(a, b, s), flight.toId, logAlt, radius,
          lerpAngle(flight.fromYaw, flight.toYaw, s), lerp(flight.fromPitch, flight.toPitch, s),
        );
      }
      this.focusId = flight.toId;
      this.logAlt = flight.toLog;
      this.yaw = flight.toYaw;
      this.pitch = flight.toPitch;
      this.flight = null;
    }
    return this.buildPose(
      this.source.position(this.focusId), this.focusId, this.logAlt,
      this.source.radius(this.focusId), this.yaw, this.pitch,
    );
  }

  private buildPose(
    focusPoint: Vec3, focusId: BodyId, logAlt: number, radius: number, yaw: number, pitch: number,
  ): CameraPose {
    const altitudeM = Math.exp(logAlt);
    const distanceM = altitudeM + radius;
    const direction: Vec3 = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)];
    return { position: add(focusPoint, scale(direction, distanceM)), focusPoint, focusId, altitudeM, distanceM };
  }
}
