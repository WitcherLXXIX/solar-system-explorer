import { BODIES, getBody, type BodyId } from '../catalog/bodies';
import type { Vec3 } from '../math';
import { MAX_OCCLUDERS, MIN_SHADOW_WIDTH } from './bodyShadowMath';
import { glslFloat } from './glsl';

/** The Sun's radius in metres, for the penumbra width (Sun radius / distance). */
export const SUN_RADIUS_M = getBody('sun').radiusM;

/** A body that may shadow another this frame: centre relative to the camera (render axes, metres, float64) and radius. */
export interface ShadowCaster {
  rel: Vec3;
  radiusM: number;
}

const SHADOWING_KINDS = new Set(['planet', 'moon', 'dwarf']);

const CASTERS: ReadonlyMap<BodyId, readonly BodyId[]> = new Map(
  BODIES.map((body): readonly [BodyId, readonly BodyId[]] => {
    if (!SHADOWING_KINDS.has(body.kind)) return [body.id, []];
    const family = BODIES.filter((other) => {
      if (other.id === body.id || !SHADOWING_KINDS.has(other.kind)) return false;
      const isChild = other.parent === body.id;
      const isParent = body.parent === other.id;
      const isSibling = body.parent !== null && body.parent !== 'sun' && other.parent === body.parent;
      return isChild || isParent || isSibling;
    });
    return [body.id, family.map((o) => o.id)];
  }),
);

/** The bodies whose shadow can fall on `id`: its parent (if it is a moon), its siblings and its children. Never the Sun, small bodies or stars. */
export function shadowCasterIds(id: BodyId): readonly BodyId[] {
  return CASTERS.get(id) ?? [];
}

/** `id`'s casters with their positions from `rels` (camera-relative, render axes); a caster with no entry is skipped. */
export function casterEntries(id: BodyId, rels: ReadonlyMap<BodyId, Vec3>): ShadowCaster[] {
  const out: ShadowCaster[] = [];
  for (const casterId of shadowCasterIds(id)) {
    const rel = rels.get(casterId);
    if (rel) out.push({ rel, radiusM: getBody(casterId).radiusM });
  }
  return out;
}

/**
 * GLSL twin of bodyShadowMath.ts: shadowLit, and the loop over the chosen occluders. Included by the surface shader.
 * Positions are in receiver radii, receiver-local axes, so `vPosB` (the unit-sphere vertex position) is the surface point.
 */
export const BODY_SHADOW_GLSL = /* glsl */ `
const int MAX_OCC = ${MAX_OCCLUDERS};
const float MIN_W = ${glslFloat(MIN_SHADOW_WIDTH)};
uniform float uOccCount;
uniform vec3 uOccPos[${MAX_OCCLUDERS}];
uniform float uOccRadius[${MAX_OCCLUDERS}];
uniform float uTanSun;

float bodyShadowLit(vec3 p, vec3 sunDir, vec3 c, float r, float tanSun) {
  vec3 toC = c - p;
  float t = dot(toC, sunDir);
  if (t <= 0.0) return 1.0;
  float d = length(toC - sunDir * t);
  float w = max(t * tanSun, MIN_W);
  float depth = min(1.0, (r * r) / (w * w));
  float covered = 1.0 - smoothstep(abs(r - w), r + w, d);
  return 1.0 - depth * covered;
}

float bodyShadowFactor(vec3 p, vec3 sunDir) {
  float lit = 1.0;
  for (int i = 0; i < MAX_OCC; i++) {
    if (float(i) >= uOccCount) break;
    lit *= bodyShadowLit(p, sunDir, uOccPos[i], uOccRadius[i], uTanSun);
  }
  return lit;
}
`;
