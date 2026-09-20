# Planet Fidelity (Phase 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8K surface maps, atmospheres, Saturn's rings with real shadows, faint rings for Jupiter/Uranus/Neptune, and Earth's night lights, clouds and ocean glint, with the camera able to descend to 0.2% of a planet's radius.

**Architecture:** Extend the phase 1 mesh renderer. A shared custom surface shader replaces the standard material (same Lambert lighting, plus switches for night map, ring shadow and ocean glint). Each body's optional effects (atmosphere shell, ring, cloud shell) implement a small `BodyEffect` interface and are created from catalog data. A `TextureManager` keeps 2K maps resident and loads 8K only for the bodies that need it, within a budget. Two shared sphere meshes give near/far detail.

**Tech Stack:** unchanged from phase 1 (TypeScript 7, Vite 8, Three.js 0.186, astronomy-engine 2.1.19, Vitest 5, playwright-core 1.63 driving system Chromium). GLSL for the shaders.

**Spec:** `docs/superpowers/specs/2026-09-20-planet-fidelity-design.md` (binding). Phase 1 spec: `docs/superpowers/specs/2026-09-20-solar-system-core-design.md`.

## Global Constraints

- Work in `/home/bobbywitcher/src/solar-system` on a feature branch `phase-2a` (created from `master`); commit after every task; the base branch is `master` (not main).
- Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (pass it as a second `-m`). Repo-local git identity is already set; do not change git config.
- **Any browser launched for testing MUST be headed and visible to the user** (`headless: false`), never headless. `scripts/lib/browser.mjs` already enforces this; never add a headless mode or fallback. If there is no display (`DISPLAY`/`WAYLAND_DISPLAY` unset) stop and report. Closing windows when done is fine.
- Scratch files and screenshots go in `/tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad/` (called `$SP` below). View PNGs with the Read tool.
- Strict TypeScript, no `any`; no `innerHTML` with dynamic strings. Tests live in `tests/` mirroring `src/` (Vitest).
- Precision rule (unchanged): world positions are subtracted in float64 before any float32 cast; the render camera is always the origin. Shaders receive camera-relative or body-relative values computed in float64 on the CPU.
- Shaders are `THREE.ShaderMaterial`s. With the logarithmic depth buffer on, EVERY custom shader must include `#include <common>` in both stages, `#include <logdepthbuf_pars_vertex>` and `#include <logdepthbuf_vertex>` (after `gl_Position` is set) in the vertex shader, and `#include <logdepthbuf_pars_fragment>` and `#include <logdepthbuf_fragment>` in the fragment shader, plus `#include <colorspace_fragment>` last in the fragment shader (verified in `node_modules/three/src/renderers/shaders/ShaderChunk`). Without them the object depth-sorts wrongly against the other bodies.
- Camera limits: minimum altitude `MIN_ALTITUDE_FRACTION = 0.002` (of the focused body's radius); `MAX_CAMERA_DISTANCE_M = 1.2e13`, `FAR_M = 1e15`, the near-plane cap and `SPRITE_THRESHOLD_PX` stay as they are (phase-4 scale knobs).
- Texture tier rules (values, all in CSS px of apparent disc diameter): near mesh on at 150, off below 120; 8K on at 600, off below 450; `HI_RES_BUDGET = 2`; atmosphere shell hidden below 20 px; sprite threshold stays 3 px.
- Deferred by design (do not build): moons, dwarf planets, streamed tiles, terrain, corona, cloud shadows, eclipses, refraction, cloud drift, single-channel cloud upload.
- All shader constants below are INITIAL values; the visual verification steps say what to tune and the acceptance look. Record final tuned values in the task report.

## File Structure

```
src/catalog/bodies.ts            (modified) MapSlot, AtmosphereSpec, RingSpec, RingBand, OceanGlint; maps/atmosphere/rings per body
src/catalog/textureFiles.ts      (new) textureFileName, allTextureFiles derived from the catalog
scripts/fetch-textures.mjs       (modified) downloads allTextureFiles()
src/camera/cameraController.ts   (modified) MIN_ALTITUDE_FRACTION 0.002; snapTo()
src/render/lod.ts                (new) pure LOD rules and chooseHiRes
src/render/textureManager.ts     (new) tiered texture loading with budgeted 8K
src/render/textures.ts           (modified) loadTexture(stem, kind)
src/render/surfaceMaterial.ts    (new) shared surface ShaderMaterial
src/render/bodyView.ts           (rewritten) LOD meshes, surface, sprite, effects
src/render/solarScene.ts         (modified) two-pass frame, budget, effects toggle, pixel stats
src/render/atmosphereMath.ts     (new) tested reference maths
src/render/atmosphere.ts         (new) AtmosphereEffect
src/render/ringMath.ts           (new) tested reference maths
src/render/ringProfile.ts        (new) band list to opacity profile
src/render/rings.ts              (new) RingEffect
src/render/clouds.ts             (new) CloudEffect
src/main.ts                      (modified) debug hook additions
scripts/shot.mjs                 (modified) --view and --effects options
scripts/smoke.mjs                (modified) extended checks
tests/**                         (matching test files)
```

---

### Task 1: Catalog data model, texture file list and the closer camera

**Files:**
- Modify: `src/catalog/bodies.ts` (replace the whole file), `src/camera/cameraController.ts:6`, `tsconfig.json`, `tests/catalog/bodies.test.ts` (replace the whole file)
- Create: `src/catalog/textureFiles.ts`

**Interfaces:**
- Produces (`bodies.ts`): `MapSlot { lo: string; hi?: string }`; `AtmosphereSpec { heightFraction; scaleHeightFraction; mieScaleHeightFraction; rayleigh: readonly [number, number, number]; mie; mieG; intensity; tint: readonly [number, number, number] }`; `RingBand { centerKm; widthKm; opacity }`; `RingSpec { innerM; outerM; alphaMap?: string; bands?: readonly RingBand[]; tint: string }`; `OceanGlint { strength; shininess }`; `BodyData` gains `maps: { color: MapSlot; night?: MapSlot; clouds?: MapSlot }` (REPLACING the old `texture: string` field), `atmosphere?`, `rings?`, `oceanGlint?`, `cloudShellFraction?: number`. Everything else in `BodyData`, `BODIES`, `BODY_IDS`, `getBody`, `BodyId` is unchanged.
- Produces (`textureFiles.ts`): `textureFileName(stem: string): string` (`.png` for stems ending `_ring_alpha`, else `.jpg`); `allTextureFiles(): string[]` (every stem the catalog references, with extension, no duplicates).
- Produces: `MIN_ALTITUDE_FRACTION = 0.002` in `cameraController.ts`.

- [ ] **Step 1: Write the failing test.** Replace `tests/catalog/bodies.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { MIN_ALTITUDE_FRACTION } from '../../src/camera/cameraController';
import { BODIES, BODY_IDS, getBody, type BodyId } from '../../src/catalog/bodies';
import { allTextureFiles, textureFileName } from '../../src/catalog/textureFiles';

describe('catalog', () => {
  it('lists the Sun and eight planets in order', () => {
    expect(BODY_IDS).toEqual(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  });
  it('has unique ids and finite, positive physical values', () => {
    expect(new Set(BODIES.map((b) => b.id)).size).toBe(BODIES.length);
    for (const b of BODIES) {
      expect(b.radiusM, b.id).toBeGreaterThan(0);
      expect(b.massKg, b.id).toBeGreaterThan(0);
      expect(b.surfaceGravity, b.id).toBeGreaterThan(0);
      expect(b.meanTempK, b.id).toBeGreaterThan(0);
      expect(Number.isFinite(b.rotationPeriodH), b.id).toBe(true);
      expect(b.rotationPeriodH, b.id).not.toBe(0);
      expect(b.maps.color.lo.length, b.id).toBeGreaterThan(0);
      expect(b.source.length, b.id).toBeGreaterThan(0);
    }
  });
  it('matches well-known values', () => {
    expect(getBody('earth').radiusM).toBeCloseTo(6_371_000, -3);
    expect(getBody('sun').radiusM).toBeCloseTo(695_700_000, -3);
    expect(getBody('jupiter').massKg / 1.898e27).toBeCloseTo(1, 2);
    expect(getBody('sun').kind).toBe('star');
    expect(getBody('earth').kind).toBe('planet');
  });
  it('marks retrograde rotators with negative periods', () => {
    expect(getBody('venus').rotationPeriodH).toBeLessThan(0);
    expect(getBody('uranus').rotationPeriodH).toBeLessThan(0);
    expect(getBody('earth').rotationPeriodH).toBeGreaterThan(0);
  });
});

describe('phase 2a catalog data', () => {
  const ids = (pick: (b: (typeof BODIES)[number]) => unknown): BodyId[] => BODIES.filter((b) => pick(b)).map((b) => b.id);

  it('has 8K maps exactly where the source provides them', () => {
    expect(ids((b) => b.maps.color.hi)).toEqual(['sun', 'mercury', 'earth', 'mars', 'jupiter', 'saturn']);
  });
  it('uses the 4K cloud-top map as the Venus base map', () => {
    expect(getBody('venus').maps.color.lo).toBe('4k_venus_atmosphere');
  });
  it('gives Earth night and cloud maps with 2K and 8K tiers', () => {
    const earth = getBody('earth');
    expect(earth.maps.night).toEqual({ lo: '2k_earth_nightmap', hi: '8k_earth_nightmap' });
    expect(earth.maps.clouds).toEqual({ lo: '2k_earth_clouds', hi: '8k_earth_clouds' });
    expect(earth.oceanGlint).toBeDefined();
  });
  it('attaches atmospheres to Earth, Venus, Mars and the four giants only', () => {
    expect(ids((b) => b.atmosphere)).toEqual(['venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    for (const b of BODIES) {
      if (!b.atmosphere) continue;
      const a = b.atmosphere;
      expect(a.heightFraction, b.id).toBeGreaterThan(0);
      expect(a.scaleHeightFraction, b.id).toBeGreaterThan(0);
      expect(a.scaleHeightFraction, b.id).toBeLessThan(a.heightFraction);
      expect(a.mieScaleHeightFraction, b.id).toBeGreaterThan(0);
      expect(a.mieG, b.id).toBeGreaterThan(-1);
      expect(a.mieG, b.id).toBeLessThan(1);
    }
  });
  it('attaches rings to the four giants, textured for Saturn and procedural for the rest', () => {
    expect(ids((b) => b.rings)).toEqual(['jupiter', 'saturn', 'uranus', 'neptune']);
    expect(getBody('saturn').rings?.alphaMap).toBe('8k_saturn_ring_alpha');
    for (const id of ['jupiter', 'uranus', 'neptune'] as const) {
      expect(getBody(id).rings?.alphaMap, id).toBeUndefined();
      expect(getBody(id).rings?.bands?.length ?? 0, id).toBeGreaterThan(0);
    }
  });
  it('orders ring radii and keeps every procedural band inside them, outside the planet', () => {
    for (const b of BODIES) {
      if (!b.rings) continue;
      const { innerM, outerM, bands } = b.rings;
      expect(innerM, b.id).toBeGreaterThan(b.radiusM);
      expect(outerM, b.id).toBeGreaterThan(innerM);
      for (const band of bands ?? []) {
        const lo = (band.centerKm - band.widthKm / 2) * 1000;
        const hi = (band.centerKm + band.widthKm / 2) * 1000;
        expect(lo, `${b.id} band ${band.centerKm}`).toBeGreaterThanOrEqual(innerM);
        expect(hi, `${b.id} band ${band.centerKm}`).toBeLessThanOrEqual(outerM);
        expect(band.opacity, b.id).toBeGreaterThan(0);
        expect(band.opacity, b.id).toBeLessThanOrEqual(1);
      }
    }
  });
  it('keeps the cloud shell below the camera minimum altitude', () => {
    const earth = getBody('earth');
    expect(earth.cloudShellFraction).toBeDefined();
    expect(earth.cloudShellFraction!).toBeLessThan(MIN_ALTITUDE_FRACTION);
  });
});

describe('textureFiles', () => {
  it('names ring alpha strips as PNG and everything else as JPEG', () => {
    expect(textureFileName('8k_saturn_ring_alpha')).toBe('8k_saturn_ring_alpha.png');
    expect(textureFileName('8k_mars')).toBe('8k_mars.jpg');
  });
  it('lists every file the catalog references exactly once', () => {
    const files = allTextureFiles();
    expect(new Set(files).size).toBe(files.length);
    for (const f of [
      '2k_sun.jpg', '8k_sun.jpg', '2k_mercury.jpg', '8k_mercury.jpg', '4k_venus_atmosphere.jpg',
      '2k_earth_daymap.jpg', '8k_earth_daymap.jpg', '2k_earth_nightmap.jpg', '8k_earth_nightmap.jpg',
      '2k_earth_clouds.jpg', '8k_earth_clouds.jpg', '2k_mars.jpg', '8k_mars.jpg', '2k_jupiter.jpg', '8k_jupiter.jpg',
      '2k_saturn.jpg', '8k_saturn.jpg', '8k_saturn_ring_alpha.png', '2k_uranus.jpg', '2k_neptune.jpg',
    ]) {
      expect(files, f).toContain(f);
    }
    expect(files).not.toContain('2k_venus_surface.jpg');
  });
});
```

- [ ] **Step 2: Run it to see it fail.** Run: `npx vitest run tests/catalog`. Expected: FAIL (cannot resolve `textureFiles`, and `maps` undefined).

- [ ] **Step 3: Allow `.ts` import specifiers** (the download script imports the catalog directly and Node needs the extension). In `tsconfig.json` add `"allowImportingTsExtensions": true` inside `compilerOptions` (it is legal because `noEmit` is set).

- [ ] **Step 4: Replace `src/catalog/bodies.ts`** with the code below. Keep every existing physical value unchanged (radii, masses, rotation, tilt, gravity, temperature, source); only the texture fields change and the new specs are added. Atmosphere numbers are INITIAL values (see Task 5 for tuning).

```ts
export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

/** One map at two resolutions: `lo` (2K, always resident) and an optional `hi` (8K, loaded only for nearby bodies). */
export interface MapSlot {
  lo: string;
  hi?: string;
}

export interface AtmosphereSpec {
  /** Shell top as a fraction of the body radius. */
  heightFraction: number;
  /** Rayleigh and Mie density e-folding heights as fractions of the radius. */
  scaleHeightFraction: number;
  mieScaleHeightFraction: number;
  /** Rayleigh scattering coefficient at the surface, RGB, per body radius. */
  rayleigh: readonly [number, number, number];
  /** Mie scattering coefficient at the surface (per body radius) and its phase asymmetry. */
  mie: number;
  mieG: number;
  /** Sun brightness multiplier, and a final colour tint (linear RGB). */
  intensity: number;
  tint: readonly [number, number, number];
}

export interface RingBand {
  centerKm: number;
  widthKm: number;
  opacity: number;
}

export interface RingSpec {
  /** Radii from the planet's centre, in metres. */
  innerM: number;
  outerM: number;
  /** File stem in public/textures (.png): an RGBA strip whose x axis runs radially, inner to outer. */
  alphaMap?: string;
  /** Procedural bands, used when `alphaMap` is absent. */
  bands?: readonly RingBand[];
  /** Colour for procedural rings (CSS hex). */
  tint: string;
}

export interface OceanGlint {
  strength: number;
  shininess: number;
}

export interface BodyData {
  id: BodyId;
  name: string;
  kind: 'star' | 'planet';
  /** Volumetric mean radius. */
  radiusM: number;
  massKg: number;
  /** Sidereal rotation period in hours; negative means retrograde. Info panel only. */
  rotationPeriodH: number;
  /** Obliquity to orbit in degrees (Sun: to the ecliptic). Info panel only. */
  axialTiltDeg: number;
  surfaceGravity: number;
  meanTempK: number;
  tempNote?: string;
  /** File stems in public/textures (without extension). */
  maps: { color: MapSlot; night?: MapSlot; clouds?: MapSlot };
  atmosphere?: AtmosphereSpec;
  rings?: RingSpec;
  oceanGlint?: OceanGlint;
  /** Cloud shell height above the surface as a fraction of the radius; must stay below the camera minimum altitude. */
  cloudShellFraction?: number;
  /** CSS colour used for the flat fallback, sprites and orbit lines. */
  color: string;
  source: string;
}

const PLANET_SOURCE = 'NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet)';

export const BODIES: readonly BodyData[] = [
  {
    id: 'sun', name: 'Sun', kind: 'star', radiusM: 695_700_000, massKg: 1.9885e30, rotationPeriodH: 609.12,
    axialTiltDeg: 7.25, surfaceGravity: 274.0, meanTempK: 5772, tempNote: 'effective temperature of the photosphere',
    maps: { color: { lo: '2k_sun', hi: '8k_sun' } }, color: '#ffd27a',
    source: 'NASA Sun Fact Sheet; IAU 2015 nominal solar values',
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', radiusM: 2_439_400, massKg: 3.30e23, rotationPeriodH: 1407.6,
    axialTiltDeg: 0.034, surfaceGravity: 3.7, meanTempK: 440.15,
    maps: { color: { lo: '2k_mercury', hi: '8k_mercury' } }, color: '#a8a29e', source: PLANET_SOURCE,
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', radiusM: 6_051_800, massKg: 4.87e24, rotationPeriodH: -5832.5,
    axialTiltDeg: 177.4, surfaceGravity: 8.9, meanTempK: 737.15,
    // The surface is invisible under the clouds, so the base map is the cloud-top image.
    maps: { color: { lo: '4k_venus_atmosphere' } }, color: '#e3c07a', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.012, scaleHeightFraction: 0.0026, mieScaleHeightFraction: 0.0026,
      rayleigh: [60, 110, 230], mie: 3000, mieG: 0.5, intensity: 14, tint: [1.0, 0.93, 0.72],
    },
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', radiusM: 6_371_000, massKg: 5.97e24, rotationPeriodH: 23.9345,
    axialTiltDeg: 23.4, surfaceGravity: 9.8, meanTempK: 288.15,
    maps: {
      color: { lo: '2k_earth_daymap', hi: '8k_earth_daymap' },
      night: { lo: '2k_earth_nightmap', hi: '8k_earth_nightmap' },
      clouds: { lo: '2k_earth_clouds', hi: '8k_earth_clouds' },
    },
    oceanGlint: { strength: 0.8, shininess: 60 },
    cloudShellFraction: 0.0015,
    color: '#4f86d6', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.0157, scaleHeightFraction: 0.00126, mieScaleHeightFraction: 0.00019,
      rayleigh: [36.9, 86.0, 211.0], mie: 134, mieG: 0.76, intensity: 22, tint: [1, 1, 1],
    },
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', radiusM: 3_389_500, massKg: 6.42e23, rotationPeriodH: 24.6229,
    axialTiltDeg: 25.2, surfaceGravity: 3.7, meanTempK: 208.15,
    maps: { color: { lo: '2k_mars', hi: '8k_mars' } }, color: '#c1440e', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.012, scaleHeightFraction: 0.00328, mieScaleHeightFraction: 0.00328,
      rayleigh: [0.5, 1.1, 2.6], mie: 154, mieG: 0.6, intensity: 22, tint: [1.0, 0.75, 0.5],
    },
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', radiusM: 69_911_000, massKg: 1.898e27, rotationPeriodH: 9.925,
    axialTiltDeg: 3.1, surfaceGravity: 23.1, meanTempK: 163.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_jupiter', hi: '8k_jupiter' } }, color: '#c99b6d', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.02, scaleHeightFraction: 0.004, mieScaleHeightFraction: 0.003,
      rayleigh: [5, 10, 22], mie: 6, mieG: 0.5, intensity: 16, tint: [1.0, 0.9, 0.75],
    },
    rings: {
      innerM: 92_000_000, outerM: 226_000_000, tint: '#8a7f73',
      bands: [
        { centerKm: 107_250, widthKm: 30_500, opacity: 0.02 }, // halo, 92,000-122,500 km
        { centerKm: 125_750, widthKm: 6_500, opacity: 0.08 }, // main ring, 122,500-129,000 km
        { centerKm: 155_500, widthKm: 53_000, opacity: 0.01 }, // Amalthea gossamer, 129,000-182,000 km
        { centerKm: 177_500, widthKm: 97_000, opacity: 0.005 }, // Thebe gossamer, 129,000-226,000 km
      ],
    },
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', radiusM: 58_232_000, massKg: 5.68e26, rotationPeriodH: 10.656,
    axialTiltDeg: 26.7, surfaceGravity: 9.0, meanTempK: 133.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_saturn', hi: '8k_saturn' } }, color: '#e0c98f', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.02, scaleHeightFraction: 0.004, mieScaleHeightFraction: 0.003,
      rayleigh: [4, 8, 18], mie: 6, mieG: 0.5, intensity: 16, tint: [1.0, 0.93, 0.72],
    },
    // D ring inner edge to F ring: the alpha strip spans exactly this range (Cassini Division at 71% of the width).
    rings: { innerM: 66_900_000, outerM: 140_220_000, alphaMap: '8k_saturn_ring_alpha', tint: '#c9b99a' },
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', radiusM: 25_362_000, massKg: 8.68e25, rotationPeriodH: -17.24,
    axialTiltDeg: 97.8, surfaceGravity: 8.7, meanTempK: 78.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_uranus' } }, color: '#9fd8e0', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.025, scaleHeightFraction: 0.004, mieScaleHeightFraction: 0.003,
      rayleigh: [2, 14, 16], mie: 5, mieG: 0.5, intensity: 16, tint: [0.7, 1.0, 1.0],
    },
    rings: {
      innerM: 41_000_000, outerM: 52_000_000, tint: '#5f5a55',
      bands: [
        { centerKm: 41_837, widthKm: 1.6, opacity: 0.3 }, // ring 6
        { centerKm: 42_234, widthKm: 1.9, opacity: 0.3 }, // ring 5
        { centerKm: 42_570, widthKm: 2.4, opacity: 0.3 }, // ring 4
        { centerKm: 44_718, widthKm: 7.2, opacity: 0.3 }, // alpha
        { centerKm: 45_661, widthKm: 8.2, opacity: 0.3 }, // beta
        { centerKm: 47_176, widthKm: 1.9, opacity: 0.3 }, // eta
        { centerKm: 47_627, widthKm: 3.6, opacity: 0.3 }, // gamma
        { centerKm: 48_300, widthKm: 6.6, opacity: 0.3 }, // delta
        { centerKm: 50_024, widthKm: 2.0, opacity: 0.3 }, // lambda
        { centerKm: 51_149, widthKm: 58, opacity: 0.5 }, // epsilon
      ],
    },
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', radiusM: 24_622_000, massKg: 1.02e26, rotationPeriodH: 16.11,
    axialTiltDeg: 28.3, surfaceGravity: 11.0, meanTempK: 73.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_neptune' } }, color: '#4a6fe0', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.025, scaleHeightFraction: 0.004, mieScaleHeightFraction: 0.003,
      rayleigh: [3, 10, 30], mie: 5, mieG: 0.5, intensity: 16, tint: [0.55, 0.75, 1.0],
    },
    rings: {
      innerM: 40_000_000, outerM: 64_000_000, tint: '#5a5854',
      bands: [
        { centerKm: 41_900, widthKm: 2_000, opacity: 0.02 }, // Galle
        { centerKm: 53_200, widthKm: 113, opacity: 0.05 }, // Le Verrier
        { centerKm: 55_200, widthKm: 4_000, opacity: 0.01 }, // Lassell/Arago plateau, 53,200-57,200 km
        { centerKm: 57_200, widthKm: 100, opacity: 0.03 }, // Arago
        { centerKm: 62_933, widthKm: 35, opacity: 0.05 }, // Adams
      ],
    },
  },
];

export const BODY_IDS: readonly BodyId[] = BODIES.map((b) => b.id);

const BY_ID = new Map<BodyId, BodyData>(BODIES.map((b) => [b.id, b]));

export function getBody(id: BodyId): BodyData {
  const body = BY_ID.get(id);
  if (!body) throw new Error(`unknown body: ${id}`);
  return body;
}
```

- [ ] **Step 5: Create `src/catalog/textureFiles.ts`.** Note the `.ts` extension in the import (Node loads this file directly from `scripts/fetch-textures.mjs`, and it must use only erasable TypeScript syntax):

```ts
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
    if (body.rings?.alphaMap) stems.add(body.rings.alphaMap);
  }
  return [...stems].map(textureFileName);
}
```

- [ ] **Step 6: Lower the camera minimum.** In `src/camera/cameraController.ts` change line 6 to `export const MIN_ALTITUDE_FRACTION = 0.002;`.

- [ ] **Step 7: Fix the one phase-1 consumer of the removed field.** `src/render/bodyView.ts` reads `data.texture`; change that single use to `data.maps.color.lo` so the project still typechecks (Task 4 rewrites this file entirely).

- [ ] **Step 8: Run everything.** Run: `npx vitest run && npm run typecheck`. Expected: all tests PASS (the catalog tests and the existing camera tests, which use the constant symbolically), typecheck clean. If `tests/camera` fails on a hard-coded 2%, fix that test to use `MIN_ALTITUDE_FRACTION`.

- [ ] **Step 9: Commit.**

```bash
git add -A
git commit -m "Extend catalog for phase 2a (maps, atmospheres, rings, glint) and lower minimum altitude to 0.2%" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Download script for the full texture set

**Files:**
- Modify: `scripts/fetch-textures.mjs` (replace the whole file)

**Interfaces:**
- Consumes: `allTextureFiles()` from `src/catalog/textureFiles.ts` (Task 1).
- Produces: every file in `allTextureFiles()` present in `public/textures/` after `npm run textures`.

- [ ] **Step 1: Replace `scripts/fetch-textures.mjs`:**

```js
// Downloads every texture the catalog references from Solar System Scope (CC BY 4.0) into public/textures.
// The file list comes straight from the TypeScript catalog (Node strips the types), so it cannot drift.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { allTextureFiles } from '../src/catalog/textureFiles.ts';

const DIR = new URL('../public/textures/', import.meta.url);
await mkdir(DIR, { recursive: true });

const MAGIC = { jpg: [0xff, 0xd8], png: [0x89, 0x50] };
const MIN_BYTES = { jpg: 20_000, png: 2_000 };

let totalBytes = 0;
for (const file of allTextureFiles()) {
  const ext = file.endsWith('.png') ? 'png' : 'jpg';
  const target = new URL(file, DIR);
  const existing = await stat(target).then((s) => s.size, () => null);
  if (existing !== null) {
    totalBytes += existing;
    console.log(`have  ${file}`);
    continue;
  }
  // The site serves an HTML page unless a browser-like user agent is sent.
  const res = await fetch(`https://www.solarsystemscope.com/textures/download/${file}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const [m0, m1] = MAGIC[ext];
  if (!res.ok || bytes[0] !== m0 || bytes[1] !== m1 || bytes.length < MIN_BYTES[ext]) {
    throw new Error(`${file}: expected a ${ext.toUpperCase()}, got status ${res.status}, ${bytes.length} bytes`);
  }
  await writeFile(target, bytes);
  totalBytes += bytes.length;
  console.log(`got   ${file} (${Math.round(bytes.length / 1024)} KB)`);
}
console.log(`total ${Math.round(totalBytes / 1024 / 1024)} MB in public/textures`);
```

- [ ] **Step 2: Run it.** Run: `npm run textures`. Expected: `got`/`have` lines for the 20 files listed in the Task 1 test (10 already-present 2K files print `have`), ending with a total in MB (roughly 60-200 MB). Any thrown error means a file name is wrong or the site refused: report it, do not skip files.

- [ ] **Step 3: Confirm nothing large is tracked.** Run: `git status --short`. Expected: only `scripts/fetch-textures.mjs` modified (textures are git-ignored). `ls public/textures | wc -l` should now be at least 20.

- [ ] **Step 4: Commit.**

```bash
git add scripts/fetch-textures.mjs
git commit -m "Download the full 2K/8K texture set from the catalog file list" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: LOD rules and a scriptable view

**Files:**
- Create: `src/render/lod.ts`
- Modify: `src/camera/cameraController.ts` (add `snapTo`), `src/main.ts` (debug hook), `scripts/shot.mjs` (options)
- Test: `tests/render/lod.test.ts`, `tests/camera/cameraController.test.ts` (append)

**Interfaces:**
- Consumes: `BodyId` (Task 1), `CameraController`, `MAX_PITCH`, `clamp` (phase 1).
- Produces (`lod.ts`): `type MeshDetail = 'far' | 'near'`; constants `NEAR_MESH_ON_PX = 150`, `NEAR_MESH_OFF_PX = 120`, `HI_TEXTURE_ON_PX = 600`, `HI_TEXTURE_OFF_PX = 450`, `HI_RES_BUDGET = 2`, `ATMOSPHERE_MIN_PX = 20`; `pickMeshDetail(screenPx: number, current: MeshDetail): MeshDetail`; `wantsHiTexture(screenPx: number, currentlyHi: boolean): boolean`; `interface HiResCandidate { id: BodyId; screenPx: number; wants: boolean; hasHi: boolean }`; `chooseHiRes(candidates: readonly HiResCandidate[], budget: number): Set<BodyId>`.
- Produces: `CameraController.snapTo(id: BodyId, altitudeM: number, yaw: number, pitch: number): void`.
- Produces (`window.__solar`): `setView(id: BodyId, altitudeM: number, yawOffsetDeg: number, pitchDeg: number): void` (yaw offset is relative to the sunward direction: 0 = Sun behind the camera / full phase, 90 = quarter, 180 = night side) and `setTime(iso: string): void` (pauses the clock at that UTC time).
- Produces (`scripts/shot.mjs`): `--view id,altitudeM,yawOffsetDeg,pitchDeg` and `--time ISO` options.

- [ ] **Step 1: Write the failing LOD tests** — `tests/render/lod.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  HI_RES_BUDGET, HI_TEXTURE_OFF_PX, HI_TEXTURE_ON_PX, NEAR_MESH_OFF_PX, NEAR_MESH_ON_PX,
  chooseHiRes, pickMeshDetail, wantsHiTexture, type HiResCandidate,
} from '../../src/render/lod';

describe('pickMeshDetail', () => {
  it('switches to the near mesh at the on threshold and back below the off threshold (hysteresis)', () => {
    expect(pickMeshDetail(NEAR_MESH_ON_PX - 1, 'far')).toBe('far');
    expect(pickMeshDetail(NEAR_MESH_ON_PX, 'far')).toBe('near');
    expect(pickMeshDetail(NEAR_MESH_ON_PX - 1, 'near')).toBe('near');
    expect(pickMeshDetail(NEAR_MESH_OFF_PX, 'near')).toBe('near');
    expect(pickMeshDetail(NEAR_MESH_OFF_PX - 1, 'near')).toBe('far');
  });
});

describe('wantsHiTexture', () => {
  it('turns on at 600 px and stays on until below 450 px', () => {
    expect(wantsHiTexture(HI_TEXTURE_ON_PX - 1, false)).toBe(false);
    expect(wantsHiTexture(HI_TEXTURE_ON_PX, false)).toBe(true);
    expect(wantsHiTexture(HI_TEXTURE_ON_PX - 1, true)).toBe(true);
    expect(wantsHiTexture(HI_TEXTURE_OFF_PX, true)).toBe(true);
    expect(wantsHiTexture(HI_TEXTURE_OFF_PX - 1, true)).toBe(false);
  });
});

describe('chooseHiRes', () => {
  const c = (id: HiResCandidate['id'], screenPx: number, wants = true, hasHi = true): HiResCandidate => ({ id, screenPx, wants, hasHi });

  it('has a budget of two', () => {
    expect(HI_RES_BUDGET).toBe(2);
  });
  it('grants the bodies with the largest apparent size within the budget', () => {
    const granted = chooseHiRes([c('earth', 900), c('mars', 700), c('jupiter', 800), c('saturn', 650)], 2);
    expect(granted).toEqual(new Set(['earth', 'jupiter']));
  });
  it('ignores bodies that do not want it or have no hi map', () => {
    const granted = chooseHiRes([c('earth', 900, false), c('uranus', 2000, true, false), c('mars', 700)], 2);
    expect(granted).toEqual(new Set(['mars']));
  });
  it('grants nothing with a zero budget or no candidates', () => {
    expect(chooseHiRes([c('earth', 900)], 0).size).toBe(0);
    expect(chooseHiRes([], 2).size).toBe(0);
  });
  it('does not mutate its input', () => {
    const input = [c('earth', 100), c('mars', 900)];
    chooseHiRes(input, 1);
    expect(input.map((x) => x.id)).toEqual(['earth', 'mars']);
  });
});
```

- [ ] **Step 2: Run to see it fail.** Run: `npx vitest run tests/render/lod.test.ts`. Expected: FAIL (cannot resolve `../../src/render/lod`).

- [ ] **Step 3: Write `src/render/lod.ts`:**

```ts
import type { BodyId } from '../catalog/bodies';

export type MeshDetail = 'far' | 'near';

/** Apparent disc diameter (CSS px) at which the detailed sphere mesh turns on, and the lower value it turns off at. */
export const NEAR_MESH_ON_PX = 150;
export const NEAR_MESH_OFF_PX = 120;
/** Apparent disc diameter at which a body asks for its 8K maps, and the lower value it releases them at. */
export const HI_TEXTURE_ON_PX = 600;
export const HI_TEXTURE_OFF_PX = 450;
/** At most this many bodies hold 8K maps at once (an 8K colour map is about 180 MB of GPU memory with mipmaps). */
export const HI_RES_BUDGET = 2;
/** Atmosphere shells are not drawn for bodies smaller than this. */
export const ATMOSPHERE_MIN_PX = 20;

export function pickMeshDetail(screenPx: number, current: MeshDetail): MeshDetail {
  if (current === 'near') return screenPx < NEAR_MESH_OFF_PX ? 'far' : 'near';
  return screenPx >= NEAR_MESH_ON_PX ? 'near' : 'far';
}

export function wantsHiTexture(screenPx: number, currentlyHi: boolean): boolean {
  return currentlyHi ? screenPx >= HI_TEXTURE_OFF_PX : screenPx >= HI_TEXTURE_ON_PX;
}

export interface HiResCandidate {
  id: BodyId;
  screenPx: number;
  wants: boolean;
  hasHi: boolean;
}

/** The bodies that get 8K maps this frame: those that want them and have them, largest on screen first, within the budget. */
export function chooseHiRes(candidates: readonly HiResCandidate[], budget: number): Set<BodyId> {
  return new Set(
    candidates
      .filter((c) => c.wants && c.hasHi)
      .sort((a, b) => b.screenPx - a.screenPx)
      .slice(0, Math.max(0, budget))
      .map((c) => c.id),
  );
}
```

- [ ] **Step 4: Run the LOD tests.** Run: `npx vitest run tests/render/lod.test.ts`. Expected: PASS.

- [ ] **Step 5: Write the failing `snapTo` tests.** Append to `tests/camera/cameraController.test.ts` (the file already defines `source`, `make()` and imports `CameraController`, `FLIGHT_SECONDS`, `MAX_CAMERA_DISTANCE_M`, `MIN_ALTITUDE_FRACTION`, `MAX_PITCH`; add any missing name to its existing import):

```ts
describe('snapTo', () => {
  it('jumps to the given focus, altitude and angles without a flight', () => {
    const c = make();
    c.snapTo('neptune', 1e8, 1.0, 0.3);
    expect(c.isFlying).toBe(false);
    const pose = c.update(0);
    expect(pose.focusId).toBe('neptune');
    expect(pose.altitudeM).toBeCloseTo(1e8, -1);
    expect(c.yaw).toBe(1.0);
    expect(c.pitch).toBeCloseTo(0.3, 12);
  });
  it('cancels a flight in progress', () => {
    const c = make();
    c.flyTo('neptune');
    c.snapTo('earth', 1e7, 0, 0);
    expect(c.isFlying).toBe(false);
    expect(c.displayId).toBe('earth');
  });
  it('clamps altitude to the limits and pitch to the maximum', () => {
    const c = make();
    c.snapTo('earth', 1, 0, 10);
    expect(c.update(0).altitudeM).toBeCloseTo(MIN_ALTITUDE_FRACTION * 6.371e6, 3);
    expect(c.pitch).toBeCloseTo(MAX_PITCH, 12);
    c.snapTo('earth', 1e30, 0, -10);
    expect(c.update(0).altitudeM).toBeCloseTo(MAX_CAMERA_DISTANCE_M, -3);
    expect(c.pitch).toBeCloseTo(-MAX_PITCH, 12);
  });
});
```

Run: `npx vitest run tests/camera`. Expected: FAIL (`snapTo` is not a function).

- [ ] **Step 6: Add `snapTo` to `CameraController`** (`src/camera/cameraController.ts`), right after the `flyTo` method:

```ts
  /** Jumps straight to a view with no flight. Used by tests and the debug hook. */
  snapTo(id: BodyId, altitudeM: number, yaw: number, pitch: number): void {
    this.flight = null;
    this.focusId = id;
    this.logAlt = Math.log(this.clampAltitude(altitudeM, id));
    this.yaw = yaw;
    this.pitch = clamp(pitch, -MAX_PITCH, MAX_PITCH);
  }
```

Run: `npx vitest run tests/camera`. Expected: PASS.

- [ ] **Step 7: Extend the debug hook in `src/main.ts`.** Add `import { DEG } from './units';` to the imports. In the `declare global` block add these two members to the `__solar` type: `setView(id: BodyId, altitudeM: number, yawOffsetDeg: number, pitchDeg: number): void;` and `setTime(iso: string): void;`. In the `window.__solar = { ... }` object add:

```ts
  setView: (id, altitudeM, yawOffsetDeg, pitchDeg) => {
    const base = id === 'sun' ? 0 : sunwardYaw(frame[id].position);
    camera.snapTo(id, altitudeM, base + yawOffsetDeg * DEG, pitchDeg * DEG);
  },
  setTime: (iso) => {
    clock.setTimeMs(Date.parse(iso));
    clock.pause();
  },
```

- [ ] **Step 8: Add the options to `scripts/shot.mjs`.** After the block that handles `--fly` and before the `--wheel` block (anchor: the line `const wheel = option('--wheel');`) insert:

```js
  const time = option('--time');
  if (time) await page.evaluate((iso) => window.__solar.setTime(iso), time);
  const view = option('--view');
  if (view) {
    const [id, altitudeM, yawOffsetDeg, pitchDeg] = view.split(',');
    await page.evaluate(
      ([i, a, y, p]) => window.__solar.setView(i, Number(a), Number(y), Number(p)),
      [id, altitudeM, yawOffsetDeg, pitchDeg],
    );
  }
```
and update the usage comment at the top of the file to `// Usage: node scripts/shot.mjs out.png [--fly <bodyId>] [--time ISO] [--view id,altitudeM,yawOffsetDeg,pitchDeg] [--wheel <pixels>] [--effects off]` (the `--effects` option is added in Task 4).

- [ ] **Step 9: Verify in a visible browser.** Run: `npm run typecheck && npx vitest run`. Expected: clean, all tests pass. Then run (a visible Chromium window opens and closes):

```bash
SP=/tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad
node scripts/shot.mjs $SP/t3-view.png --time 2026-09-20T12:00:00Z --view earth,3e7,90,10
```
Read the PNG: Earth should be a half-lit disc (quarter phase, terminator vertical) with the time bar showing 2026-09-20 12:00 and "paused"; output line says `console errors: none`.

- [ ] **Step 10: Commit.**

```bash
git add -A
git commit -m "Add LOD rules, camera snapTo and a scriptable debug view" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Surface renderer upgrade (custom shader, 8K tiers, detail meshes, effect hooks)

**Files:**
- Create: `src/render/textureManager.ts`, `src/render/surfaceMaterial.ts`
- Modify: `src/render/textures.ts` (replace), `src/render/bodyView.ts` (replace), `src/render/solarScene.ts` (replace), `src/main.ts` (hook), `scripts/shot.mjs` (`--effects`)
- Test: `tests/render/textureManager.test.ts`

**Interfaces:**
- Consumes: `MapSlot`, `BodyData`, `BodyId` (Task 1); `chooseHiRes`, `pickMeshDetail`, `wantsHiTexture`, `HI_RES_BUDGET`, `HiResCandidate`, `MeshDetail` (Task 3); phase 1 `toRenderSpace`, `apparentDiameterPx`, `SPRITE_THRESHOLD_PX`, `orientationToThree`, sprite helpers, `FrameEntry`.
- Produces (`textureManager.ts`): `type MapKind = 'color' | 'night' | 'clouds' | 'ring'`; `type TextureLoadFn = (stem: string, kind: MapKind) => Promise<THREE.Texture | null>`; `class TextureManager { constructor(hiResAllowed: boolean, load: TextureLoadFn); get(bodyId: BodyId, kind: MapKind, slot: MapSlot, wantHi: boolean): THREE.Texture | null; hiCount(): number }`.
- Produces (`textures.ts`): `loadTexture(stem: string, kind: MapKind): Promise<THREE.Texture | null>` (replaces `loadBodyTexture`).
- Produces (`surfaceMaterial.ts`): `createSurfaceMaterial(colorHex: string, unlit: boolean): THREE.ShaderMaterial` with uniforms `uMap, uHasMap, uColor, uNight, uHasNight, uClouds, uHasClouds, uSunDir, uSunLocal, uUnlit, uHasRing, uRingInner, uRingOuter, uRingAlpha, uGlint, uShine`; `dummyTexture(): THREE.DataTexture` (1x1 white).
- Produces (`bodyView.ts`): `RenderInfo` (unchanged); `BodyRenderState { data: BodyData; rel: Vec3; quaternion: THREE.Quaternion; sunDir: THREE.Vector3; camRelBody: THREE.Vector3; sunLocal: THREE.Vector3; camLocal: THREE.Vector3; screenDiameterPx: number; asSphere: boolean; effectsEnabled: boolean; hiRes: boolean }`; `BodyEffect { readonly objects: readonly THREE.Object3D[]; update(state: BodyRenderState): void }`; `BodyUpdateContext { cameraPos: Vec3; sunPos: Vec3; sunRel: Vec3; fovYRad: number; viewportHeightPx: number; hiRes: boolean; effectsEnabled: boolean }`; `class BodyView { constructor(data: BodyData, textures: TextureManager); readonly objects: THREE.Object3D[]; readonly hasHiRes: boolean; get isHiRes(): boolean; measure(entry: FrameEntry, cameraPos: Vec3, fovYRad: number, viewportHeightPx: number): { distanceM: number; screenDiameterPx: number }; update(entry: FrameEntry, ctx: BodyUpdateContext): RenderInfo }`. Unit directions in `BodyRenderState`: `sunDir` is from the body toward the Sun in Three.js axes; `camRelBody` is the camera position relative to the body centre in body radii (Three axes); `sunLocal`/`camLocal` are the same in the body's local (sphere) axes, where +Y is the pole and the equatorial plane is y = 0.
- Produces (`solarScene.ts`): existing `SolarScene` API plus `setEffectsEnabled(on: boolean): void`, `hiResBodies(): BodyId[]`, `textureCount(): number` (`renderer.info.memory.textures`).
- Produces (`window.__solar`): `setEffects(on: boolean): void`, `hiResBodies(): string[]`, `textureCount(): number`.
- Produces (`scripts/shot.mjs`): `--effects off` option.

- [ ] **Step 1: Capture baseline screenshots BEFORE changing any render code** (phase 1 look, visible browser, frozen time so the comparison is deterministic):

```bash
SP=/tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad
node scripts/shot.mjs $SP/base-earth.png --time 2026-09-20T12:00:00Z
node scripts/shot.mjs $SP/base-mercury.png --time 2026-09-20T12:00:00Z --fly mercury
node scripts/shot.mjs $SP/base-jupiter.png --time 2026-09-20T12:00:00Z --fly jupiter
```
Note: `--time` is applied after the `--fly` block in the script; that is fine (the flight ends first, then time freezes). Expected: three PNGs, `console errors: none` each.

- [ ] **Step 2: Write the failing TextureManager tests** — `tests/render/textureManager.test.ts`. The manager takes an injected loader, so it runs under Node with plain `THREE.Texture` objects:

```ts
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TextureManager, type MapKind } from '../../src/render/textureManager';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeLoader() {
  const made = new Map<string, THREE.Texture>();
  const load = vi.fn(async (stem: string, _kind: MapKind) => {
    const t = new THREE.Texture();
    vi.spyOn(t, 'dispose');
    made.set(stem, t);
    return t;
  });
  return { load, made };
}
const slot = { lo: '2k_mars', hi: '8k_mars' };

describe('TextureManager', () => {
  it('loads the 2K map once and returns null until it arrives', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    expect(m.get('mars', 'color', slot, false)).toBeNull();
    expect(m.get('mars', 'color', slot, false)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    await flush();
    expect(m.get('mars', 'color', slot, false)).toBe(made.get('2k_mars'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('requests the 8K map only when wanted, and returns it once loaded', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, false);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    m.get('mars', 'color', slot, true);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(m.get('mars', 'color', slot, true)).toBe(made.get('8k_mars'));
    expect(m.hiCount()).toBe(1);
  });

  it('falls back to the 2K map while the 8K map is still loading', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, false);
    await flush();
    expect(m.get('mars', 'color', slot, true)).toBe(made.get('2k_mars'));
  });

  it('disposes the 8K map when it is no longer wanted and returns the 2K map', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, true);
    await flush();
    m.get('mars', 'color', slot, true);
    const hi = made.get('8k_mars')!;
    expect(m.get('mars', 'color', slot, false)).toBe(made.get('2k_mars'));
    expect(hi.dispose).toHaveBeenCalledTimes(1);
    expect(m.hiCount()).toBe(0);
  });

  it('disposes an 8K map that arrives after it stopped being wanted', async () => {
    const { load, made } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, true);
    m.get('mars', 'color', slot, false);
    await flush();
    expect(made.get('8k_mars')!.dispose).toHaveBeenCalledTimes(1);
    expect(m.hiCount()).toBe(0);
  });

  it('never loads 8K when hi-res is not allowed or the slot has no hi map', async () => {
    const a = makeLoader();
    const disallowed = new TextureManager(false, a.load);
    disallowed.get('mars', 'color', slot, true);
    await flush();
    expect(a.load).toHaveBeenCalledTimes(1);
    const b = makeLoader();
    const noHi = new TextureManager(true, b.load);
    noHi.get('uranus', 'color', { lo: '2k_uranus' }, true);
    await flush();
    expect(b.load).toHaveBeenCalledTimes(1);
  });

  it('does not retry an 8K map that failed to load', async () => {
    const load = vi.fn(async (stem: string) => (stem === '8k_mars' ? null : new THREE.Texture()));
    const m = new TextureManager(true, load);
    m.get('mars', 'color', slot, true);
    await flush();
    m.get('mars', 'color', slot, true);
    await flush();
    m.get('mars', 'color', slot, true);
    await flush();
    expect(load.mock.calls.filter(([stem]) => stem === '8k_mars')).toHaveLength(1);
  });

  it('keeps separate entries per body and per map kind', async () => {
    const { load } = makeLoader();
    const m = new TextureManager(true, load);
    m.get('earth', 'color', { lo: 'a' }, false);
    m.get('earth', 'night', { lo: 'b' }, false);
    m.get('mars', 'color', { lo: 'c' }, false);
    await flush();
    expect(load).toHaveBeenCalledTimes(3);
  });
});
```
Run: `npx vitest run tests/render/textureManager.test.ts`. Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write `src/render/textureManager.ts`:**

```ts
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
```
Run: `npx vitest run tests/render/textureManager.test.ts`. Expected: PASS.

- [ ] **Step 4: Replace `src/render/textures.ts`:**

```ts
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
```

- [ ] **Step 5: Write `src/render/surfaceMaterial.ts`.** One shader for every body. Lighting reproduces phase 1 exactly: the old standard material with a point light of intensity PI, no falloff, roughness 1 gave `albedo * (max(N.L, 0) + 0.04 / PI)`. Features are switched by uniforms (no recompiles).

```ts
import * as THREE from 'three';

let dummy: THREE.DataTexture | null = null;
/** A 1x1 white texture bound to every sampler that has no real map, so uniforms are always valid. */
export function dummyTexture(): THREE.DataTexture {
  if (!dummy) {
    dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    dummy.needsUpdate = true;
  }
  return dummy;
}

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosB;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vPosB = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uColor;
uniform sampler2D uNight;
uniform float uHasNight;
uniform sampler2D uClouds;
uniform float uHasClouds;
uniform vec3 uSunDir;     // unit, from the body toward the Sun, render axes
uniform vec3 uSunLocal;   // the same direction in the body's local axes (+Y = pole)
uniform float uUnlit;
uniform float uHasRing;
uniform float uRingInner; // ring radii in body radii
uniform float uRingOuter;
uniform sampler2D uRingAlpha;
uniform float uGlint;
uniform float uShine;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosB;
varying vec3 vPosW;

void main() {
  vec3 albedo = mix(uColor, texture2D(uMap, vUv).rgb, uHasMap);
  vec3 N = normalize(vNormalW);
  float ndl = dot(N, uSunDir);
  vec3 lit = albedo;
  if (uUnlit < 0.5) {
    // The rings shadow the planet: trace from this surface point toward the Sun to the equatorial plane (local y = 0).
    float shadow = 1.0;
    if (uHasRing > 0.5 && abs(uSunLocal.y) > 1e-4) {
      float s = -vPosB.y / uSunLocal.y;
      if (s > 0.0) {
        vec3 hit = vPosB + uSunLocal * s;
        float u = (length(hit.xz) - uRingInner) / (uRingOuter - uRingInner);
        if (u > 0.0 && u < 1.0) shadow = 1.0 - 0.9 * texture2D(uRingAlpha, vec2(u, 0.5)).a;
      }
    }
    float diffuse = max(ndl, 0.0) * shadow;
    lit = albedo * (diffuse + 0.04 / PI);
    // [T7] night lights and ocean glint are added here
  }
  gl_FragColor = vec4(lit, 1.0);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

export function createSurfaceMaterial(colorHex: string, unlit: boolean): THREE.ShaderMaterial {
  const white = dummyTexture();
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: white },
      uHasMap: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uNight: { value: white },
      uHasNight: { value: 0 },
      uClouds: { value: white },
      uHasClouds: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunLocal: { value: new THREE.Vector3(0, 1, 0) },
      uUnlit: { value: unlit ? 1 : 0 },
      uHasRing: { value: 0 },
      uRingInner: { value: 1 },
      uRingOuter: { value: 2 },
      uRingAlpha: { value: white },
      uGlint: { value: 0 },
      uShine: { value: 40 },
    },
  });
}
```

- [ ] **Step 6: Replace `src/render/bodyView.ts`.** It keeps the phase 1 sprite behaviour, swaps the material for the surface shader, adds the two detail meshes, computes the per-body lighting state once, and leaves ONE clearly marked place per later task.

```ts
import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { FrameEntry } from '../ephemeris/frame';
import type { Vec3 } from '../math';
import { SPRITE_THRESHOLD_PX, apparentDiameterPx, toRenderSpace } from './cameraRelative';
import { pickMeshDetail, type MeshDetail } from './lod';
import { orientationToThree } from './orientation';
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
  /** Body orientation (Three.js axes); the sphere mesh's local +Y is the pole, the equator is local y = 0. */
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
}

const farGeometry = new THREE.SphereGeometry(1, 128, 96);
let nearGeometry: THREE.SphereGeometry | null = null;
/** About 200k vertices; built the first time a body gets close enough to need it. */
function getNearGeometry(): THREE.SphereGeometry {
  nearGeometry ??= new THREE.SphereGeometry(1, 512, 384);
  return nearGeometry;
}

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
  /** Everything the scene must add: the sphere, the sprite and any effect objects. */
  readonly objects: THREE.Object3D[] = [];
  readonly hasHiRes: boolean;
  private readonly mesh: THREE.Mesh;
  private readonly sprite: THREE.Points;
  private readonly spriteMaterial: THREE.PointsMaterial;
  private readonly surface: THREE.ShaderMaterial;
  private readonly effects: BodyEffect[];
  private detail: MeshDetail = 'far';
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
    this.hasHiRes = data.maps.color.hi !== undefined;
    this.surface = createSurfaceMaterial(data.color, data.kind === 'star');
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
    // [T5] atmosphere effect is created here
    // [T6] ring effect is created here
    // [T7] cloud effect is created here
    return effects;
  }

  get isHiRes(): boolean {
    return this.hiRes;
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
    this.sprite.visible = !asSphere;

    if (asSphere) {
      this.detail = pickMeshDetail(screenDiameterPx, this.detail);
      this.mesh.geometry = this.detail === 'near' ? getNearGeometry() : farGeometry;
      this.mesh.position.set(rel[0], rel[1], rel[2]);
      this.mesh.quaternion.setFromRotationMatrix(orientationToThree(entry.orientation));
    } else {
      this.sprite.position.set(rel[0], rel[1], rel[2]);
      const { sizePx, opacity } = spriteAppearance(
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
    if (this.sunDir.lengthSq() < 1) this.sunDir.set(0, 1, 0); // the Sun itself
    else this.sunDir.normalize();
    this.camRelBody.set(-rel[0] / radius, -rel[1] / radius, -rel[2] / radius);
    this.inverseQuat.copy(this.mesh.quaternion).invert();
    this.sunLocal.copy(this.sunDir).applyQuaternion(this.inverseQuat);
    this.camLocal.copy(this.camRelBody).applyQuaternion(this.inverseQuat);

    const state: BodyRenderState = {
      data: this.data, rel, quaternion: this.mesh.quaternion, sunDir: this.sunDir, camRelBody: this.camRelBody,
      sunLocal: this.sunLocal, camLocal: this.camLocal, screenDiameterPx, asSphere,
      effectsEnabled: ctx.effectsEnabled, hiRes: ctx.hiRes,
    };
    if (asSphere) this.updateSurface(state);
    for (const effect of this.effects) effect.update(state);
    return { rel, distanceM, screenDiameterPx };
  }

  private updateSurface(state: BodyRenderState): void {
    const u = this.surface.uniforms;
    const color = this.textures.get(this.data.id, 'color', this.data.maps.color, state.hiRes);
    u.uMap.value = color ?? dummyTexture();
    u.uHasMap.value = color ? 1 : 0;
    u.uSunDir.value.copy(state.sunDir);
    u.uSunLocal.value.copy(state.sunLocal);
    // [T7] night lights and ocean glint uniforms are set here
  }
}
```

- [ ] **Step 7: Replace `src/render/solarScene.ts`.** Changes from phase 1: the point light and ambient light are gone (lighting lives in the surface shader), a `TextureManager` is created, each frame runs two passes (measure every body, choose which get 8K, then update), and the API grows three accessors. Everything else is unchanged.

```ts
import * as THREE from 'three';
import { BODIES, type BodyId } from '../catalog/bodies';
import type { Frame } from '../ephemeris/frame';
import { length, type Vec3 } from '../math';
import { DEG } from '../units';
import { BodyView, type RenderInfo } from './bodyView';
import { nearPlane, orbitLineOpacity, toRenderSpace } from './cameraRelative';
import { HI_RES_BUDGET, chooseHiRes, wantsHiTexture, type HiResCandidate } from './lod';
import { OrbitLine } from './orbitLine';
import { TextureManager } from './textureManager';
import { loadTexture } from './textures';

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
  private readonly textures: TextureManager;
  private readonly hiResAllowed: boolean;
  private readonly views = new Map<BodyId, BodyView>();
  private readonly orbits = new Map<BodyId, OrbitLine>();
  private width = 1;
  private height = 1;
  private lastInput: FrameInput | null = null;
  private effectsEnabled = true;
  private granted = new Set<BodyId>();

  constructor(canvas: HTMLCanvasElement, startDate: Date) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
    // 8K maps need a 8192 texture size; below that every body stays at 2K.
    this.hiResAllowed = this.renderer.capabilities.maxTextureSize >= 8192;
    this.textures = new TextureManager(this.hiResAllowed, loadTexture);
    for (const body of BODIES) {
      const view = new BodyView(body, this.textures);
      this.views.set(body.id, view);
      this.scene.add(...view.objects);
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

  /** Turns the atmosphere, ring and cloud effects (and Earth's night lights and glint) on or off, for A/B checks. */
  setEffectsEnabled(on: boolean): void {
    this.effectsEnabled = on;
  }
  /** Bodies that held their 8K maps in the last frame. */
  hiResBodies(): BodyId[] {
    return [...this.granted];
  }
  /** Number of textures alive on the GPU. */
  textureCount(): number {
    return this.renderer.info.memory.textures;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // re-read: the window can move between displays
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

    const sunPos = input.frame.sun.position;
    const sunRel = toRenderSpace(sunPos, input.cameraPos);

    // Pass 1: how big is each body? That decides which ones get their 8K maps this frame.
    const candidates: HiResCandidate[] = [];
    for (const body of BODIES) {
      const view = this.views.get(body.id)!;
      const m = view.measure(input.frame[body.id], input.cameraPos, this.fovYRad, this.height);
      candidates.push({
        id: body.id, screenPx: m.screenDiameterPx,
        wants: wantsHiTexture(m.screenDiameterPx, view.isHiRes), hasHi: view.hasHiRes,
      });
    }
    this.granted = this.hiResAllowed ? chooseHiRes(candidates, HI_RES_BUDGET) : new Set<BodyId>();

    // Pass 2: update and draw.
    const info = new Map<BodyId, RenderInfo>();
    for (const body of BODIES) {
      const entry = input.frame[body.id];
      const view = this.views.get(body.id)!;
      const result = view.update(entry, {
        cameraPos: input.cameraPos, sunPos, sunRel, fovYRad: this.fovYRad, viewportHeightPx: this.height,
        hiRes: this.granted.has(body.id), effectsEnabled: this.effectsEnabled,
      });
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
```

- [ ] **Step 8: Extend the debug hook in `src/main.ts`.** Add to the `__solar` type: `setEffects(on: boolean): void; hiResBodies(): string[]; textureCount(): number;`. Add to the `window.__solar = { ... }` object: `setEffects: (on) => scene.setEffectsEnabled(on),`, `hiResBodies: () => scene.hiResBodies(),`, `textureCount: () => scene.textureCount(),`.

- [ ] **Step 9: Add `--effects off` to `scripts/shot.mjs`.** Next to the `--time` block from Task 3 insert: `if (option('--effects') === 'off') await page.evaluate(() => window.__solar.setEffects(false));`.

- [ ] **Step 10: Typecheck and test.** Run: `npm run typecheck && npx vitest run`. Expected: clean, all tests pass. Fix type errors minimally (the shader code has no types to check; a GLSL compile error shows up as a console error in the browser).

- [ ] **Step 11: Compare with the phase 1 look (visible browser).** Take the same three shots and diff them:

```bash
SP=/tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad
node scripts/shot.mjs $SP/t4-earth.png --time 2026-09-20T12:00:00Z
node scripts/shot.mjs $SP/t4-mercury.png --time 2026-09-20T12:00:00Z --fly mercury
node scripts/shot.mjs $SP/t4-jupiter.png --time 2026-09-20T12:00:00Z --fly jupiter
python3 - <<'PY'
from PIL import Image, ImageChops
SP='/tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad'
for n in ['earth', 'mercury', 'jupiter']:
    a = Image.open(f'{SP}/base-{n}.png').convert('RGB'); b = Image.open(f'{SP}/t4-{n}.png').convert('RGB')
    px = list(ImageChops.difference(a, b).getdata())
    print(n, 'mean abs diff per channel:', round(sum(sum(p) for p in px) / (len(px) * 3), 3))
PY
```
Expected: each shot prints `console errors: none` (a GLSL compile error would appear here: fix it), and each mean abs difference is below 1.5 (the sphere tessellation and the sub-pixel sprite ordering are the only intended differences). Read all six PNGs: the planets must look the same as before (same lighting, same terminator, same textures). If a difference is larger, find out why (wrong ambient constant, sRGB handling, mirrored map) and fix it: the surface shader must reproduce phase 1.

- [ ] **Step 12: Check the 8K path (visible browser).** Take a close-up: `node scripts/shot.mjs $SP/t4-hires.png --time 2026-09-20T12:00:00Z --view mars,2e6,0,15` and wait: the script waits 500 ms after the view change; if the image still looks like 2K, add `SHOT_HOLD_MS=4000` and take another. Expected: Mars fills the view with visible fine detail (8K), `console errors: none`. Confirm with a small evaluate call or the report that `window.__solar.hiResBodies()` is `['mars']` at that view and `[]` at the default view (you may do this by extending a throwaway script from `scripts/lib/browser.mjs`).

- [ ] **Step 13: Commit.**

```bash
git add -A
git commit -m "Upgrade surface renderer: custom shader, budgeted 8K tiers, detail meshes, effect hooks" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Atmospheres

**Files:**
- Create: `src/render/atmosphereMath.ts`, `src/render/atmosphere.ts`
- Modify: `src/render/bodyView.ts` (one import and one line at the `[T5]` marker), `src/catalog/bodies.ts` (only if tuning changes atmosphere numbers)
- Test: `tests/render/atmosphereMath.test.ts`

**Interfaces:**
- Consumes: `BodyEffect`, `BodyRenderState` (Task 4); `AtmosphereSpec`, `BodyData` (Task 1); `ATMOSPHERE_MIN_PX` (Task 3); `Vec3`, `dot` (phase 1 math).
- Produces (`atmosphereMath.ts`, all positions in body radii with the planet at the origin and radius 1): `raySphere(origin: Vec3, dir: Vec3, radius: number): [number, number] | null`; `density(h: number, scaleHeight: number): number`; `opticalDepth(origin: Vec3, dir: Vec3, dist: number, scaleHeight: number, steps?: number): number`; `viewSegment(camPos: Vec3, dir: Vec3, shellRadius: number): [number, number] | null`.
- Produces (`atmosphere.ts`): `class AtmosphereEffect implements BodyEffect { constructor(data: BodyData) }`; it requires `data.atmosphere`.

- [ ] **Step 1: Write the failing maths tests** — `tests/render/atmosphereMath.test.ts`. These pin the reference the GLSL mirrors:

```ts
import { describe, expect, it } from 'vitest';
import { density, opticalDepth, raySphere, viewSegment } from '../../src/render/atmosphereMath';

describe('raySphere', () => {
  it('returns entry and exit distances for a ray that crosses the sphere', () => {
    const hit = raySphere([0, 0, 3], [0, 0, -1], 1)!;
    expect(hit[0]).toBeCloseTo(2, 12);
    expect(hit[1]).toBeCloseTo(4, 12);
  });
  it('returns null on a miss and a negative entry from inside', () => {
    expect(raySphere([0, 5, 3], [0, 0, -1], 1)).toBeNull();
    const inside = raySphere([0, 0, 0.5], [0, 0, 1], 1)!;
    expect(inside[0]).toBeLessThan(0);
    expect(inside[1]).toBeCloseTo(0.5, 12);
  });
});

describe('density and opticalDepth', () => {
  it('falls off exponentially and is 1 at and below the surface', () => {
    expect(density(0, 0.01)).toBe(1);
    expect(density(-1, 0.01)).toBe(1);
    expect(density(0.01, 0.01)).toBeCloseTo(Math.exp(-1), 12);
  });
  it('matches the analytic vertical optical depth H(1 - exp(-h/H))', () => {
    const H = 0.00126;
    const shellHeight = 0.0157;
    const od = opticalDepth([0, 1, 0], [0, 1, 0], shellHeight, H, 256);
    const analytic = H * (1 - Math.exp(-shellHeight / H));
    expect(od / analytic).toBeGreaterThan(0.999);
    expect(od / analytic).toBeLessThan(1.001);
  });
  it('is much larger along a grazing path than straight up', () => {
    const H = 0.00126;
    const shell = 1.0157;
    const origin = [-2, 1.0005, 0] as const;
    const seg = viewSegment(origin, [1, 0, 0], shell)!;
    const grazing = opticalDepth([origin[0] + seg[0], origin[1], 0], [1, 0, 0], seg[1] - seg[0], H, 256);
    const vertical = opticalDepth([0, 1, 0], [0, 1, 0], 0.0157, H, 256);
    expect(grazing).toBeGreaterThan(5 * vertical);
  });
});

describe('viewSegment', () => {
  it('stops at the surface when the ray hits the planet', () => {
    const seg = viewSegment([0, 0, 3], [0, 0, -1], 1.0157)!;
    expect(seg[0]).toBeCloseTo(3 - 1.0157, 12);
    expect(seg[1]).toBeCloseTo(2, 12);
  });
  it('starts at the camera when the camera is inside the shell', () => {
    const seg = viewSegment([0, 0, 1.005], [0, 0, -1], 1.0157)!;
    expect(seg[0]).toBe(0);
    expect(seg[1]).toBeCloseTo(0.005, 12);
  });
  it('covers the full shell chord for a ray that misses the planet', () => {
    const seg = viewSegment([-2, 1.01, 0], [1, 0, 0], 1.0157)!;
    const half = Math.sqrt(1.0157 * 1.0157 - 1.01 * 1.01);
    expect(seg[1] - seg[0]).toBeCloseTo(2 * half, 10);
  });
  it('returns null when the ray misses the shell', () => {
    expect(viewSegment([0, 3, 3], [0, 0, -1], 1.0157)).toBeNull();
  });
});
```
Run: `npx vitest run tests/render/atmosphereMath.test.ts`. Expected: FAIL (cannot resolve module).

- [ ] **Step 2: Write `src/render/atmosphereMath.ts`:**

```ts
import { dot, type Vec3 } from '../math';

/**
 * Reference maths for the atmosphere shader (the GLSL in atmosphere.ts mirrors these functions). All positions are in
 * body radii with the planet at the origin and radius 1; directions are unit vectors.
 */

/** Ray/sphere intersection for a sphere at the origin: entry and exit distances along the ray, or null on a miss. */
export function raySphere(origin: Vec3, dir: Vec3, radius: number): [number, number] | null {
  const b = dot(origin, dir);
  const c = dot(origin, origin) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

/** Relative density at altitude h (body radii) with e-folding height `scaleHeight`; 1 at and below the surface. */
export function density(h: number, scaleHeight: number): number {
  return Math.exp(-Math.max(h, 0) / scaleHeight);
}

/** Integral of density along a ray for `dist` (midpoint rule, `steps` samples): optical depth per unit scattering coefficient. */
export function opticalDepth(origin: Vec3, dir: Vec3, dist: number, scaleHeight: number, steps = 64): number {
  const dt = dist / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt;
    const h = Math.hypot(origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t) - 1;
    sum += density(h, scaleHeight) * dt;
  }
  return sum;
}

/**
 * The part of a view ray that lies in the atmosphere: from the shell entry (or the camera, if it is inside the shell)
 * to the shell exit or the planet surface, whichever comes first. Null if the ray misses the shell or the part is empty.
 */
export function viewSegment(camPos: Vec3, dir: Vec3, shellRadius: number): [number, number] | null {
  const shell = raySphere(camPos, dir, shellRadius);
  if (!shell) return null;
  const t0 = Math.max(shell[0], 0);
  let t1 = shell[1];
  const planet = raySphere(camPos, dir, 1);
  if (planet && planet[0] > 0) t1 = Math.min(t1, planet[0]);
  return t1 > t0 ? [t0, t1] : null;
}
```
Run the test again. Expected: PASS.

- [ ] **Step 3: Write `src/render/atmosphere.ts`.** A shell mesh, drawn with front faces from outside and back faces from inside, premultiplied blending. The shell mesh is scaled 2% beyond the shell radius so the polygonal silhouette never clips the analytic edge (the shader clips analytically).

```ts
import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { BodyEffect, BodyRenderState } from './bodyView';
import { ATMOSPHERE_MIN_PX } from './lod';

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vRayDir;
void main() {
  // The camera is the origin, so a vertex's world position is also the view ray direction.
  vRayDir = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

// Mirrors atmosphereMath.ts: raySphere, viewSegment, density, opticalDepth. Units are body radii (planet radius 1).
const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCamPos;     // camera relative to the body centre, in body radii
uniform vec3 uSunDir;     // unit, from the body toward the Sun
uniform vec3 uRayleigh;   // scattering coefficient per body radius, RGB
uniform float uMie;
uniform float uMieG;
uniform float uScaleH;
uniform float uMieScaleH;
uniform float uShell;     // shell radius in body radii
uniform float uIntensity;
uniform vec3 uTint;
varying vec3 vRayDir;

const int VIEW_STEPS = 12;
const int LIGHT_STEPS = 4;

vec2 raySphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1.0, -1.0);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}
bool hitsAhead(vec2 t) { return t.x > 0.0 && t.y > t.x; }
float dens(float h, float H) { return exp(-max(h, 0.0) / H); }

void main() {
  vec3 d = normalize(vRayDir);
  vec2 shell = raySphere(uCamPos, d, uShell);
  if (shell.y < shell.x || shell.y < 0.0) discard;
  vec2 planet = raySphere(uCamPos, d, 1.0);
  float t0 = max(shell.x, 0.0);
  float t1 = shell.y;
  if (hitsAhead(planet)) t1 = min(t1, planet.x);
  if (t1 <= t0) discard;

  float dt = (t1 - t0) / float(VIEW_STEPS);
  float mu = dot(d, uSunDir);
  float g = uMieG;
  float phaseR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float phaseM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu))
               / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  float odR = 0.0;
  float odM = 0.0;
  for (int i = 0; i < VIEW_STEPS; i++) {
    vec3 p = uCamPos + d * (t0 + (float(i) + 0.5) * dt);
    float h = length(p) - 1.0;
    float dR = dens(h, uScaleH) * dt;
    float dM = dens(h, uMieScaleH) * dt;
    odR += dR;
    odM += dM;
    if (hitsAhead(raySphere(p, uSunDir, 1.0))) continue; // this sample is in the planet's shadow
    float lt = raySphere(p, uSunDir, uShell).y;
    float ldt = lt / float(LIGHT_STEPS);
    float lodR = 0.0;
    float lodM = 0.0;
    for (int j = 0; j < LIGHT_STEPS; j++) {
      vec3 q = p + uSunDir * ((float(j) + 0.5) * ldt);
      float hq = length(q) - 1.0;
      lodR += dens(hq, uScaleH) * ldt;
      lodM += dens(hq, uMieScaleH) * ldt;
    }
    vec3 tau = uRayleigh * (odR + lodR) + vec3(uMie * 1.1) * (odM + lodM);
    vec3 att = exp(-tau);
    sumR += att * dR;
    sumM += att * dM;
  }
  vec3 color = (sumR * uRayleigh * phaseR + sumM * uMie * phaseM) * uIntensity * uTint;
  vec3 tauView = uRayleigh * odR + vec3(uMie * 1.1) * odM;
  float alpha = 1.0 - exp(-dot(tauView, vec3(1.0 / 3.0)));
  gl_FragColor = vec4(color, alpha); // premultiplied: the blend is ONE, ONE_MINUS_SRC_ALPHA
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** The mesh is larger than the analytic shell so its polygon edge can never clip the glow; the shader clips exactly. */
const SHELL_OVERSCAN = 1.02;
const shellGeometry = new THREE.SphereGeometry(1, 64, 48);

export class AtmosphereEffect implements BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly shellRadius: number;

  constructor(data: BodyData) {
    const spec = data.atmosphere;
    if (!spec) throw new Error(`${data.id} has no atmosphere`);
    this.shellRadius = 1 + spec.heightFraction;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uRayleigh: { value: new THREE.Vector3(...spec.rayleigh) },
        uMie: { value: spec.mie },
        uMieG: { value: spec.mieG },
        uScaleH: { value: spec.scaleHeightFraction },
        uMieScaleH: { value: spec.mieScaleHeightFraction },
        uShell: { value: this.shellRadius },
        uIntensity: { value: spec.intensity },
        uTint: { value: new THREE.Vector3(...spec.tint) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(shellGeometry, this.material);
    this.mesh.scale.setScalar(data.radiusM * this.shellRadius * SHELL_OVERSCAN);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6; // after the planet and the rings
    this.objects = [this.mesh];
  }

  update(state: BodyRenderState): void {
    const visible = state.effectsEnabled && state.asSphere && state.screenDiameterPx >= ATMOSPHERE_MIN_PX;
    this.mesh.visible = visible;
    if (!visible) return;
    this.mesh.position.set(state.rel[0], state.rel[1], state.rel[2]);
    const u = this.material.uniforms;
    u.uCamPos.value.copy(state.camRelBody);
    u.uSunDir.value.copy(state.sunDir);
    // From outside the shell draw its front faces (haze in front of the disc); from inside, its back faces (sky).
    this.material.side = state.camRelBody.length() < this.shellRadius ? THREE.BackSide : THREE.FrontSide;
  }
}
```

- [ ] **Step 4: Wire it into `BodyView`.** In `src/render/bodyView.ts` add `import { AtmosphereEffect } from './atmosphere';` and replace the line `// [T5] atmosphere effect is created here` with `if (this.data.atmosphere) effects.push(new AtmosphereEffect(this.data));`.

- [ ] **Step 5: Typecheck and test.** Run: `npm run typecheck && npx vitest run`. Expected: clean, all pass.

- [ ] **Step 6: Visual verification and tuning (visible browser).** All shots use a frozen time. Take each with `node scripts/shot.mjs $SP/<name>.png --time 2026-09-20T12:00:00Z <options>` and read the PNG:

| Shot | Options | Acceptance look |
|---|---|---|
| `t5-earth-quarter` | `--view earth,1.5e7,90,10` | A thin bright blue rim on the sunlit limb, fading outward over roughly 2-3% of the radius, warming to orange-red toward the terminator, nearly absent on the night side; the surface is not washed out. |
| `t5-earth-off` | same view plus `--effects off` | The same frame without the rim (proves the effect is the atmosphere). |
| `t5-earth-full` | `--view earth,2e7,0,10` | Sun behind the camera: an even faint blue haze at the limb, the disc otherwise unchanged from phase 1. |
| `t5-venus` | `--view venus,1.5e7,30,10` | A soft, pale yellow-white glow; the disc is a smooth cloud-top image with no surface features. |
| `t5-mars` | `--view mars,1e7,60,10` | A thin butterscotch rim only. |
| `t5-jupiter`, `t5-saturn`, `t5-uranus`, `t5-neptune` | `--view <id>,<about 2R in metres>,60,10` | A soft glow at the limb in the body's colour (pale gold, pale gold, cyan-green, deep blue), visible but not washing out the disc. |
| `t5-mercury` | `--view mercury,8e6,60,10` | No glow (Mercury has no atmosphere). |

Every run must print `console errors: none` (a GLSL compile error would appear here). If the glow is too faint or too strong, adjust the per-body `intensity` (and, if the rim is too thin or thick, `heightFraction`) in `src/catalog/bodies.ts`; keep changes inside the catalog. Do not change the shader structure. If an effect is invisible for every body, check the blending, `renderOrder` and `side` logic first. Also confirm a camera INSIDE the shell works: `--view earth,8e4,0,60` (80 km up, tilted) must render without artefacts. Record the final numbers you settled on in the report.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "Add atmosphere shells with single-scattering shader and tested reference maths" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Rings with shadows

**Files:**
- Create: `src/render/ringMath.ts`, `src/render/ringProfile.ts`, `src/render/rings.ts`
- Modify: `src/render/bodyView.ts` (one import and one line at the `[T6]` marker)
- Test: `tests/render/ringMath.test.ts`, `tests/render/ringProfile.test.ts`

**Interfaces:**
- Consumes: `BodyEffect`, `BodyRenderState` (Task 4); `RingSpec`, `BodyData` (Task 1); `TextureManager` (Task 4); surface shader uniforms `uHasRing, uRingInner, uRingOuter, uRingAlpha` (Task 4); `smoothstep`, `dot`, `Vec3` from `src/math`.
- Produces (`ringMath.ts`, body radii and body-local axes, +Y = pole): `planetShadowFactor(p: Vec3, sunLocal: Vec3, penumbra?: number): number`; `ringCrossingRadius(surface: Vec3, sunLocal: Vec3): number | null`; `ringRadialFraction(r: number, inner: number, outer: number): number | null`; `ringShadowFactor(surface: Vec3, sunLocal: Vec3, inner: number, outer: number, alphaAt: (u: number) => number, strength?: number): number`.
- Produces (`ringProfile.ts`): `RING_PROFILE_SAMPLES = 2048`; `buildRingProfile(spec: RingSpec, samples?: number): Float32Array`.
- Produces (`rings.ts`): `class RingEffect implements BodyEffect { constructor(data: BodyData, surface: THREE.ShaderMaterial, textures: TextureManager) }`; it requires `data.rings` and sets the surface's ring-shadow uniforms.

- [ ] **Step 1: Write the failing ring maths tests** — `tests/render/ringMath.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planetShadowFactor, ringCrossingRadius, ringRadialFraction, ringShadowFactor } from '../../src/render/ringMath';

describe('planetShadowFactor', () => {
  const sun = [0, 0, 1] as const; // the Sun is toward +z
  it('is 0 directly behind the planet, 1 beside it and on the Sun side', () => {
    expect(planetShadowFactor([0, 0, -3], sun)).toBe(0);
    expect(planetShadowFactor([3, 0, -3], sun)).toBe(1);
    expect(planetShadowFactor([0, 0, 3], sun)).toBe(1);
  });
  it('has a soft edge centred on the planet radius', () => {
    expect(planetShadowFactor([1, 0, -3], sun)).toBeCloseTo(0.5, 6);
    expect(planetShadowFactor([1.02, 0, -3], sun)).toBe(1);
    expect(planetShadowFactor([0.98, 0, -3], sun)).toBe(0);
  });
});

describe('ringCrossingRadius', () => {
  it('finds where the ray toward the Sun crosses the equatorial plane', () => {
    expect(ringCrossingRadius([1, 0.5, 0], [0.6, -0.8, 0])!).toBeCloseTo(1.375, 12);
  });
  it('is null when the Sun is above a northern point, or the ray is parallel to the plane', () => {
    expect(ringCrossingRadius([1, 0.5, 0], [0.6, 0.8, 0])).toBeNull();
    expect(ringCrossingRadius([1, 0.5, 0], [1, 0, 0])).toBeNull();
  });
});

describe('ringRadialFraction', () => {
  it('maps radii to 0..1 across the ring and null outside it', () => {
    expect(ringRadialFraction(1.5, 1, 2)).toBeCloseTo(0.5, 12);
    expect(ringRadialFraction(0.9, 1, 2)).toBeNull();
    expect(ringRadialFraction(2.1, 1, 2)).toBeNull();
  });
});

describe('ringShadowFactor', () => {
  it('dims by the ring opacity where the ray crosses the ring, and not elsewhere', () => {
    const full = () => 1;
    expect(ringShadowFactor([1, 0.5, 0], [0.6, -0.8, 0], 1.2, 2, full)).toBeCloseTo(0.1, 12); // crossing at 1.375
    expect(ringShadowFactor([1, 0.5, 0], [0.6, -0.8, 0], 1.5, 2, full)).toBe(1); // crossing is inside the ring's inner edge
    expect(ringShadowFactor([1, 0.5, 0], [0.6, 0.8, 0], 1.2, 2, full)).toBe(1); // Sun above: never crosses
  });
  it('uses the opacity at the crossing radius', () => {
    const alphaAt = (u: number) => u; // more opaque farther out
    const near = ringShadowFactor([1, 0.5, 0], [0.6, -0.8, 0], 1.2, 2, alphaAt, 1);
    expect(near).toBeCloseTo(1 - (1.375 - 1.2) / 0.8, 12);
  });
});
```
and `tests/render/ringProfile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RingSpec } from '../../src/catalog/bodies';
import { RING_PROFILE_SAMPLES, buildRingProfile } from '../../src/render/ringProfile';

const spec = (bands: RingSpec['bands']): RingSpec => ({ innerM: 1_000_000, outerM: 2_000_000, tint: '#888888', bands });

describe('buildRingProfile', () => {
  it('uses 2048 samples by default', () => {
    expect(RING_PROFILE_SAMPLES).toBe(2048);
    expect(buildRingProfile(spec([])).length).toBe(2048);
  });
  it('is all zero with no bands', () => {
    expect(buildRingProfile(spec([]), 50).every((v) => v === 0)).toBe(true);
  });
  it('fills a wide band with its opacity (10 km per sample here)', () => {
    const p = buildRingProfile(spec([{ centerKm: 1500, widthKm: 100, opacity: 0.4 }]), 100);
    for (let i = 45; i <= 54; i++) expect(p[i]).toBeCloseTo(0.4, 6);
    expect(p[44]).toBe(0);
    expect(p[55]).toBe(0);
  });
  it('gives a band narrower than a sample the covered fraction of its opacity', () => {
    const p = buildRingProfile(spec([{ centerKm: 1105, widthKm: 1, opacity: 0.5 }]), 100);
    expect(p[10]).toBeCloseTo(0.05, 6);
    expect(p[9]).toBe(0);
    expect(p[11]).toBe(0);
  });
  it('takes the maximum where bands overlap', () => {
    const p = buildRingProfile(
      spec([{ centerKm: 1500, widthKm: 100, opacity: 0.2 }, { centerKm: 1500, widthKm: 40, opacity: 0.6 }]), 100);
    expect(p[50]).toBeCloseTo(0.6, 6);
    expect(p[46]).toBeCloseTo(0.2, 6);
  });
  it('clips bands at the ring edges without going out of range', () => {
    const p = buildRingProfile(spec([{ centerKm: 1000, widthKm: 40, opacity: 0.3 }]), 100);
    expect(p[0]).toBeCloseTo(0.3, 6);
    expect(p[1]).toBeCloseTo(0.3, 6);
    expect(p[2]).toBeCloseTo(0.0, 6);
    expect(p.length).toBe(100);
  });
});
```
Run: `npx vitest run tests/render/ringMath.test.ts tests/render/ringProfile.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 2: Write `src/render/ringMath.ts`:**

```ts
import { dot, smoothstep, type Vec3 } from '../math';

/**
 * Reference maths for ring lighting (the GLSL in surfaceMaterial.ts and rings.ts mirrors it). Positions are in body radii
 * in the body's local axes: the planet is a unit sphere at the origin, +Y is the pole, the ring plane is y = 0.
 * `sunLocal` is the unit direction toward the Sun in those axes.
 */

/** Fraction of sunlight reaching `p` after the planet's shadow: 0 in the umbra, 1 outside, soft edge of half-width `penumbra`. */
export function planetShadowFactor(p: Vec3, sunLocal: Vec3, penumbra = 0.004): number {
  const b = dot(p, sunLocal);
  if (b >= 0) return 1; // the planet is not between this point and the Sun
  const dmin = Math.sqrt(Math.max(dot(p, p) - b * b, 0)); // closest approach of the sunward ray to the planet's centre
  return smoothstep(1 - penumbra, 1 + penumbra, dmin);
}

/** Radius (body radii) at which the ray from `surface` toward the Sun crosses the ring plane, or null if it never does. */
export function ringCrossingRadius(surface: Vec3, sunLocal: Vec3): number | null {
  if (Math.abs(sunLocal[1]) < 1e-4) return null;
  const s = -surface[1] / sunLocal[1];
  if (s <= 0) return null;
  return Math.hypot(surface[0] + sunLocal[0] * s, surface[2] + sunLocal[2] * s);
}

/** Position across the ring, 0 at the inner edge to 1 at the outer edge, or null outside it. */
export function ringRadialFraction(r: number, inner: number, outer: number): number | null {
  const u = (r - inner) / (outer - inner);
  return u > 0 && u < 1 ? u : null;
}

/** Fraction of sunlight that reaches a planet surface point after passing the ring (1 = unshadowed). */
export function ringShadowFactor(
  surface: Vec3, sunLocal: Vec3, inner: number, outer: number, alphaAt: (u: number) => number, strength = 0.9,
): number {
  const r = ringCrossingRadius(surface, sunLocal);
  if (r === null) return 1;
  const u = ringRadialFraction(r, inner, outer);
  if (u === null) return 1;
  return 1 - strength * alphaAt(u);
}
```

- [ ] **Step 3: Write `src/render/ringProfile.ts`:**

```ts
import type { RingSpec } from '../catalog/bodies';

export const RING_PROFILE_SAMPLES = 2048;

/**
 * Opacity per sample across [innerM, outerM] for a procedural ring. Each sample takes the maximum over bands of
 * (band opacity x the fraction of the sample the band covers), so bands narrower than a sample stay present but fainter.
 */
export function buildRingProfile(spec: RingSpec, samples = RING_PROFILE_SAMPLES): Float32Array {
  const out = new Float32Array(samples);
  const innerKm = spec.innerM / 1000;
  const sampleKm = (spec.outerM - spec.innerM) / 1000 / samples;
  for (const band of spec.bands ?? []) {
    const lo = band.centerKm - band.widthKm / 2;
    const hi = band.centerKm + band.widthKm / 2;
    const first = Math.max(0, Math.floor((lo - innerKm) / sampleKm));
    const last = Math.min(samples - 1, Math.floor((hi - innerKm) / sampleKm));
    for (let i = first; i <= last; i++) {
      const s0 = innerKm + i * sampleKm;
      const overlap = Math.min(hi, s0 + sampleKm) - Math.max(lo, s0);
      if (overlap <= 0) continue;
      const a = band.opacity * Math.min(1, overlap / sampleKm);
      if (a > out[i]!) out[i] = a;
    }
  }
  return out;
}
```
Run: `npx vitest run tests/render/ringMath.test.ts tests/render/ringProfile.test.ts`. Expected: PASS. (If the edge-clipping test fails on the exact sample count, recompute by hand: with 100 samples over 1000 km each sample is 10 km; the band 980-1020 km covers sample 0 fully and sample 1 fully, sample 2 not at all.)

- [ ] **Step 4: Write `src/render/rings.ts`.** The ring is a flat annulus (outer radius 1, scaled to `outerM`) in the body's equatorial plane, drawn double-sided, depth-tested, no depth write. It reads a radial opacity strip: Saturn's PNG through the texture manager, or a generated texture for the others. It also binds that same strip into the planet's surface shader so the ring shadows the planet.

```ts
import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { BodyEffect, BodyRenderState } from './bodyView';
import { buildRingProfile, RING_PROFILE_SAMPLES } from './ringProfile';
import type { TextureManager } from './textureManager';

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vPosL;
void main() {
  vPosL = position; // local position, outer radius 1, in the equatorial plane (y = 0)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

// Mirrors ringMath.ts: planetShadowFactor and the radial fraction.
const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uAlpha;     // radial strip: x runs inner to outer, RGB colour, A opacity
uniform float uInnerFrac;     // inner radius / outer radius
uniform float uOuterOverR;    // outer radius in body radii
uniform vec3 uTint;
uniform float uUseTint;       // 1 for procedural rings (flat tint), 0 to use the strip's own colour
uniform vec3 uSunLocal;       // unit, toward the Sun, body-local axes
uniform vec3 uCamLocal;       // camera relative to the body, body radii, body-local axes
varying vec3 vPosL;

void main() {
  float rNorm = length(vPosL.xz);
  float u = (rNorm - uInnerFrac) / (1.0 - uInnerFrac);
  if (u <= 0.0 || u >= 1.0) discard;
  vec4 tex = texture2D(uAlpha, vec2(u, 0.5));
  float alpha = tex.a;
  if (alpha < 0.003) discard;
  vec3 base = mix(tex.rgb, uTint, uUseTint);

  // The planet's shadow on this ring point (position in body radii).
  vec3 P = vPosL * uOuterOverR;
  float b = dot(P, uSunLocal);
  float dmin = sqrt(max(dot(P, P) - b * b, 0.0));
  float shadow = b < 0.0 ? smoothstep(1.0 - 0.004, 1.0 + 0.004, dmin) : 1.0;

  // Lit on the Sun side; from the far side only light transmitted through the ring shows.
  float lit = 0.35 + 0.65 * smoothstep(0.0, 0.4, abs(uSunLocal.y));
  float sameSide = (uSunLocal.y * uCamLocal.y) > 0.0 ? 1.0 : 0.0;
  float bright = mix(0.6 * (1.0 - alpha) * lit + 0.03, lit, sameSide);

  gl_FragColor = vec4(base * bright * shadow, alpha);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** A generated 2048 x 1 RGBA strip for a procedural ring: white colour, opacity from the band list. */
function createProfileTexture(data: BodyData): THREE.DataTexture {
  const ring = data.rings!;
  const profile = buildRingProfile(ring, RING_PROFILE_SAMPLES);
  const bytes = new Uint8Array(RING_PROFILE_SAMPLES * 4);
  for (let i = 0; i < RING_PROFILE_SAMPLES; i++) {
    bytes[4 * i] = 255;
    bytes[4 * i + 1] = 255;
    bytes[4 * i + 2] = 255;
    bytes[4 * i + 3] = Math.round(Math.min(1, profile[i]!) * 255);
  }
  const texture = new THREE.DataTexture(bytes, RING_PROFILE_SAMPLES, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export class RingEffect implements BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly procedural: THREE.DataTexture | null;

  constructor(
    private readonly data: BodyData,
    private readonly surface: THREE.ShaderMaterial,
    private readonly textures: TextureManager,
  ) {
    const ring = data.rings;
    if (!ring) throw new Error(`${data.id} has no rings`);
    const innerFrac = ring.innerM / ring.outerM;
    this.procedural = ring.alphaMap ? null : createProfileTexture(data);

    const geometry = new THREE.RingGeometry(innerFrac, 1, 256, 1);
    geometry.rotateX(-Math.PI / 2); // RingGeometry faces +Z; the ring must lie in the local equatorial plane (normal +Y)
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uAlpha: { value: this.procedural ?? new THREE.Texture() },
        uInnerFrac: { value: innerFrac },
        uOuterOverR: { value: ring.outerM / data.radiusM },
        uTint: { value: new THREE.Color(ring.tint) },
        uUseTint: { value: ring.alphaMap ? 0 : 1 },
        uSunLocal: { value: new THREE.Vector3(0, 1, 0) },
        uCamLocal: { value: new THREE.Vector3(0, 1, 0) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.scale.setScalar(ring.outerM);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5; // after the planet, before the atmosphere shell
    this.objects = [this.mesh];
  }

  update(state: BodyRenderState): void {
    const ring = this.data.rings!;
    const alphaTexture = this.procedural
      ?? this.textures.get(this.data.id, 'ring', { lo: ring.alphaMap! }, false);
    const ready = alphaTexture !== null;
    const active = state.effectsEnabled && state.asSphere && ready;
    const su = this.surface.uniforms;
    su.uHasRing.value = active ? 1 : 0;
    this.mesh.visible = active;
    if (!active || !alphaTexture) return;

    su.uRingInner.value = ring.innerM / this.data.radiusM;
    su.uRingOuter.value = ring.outerM / this.data.radiusM;
    su.uRingAlpha.value = alphaTexture;

    const u = this.material.uniforms;
    u.uAlpha.value = alphaTexture;
    u.uSunLocal.value.copy(state.sunLocal);
    u.uCamLocal.value.copy(state.camLocal);
    this.mesh.position.set(state.rel[0], state.rel[1], state.rel[2]);
    this.mesh.quaternion.copy(state.quaternion);
  }
}
```

- [ ] **Step 5: Wire it into `BodyView`.** In `src/render/bodyView.ts` add `import { RingEffect } from './rings';` and replace the line `// [T6] ring effect is created here` with `if (this.data.rings) effects.push(new RingEffect(this.data, this.surface, this.textures));`.

- [ ] **Step 6: Typecheck and test.** Run: `npm run typecheck && npx vitest run`. Expected: clean, all pass.

- [ ] **Step 7: Visual verification (visible browser).** Shots with `node scripts/shot.mjs $SP/<name>.png <options>`; read each PNG. Saturn's ring-plane geometry depends on the date: its northern summer solstice (Sun highest above the ring plane) was 2017-05-24, so use that date for shadow shots, and 2026-09-20 for the present-day look.

| Shot | Options | Acceptance look |
|---|---|---|
| `t6-saturn-solstice` | `--time 2017-05-24T12:00:00Z --view saturn,4.5e8,60,20` | The whole ring system: bright B ring, a dark gap (the Cassini Division) between B and A at about 71% of the way out, a thinner dark gap (Encke) near the outer edge, the C ring fainter inside. The ring casts a dark band across the planet's southern hemisphere, and the planet's shadow falls across the ring on the far side. |
| `t6-saturn-off` | same plus `--effects off` | No ring and no ring shadow on the planet (the A/B proof). |
| `t6-saturn-now` | `--time 2026-09-20T12:00:00Z --view saturn,4.5e8,60,20` | Nearly edge-on rings (Saturn is near equinox), a thin bright line, thin shadow. No artefacts. |
| `t6-saturn-dark-side` | `--time 2017-05-24T12:00:00Z --view saturn,4.5e8,60,-30` | Viewed from below the ring plane: the rings are dimmer where opaque and show light through the thin parts (transmitted light). |
| `t6-saturn-close` | `--time 2017-05-24T12:00:00Z --view saturn,1.5e8,60,15` | Ring detail at close range, the ring passing in front of and behind the planet with correct occlusion. |
| `t6-jupiter-ring` | `--view jupiter,3.2e8,60,25` | A faint, low-contrast ring disc around Jupiter (visible but subtle; if invisible, opacity/tint may be tuned). |
| `t6-uranus-rings` | `--view uranus,2.2e7,60,30` | Thin faint ellipses of the narrow rings, the epsilon ring brightest. |
| `t6-neptune-rings` | `--view neptune,5e7,60,30` | Very faint rings (may be barely visible: that is realistic). |

Every run must print `console errors: none`. Verify by eye the Cassini Division sits between the bright B ring and the mid-bright A ring; the alignment is by construction (the strip spans inner 66,900 km to outer 140,220 km), so a misaligned look means the radii in the catalog were changed. Tune only the lighting constants in `FRAG` (`lit`, the transmitted-light term) and, for faint rings, the catalog `tint`/`opacity` if a ring is invisible. Record any changes in the report.

- [ ] **Step 8: Commit.**

```bash
git add -A
git commit -m "Add Saturn's rings with mutual shadows and procedural faint rings for the other giants" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Earth extras (night lights, clouds, ocean glint)

**Files:**
- Create: `src/render/earthMath.ts`, `src/render/clouds.ts`
- Modify: `src/render/surfaceMaterial.ts` (replace the `[T7]` marker in the fragment shader), `src/render/bodyView.ts` (the two `[T7]` markers plus one import)
- Test: `tests/render/earthMath.test.ts`

**Interfaces:**
- Consumes: `BodyEffect`, `BodyRenderState` (Task 4); surface uniforms `uNight, uHasNight, uClouds, uHasClouds, uGlint, uShine` (Task 4, already declared); `TextureManager` (Task 4); `BodyData.maps.night/clouds`, `oceanGlint`, `cloudShellFraction` (Task 1); `ATMOSPHERE_MIN_PX` (Task 3); `smoothstep` (phase 1 math).
- Produces (`earthMath.ts`): `nightFactor(ndl: number): number`; `waterMask(r: number, g: number, b: number): number` (linear-light RGB 0..1); `glintIntensity(ndh: number, shininess: number, ndl: number, strength: number, water: number, cloud: number): number`.
- Produces (`clouds.ts`): `class CloudEffect implements BodyEffect { constructor(data: BodyData, textures: TextureManager) }`; it requires `data.maps.clouds` and `data.cloudShellFraction`.

- [ ] **Step 1: Write the failing tests** — `tests/render/earthMath.test.ts`. They pin the reference the GLSL mirrors (the shader thresholds are copied from these functions):

```ts
import { describe, expect, it } from 'vitest';
import { glintIntensity, nightFactor, waterMask } from '../../src/render/earthMath';

describe('nightFactor', () => {
  it('is 1 well into the night, 0 in full daylight, and eases across the terminator', () => {
    expect(nightFactor(-0.5)).toBe(1);
    expect(nightFactor(0.5)).toBe(0);
    expect(nightFactor(0.02)).toBeGreaterThan(0.3);
    expect(nightFactor(0.02)).toBeLessThan(0.7);
  });
  it('never increases as the Sun rises', () => {
    let previous = 1;
    for (let ndl = -0.3; ndl <= 0.3; ndl += 0.02) {
      const f = nightFactor(ndl);
      expect(f).toBeLessThanOrEqual(previous + 1e-12);
      previous = f;
    }
  });
});

describe('waterMask', () => {
  it('is high for deep and shallow ocean (linear-light colours)', () => {
    expect(waterMask(0.003, 0.021, 0.102)).toBeGreaterThan(0.9); // deep blue ocean
    expect(waterMask(0.013, 0.1, 0.31)).toBeGreaterThan(0.9); // lighter shallow water
  });
  it('is zero for land, vegetation, ice and cloud', () => {
    expect(waterMask(0.5, 0.35, 0.2)).toBe(0); // desert
    expect(waterMask(0.03, 0.08, 0.02)).toBe(0); // vegetation
    expect(waterMask(0.8, 0.8, 0.85)).toBeLessThan(0.05); // ice or cloud: blue-ish but bright
  });
});

describe('glintIntensity', () => {
  it('peaks when the surface normal bisects the Sun and camera, and falls off away from it', () => {
    const peak = glintIntensity(1, 60, 0.8, 0.8, 1, 0);
    const off = glintIntensity(0.95, 60, 0.8, 0.8, 1, 0);
    expect(peak).toBeCloseTo(0.8, 12);
    expect(off).toBeLessThan(peak * 0.1);
  });
  it('needs the Sun above the horizon, water, and no cloud', () => {
    expect(glintIntensity(1, 60, -0.1, 0.8, 1, 0)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 0, 0)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 1, 1)).toBe(0);
    expect(glintIntensity(1, 60, 0.8, 0.8, 1, 0.5)).toBeCloseTo(0.4, 12);
  });
});
```
Run: `npx vitest run tests/render/earthMath.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 2: Write `src/render/earthMath.ts`:**

```ts
import { smoothstep } from '../math';

/**
 * Reference maths for Earth's extra shading (the GLSL in surfaceMaterial.ts mirrors these functions and thresholds).
 * Colours are linear-light RGB in 0..1.
 */

/** 1 on the night side, 0 by day, easing across a soft terminator: `ndl` is the cosine of the Sun's angle to the surface normal. */
export function nightFactor(ndl: number): number {
  return 1 - smoothstep(-0.08, 0.12, ndl);
}

/** Ocean mask derived from the day map: strongly blue and not bright (so ice and cloud are excluded). */
export function waterMask(r: number, g: number, b: number): number {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return smoothstep(0.01, 0.06, b - Math.max(r, g)) * (1 - smoothstep(0.5, 0.8, luminance));
}

/** Blinn-Phong sun glint on water: `ndh` is N.H (H the Sun-camera half vector), `ndl` is N.L, `cloud` is cloud cover 0..1. */
export function glintIntensity(
  ndh: number, shininess: number, ndl: number, strength: number, water: number, cloud: number,
): number {
  if (ndl <= 0) return 0;
  return strength * Math.pow(Math.max(ndh, 0), shininess) * water * (1 - cloud);
}
```
Run the test again. Expected: PASS.

- [ ] **Step 3: Add the night and glint shading to the surface shader.** In `src/render/surfaceMaterial.ts`, inside `FRAG`, replace the single line `    // [T7] night lights and ocean glint are added here` with:

```glsl
    // Night lights blend in across a soft terminator and are dimmed by cloud cover (mirrors earthMath.nightFactor).
    float cloudCover = uHasClouds > 0.5 ? texture2D(uClouds, vUv).r : 0.0;
    if (uHasNight > 0.5) {
      float night = 1.0 - smoothstep(-0.08, 0.12, ndl);
      lit += texture2D(uNight, vUv).rgb * night * (1.0 - 0.85 * cloudCover);
    }
    // Ocean glint: Blinn-Phong on water, mask derived from the day map, suppressed by cloud (mirrors earthMath.waterMask/glintIntensity).
    if (uGlint > 0.0 && ndl > 0.0) {
      float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
      float water = smoothstep(0.01, 0.06, albedo.b - max(albedo.r, albedo.g)) * (1.0 - smoothstep(0.5, 0.8, lum));
      vec3 V = normalize(-vPosW); // the camera is the origin of render space
      vec3 H = normalize(uSunDir + V);
      float spec = pow(max(dot(N, H), 0.0), uShine);
      lit += vec3(uGlint * spec * water * (1.0 - cloudCover));
    }
```

- [ ] **Step 4: Bind the maps and glint in `BodyView.updateSurface`.** In `src/render/bodyView.ts` replace the line `    // [T7] night lights and ocean glint uniforms are set here` with:

```ts
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
```

- [ ] **Step 5: Write `src/render/clouds.ts`.** A second sphere just above the surface whose opacity comes from the cloud map; it is lit with the same Lambert model and hidden when the body is small.

```ts
import * as THREE from 'three';
import type { BodyData } from '../catalog/bodies';
import type { BodyEffect, BodyRenderState } from './bodyView';
import { ATMOSPHERE_MIN_PX } from './lod';
import type { TextureManager } from './textureManager';

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uClouds; // coverage in the red channel (linear)
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  float cover = texture2D(uClouds, vUv).r;
  float ndl = max(dot(normalize(vNormalW), uSunDir), 0.0);
  gl_FragColor = vec4(vec3(ndl + 0.04 / PI), cover); // white cloud, same Lambert model as the surface
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** 256 segments keep the shell's sag under about 0.5 km, small next to its 9.6 km height. */
const cloudGeometry = new THREE.SphereGeometry(1, 256, 192);

export class CloudEffect implements BodyEffect {
  readonly objects: readonly THREE.Object3D[];
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    private readonly data: BodyData,
    private readonly textures: TextureManager,
  ) {
    if (!data.maps.clouds || data.cloudShellFraction === undefined) throw new Error(`${data.id} has no cloud layer`);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uClouds: { value: new THREE.Texture() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(cloudGeometry, this.material);
    this.mesh.scale.setScalar(data.radiusM * (1 + data.cloudShellFraction));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4; // after the surface, before the rings and the atmosphere
    this.objects = [this.mesh];
  }

  update(state: BodyRenderState): void {
    const texture = this.textures.get(this.data.id, 'clouds', this.data.maps.clouds!, state.hiRes);
    const visible = state.effectsEnabled && state.asSphere && texture !== null && state.screenDiameterPx >= ATMOSPHERE_MIN_PX;
    this.mesh.visible = visible;
    if (!visible || !texture) return;
    this.mesh.position.set(state.rel[0], state.rel[1], state.rel[2]);
    this.mesh.quaternion.copy(state.quaternion);
    this.material.uniforms.uClouds.value = texture;
    this.material.uniforms.uSunDir.value.copy(state.sunDir);
  }
}
```

- [ ] **Step 6: Wire it into `BodyView`.** In `src/render/bodyView.ts` add `import { CloudEffect } from './clouds';` and replace the line `// [T7] cloud effect is created here` with `if (this.data.maps.clouds && this.data.cloudShellFraction !== undefined) effects.push(new CloudEffect(this.data, this.textures));`.

- [ ] **Step 7: Typecheck and test.** Run: `npm run typecheck && npx vitest run`. Expected: clean, all pass.

- [ ] **Step 8: Visual verification and tuning (visible browser).** Use frozen times. At 12:00 UTC on 2026-09-20 the sub-solar point is near longitude 0, latitude 0 (equinox); at 22:00 UTC the night side is centred over Africa, Europe and the Middle East.

| Shot | Options | Acceptance look |
|---|---|---|
| `t7-night` | `--time 2026-09-20T22:00:00Z --view earth,2e7,180,10` | The night side with orange-yellow city lights clustered over Europe, the Middle East and India; dark oceans; faint or no clouds visible on the dark side. |
| `t7-terminator` | `--time 2026-09-20T12:00:00Z --view earth,2e7,90,10` | Quarter phase: lit half with clouds and the atmosphere rim, a soft terminator, and city lights fading in on the dark half's edge. |
| `t7-clouds` | `--time 2026-09-20T12:00:00Z --view earth,1.5e7,0,10` | White cloud swirls above the day map; oceans and continents still readable beneath. |
| `t7-clouds-off` | same plus `--effects off` | The day map alone with no clouds, no lights, no glint, no rim (the A/B proof; it must match phase 1's look). |
| `t7-glint` | `--time 2026-09-20T12:00:00Z --view earth,1.2e7,0,10` | A bright sun-glint patch on the ocean near the disc centre, broken up by clouds. |
| `t7-hires` | `--time 2026-09-20T12:00:00Z --view earth,1e6,0,30` (use `SHOT_HOLD_MS=6000` so the 8K maps arrive) | Sharp 8K detail: coastlines, cloud structure; no visible faceting at the horizon. |
| `t7-lowest` | `--time 2026-09-20T12:00:00Z --view earth,1.27e4,0,0` | The camera at its 12.7 km minimum, looking down through and above the cloud layer, no flicker, no clipping. |

Every run must print `console errors: none`. Tune only what the shots show is wrong: the night-lights strength (multiply the sampled colour in the shader), the glint `strength` and `shininess` in the catalog, and the water mask thresholds if land is glinting or ocean is not (if you change the thresholds in the GLSL, change `earthMath.ts` and its tests to match). Record final values in the report.

- [ ] **Step 9: Commit.**

```bash
git add -A
git commit -m "Add Earth night lights, cloud shell and ocean glint" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Smoke test, README and final verification

**Files:**
- Create: `src/render/pixelStats.ts`
- Modify: `src/render/solarScene.ts` (add `pixelStats()`), `src/main.ts` (hook), `scripts/smoke.mjs`, `README.md`
- Test: `tests/render/pixelStats.test.ts`

**Interfaces:**
- Consumes: everything above; the phase 1 smoke script and `scripts/lib/browser.mjs`.
- Produces (`pixelStats.ts`): `classifyPixel(r: number, g: number, b: number): { lit: boolean; warm: boolean; blue: boolean }`.
- Produces (`SolarScene`): `pixelStats(): { lit: number; warm: number; blue: number }` (re-renders once, reads the whole frame).
- Produces (`window.__solar`): `pixelStats(): { lit: number; warm: number; blue: number }`, `fps(ms: number): Promise<number>`.

- [ ] **Step 1: Write the failing classification test** — `tests/render/pixelStats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyPixel } from '../../src/render/pixelStats';

describe('classifyPixel', () => {
  it('treats black as unlit and anything brighter than a faint grey as lit', () => {
    expect(classifyPixel(0, 0, 0).lit).toBe(false);
    expect(classifyPixel(5, 5, 5).lit).toBe(false);
    expect(classifyPixel(20, 20, 20).lit).toBe(true);
  });
  it('flags city-light orange as warm and neutral grey or blue as not warm', () => {
    expect(classifyPixel(200, 150, 60).warm).toBe(true);
    expect(classifyPixel(90, 90, 90).warm).toBe(false);
    expect(classifyPixel(40, 80, 200).warm).toBe(false);
  });
  it('flags atmosphere and ocean blue as blue', () => {
    expect(classifyPixel(40, 90, 200).blue).toBe(true);
    expect(classifyPixel(200, 150, 60).blue).toBe(false);
    expect(classifyPixel(100, 100, 100).blue).toBe(false);
  });
});
```
Run: `npx vitest run tests/render/pixelStats.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 2: Write `src/render/pixelStats.ts`:**

```ts
/** Coarse colour classes for the smoke test's pixel counts (8-bit sRGB values as read from the frame). */
export function classifyPixel(r: number, g: number, b: number): { lit: boolean; warm: boolean; blue: boolean } {
  return {
    lit: r + g + b > 30,
    warm: r > 70 && r > b + 25, // city lights are orange-yellow; clouds and rock are neutral
    blue: b > 80 && b > r * 1.4,
  };
}
```
Run the test again. Expected: PASS.

- [ ] **Step 3: Add `pixelStats()` to `SolarScene`.** Add `import { classifyPixel } from './pixelStats';` and, after `centreLitPixels()`:

```ts
  /** Renders once more and counts lit, warm and blue pixels over the whole frame (for the smoke test). */
  pixelStats(): { lit: number; warm: number; blue: number } {
    const counts = { lit: 0, warm: 0, blue: 0 };
    if (!this.lastInput) return counts;
    this.render(this.lastInput);
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buffer = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    for (let i = 0; i < buffer.length; i += 4) {
      const c = classifyPixel(buffer[i]!, buffer[i + 1]!, buffer[i + 2]!);
      if (c.lit) counts.lit++;
      if (c.warm) counts.warm++;
      if (c.blue) counts.blue++;
    }
    return counts;
  }
```

- [ ] **Step 4: Extend the hook in `src/main.ts`.** Add to the `__solar` type: `pixelStats(): { lit: number; warm: number; blue: number }; fps(ms: number): Promise<number>;`. Add to the object:

```ts
  pixelStats: () => scene.pixelStats(),
  fps: async (ms) => {
    const startFrames = frames;
    const startTime = performance.now();
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
    return (frames - startFrames) / ((performance.now() - startTime) / 1000);
  },
```

- [ ] **Step 5: Extend `scripts/smoke.mjs`.** Keep all phase 1 checks, but change the minimum-altitude threshold to the new floor: `check(near < 2e4, ...)` (the floor is 12.7 km at Earth). Insert the following BEFORE the final `check(errors.length === 0, ...)` line (the existing `flyTo('neptune')` block stays before it). `MEASURED` thresholds below are starting guesses: after the first passing run, print the measured on/off counts (the script already logs them in each PASS line), then set every threshold to at most HALF of the measured difference so it still catches regressions but tolerates tuning, and record the measured numbers in the report.

```js
  // ---- phase 2a: effects, A/B against effects switched off (frozen time, visible window) ----
  const settle = () => page.waitForTimeout(900);
  const stats = () => page.evaluate(() => window.__solar.pixelStats());
  const view = async (time, id, altitudeM, yawOffsetDeg, pitchDeg) => {
    await page.evaluate(([t, i, a, y, p]) => { window.__solar.setTime(t); window.__solar.setView(i, a, y, p); },
      [time, id, altitudeM, yawOffsetDeg, pitchDeg]);
    await settle();
  };
  const ab = async (time, id, altitudeM, yaw, pitch) => {
    await view(time, id, altitudeM, yaw, pitch);
    await page.evaluate(() => window.__solar.setEffects(true));
    await settle();
    const on = await stats();
    await page.evaluate(() => window.__solar.setEffects(false));
    await settle();
    const off = await stats();
    await page.evaluate(() => window.__solar.setEffects(true));
    return { on, off };
  };

  const atmo = await ab('2026-09-20T12:00:00Z', 'earth', 1.5e7, 90, 10);
  check(atmo.on.blue - atmo.off.blue >= 200,
    `Earth's atmosphere adds a blue limb (blue pixels ${atmo.off.blue} -> ${atmo.on.blue})`);

  const night = await ab('2026-09-20T22:00:00Z', 'earth', 2e7, 180, 10);
  check(night.on.warm - night.off.warm >= 100,
    `Earth's night side shows city lights (warm pixels ${night.off.warm} -> ${night.on.warm})`);

  const rings = await ab('2017-05-24T12:00:00Z', 'saturn', 4.5e8, 60, 20);
  check(rings.on.lit - rings.off.lit >= 3000,
    `Saturn's rings add pixels (lit pixels ${rings.off.lit} -> ${rings.on.lit})`);

  // 8K maps: Earth gets them up close, and never more than two bodies hold them at once.
  await view('2026-09-20T12:00:00Z', 'earth', 1e6, 0, 30);
  let earthHi = false;
  for (let i = 0; i < 30 && !earthHi; i++) {
    earthHi = (await page.evaluate(() => window.__solar.hiResBodies())).includes('earth');
    if (!earthHi) await page.waitForTimeout(200);
  }
  check(earthHi, 'Earth holds its 8K maps at close range');

  let maxHi = 0;
  let maxTextures = 0;
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun']) {
    await view('2026-09-20T12:00:00Z', id, 3e6 + (id === 'sun' ? 1e9 : 0), 0, 20);
    maxHi = Math.max(maxHi, (await page.evaluate(() => window.__solar.hiResBodies())).length);
    maxTextures = Math.max(maxTextures, await page.evaluate(() => window.__solar.textureCount()));
  }
  check(maxHi <= 2, `at most two bodies held 8K maps at once (max ${maxHi})`);
  check(maxTextures <= 45, `GPU texture count stayed bounded (max ${maxTextures})`);

  // The 0.2% floor: the camera at its minimum altitude over Earth still renders and keeps a usable frame rate.
  await view('2026-09-20T12:00:00Z', 'earth', 1, 0, 20);
  const floorAlt = await page.evaluate(() => window.__solar.altitudeM());
  check(floorAlt < 2e4, `minimum altitude is 0.2% of Earth's radius (${floorAlt.toFixed(0)} m)`);
  check((await page.evaluate(() => window.__solar.litPixels())) > 500, 'Earth still renders at the minimum altitude');
  const fps = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at Earth's minimum altitude: ${fps.toFixed(1)} fps`);
  check(fps >= 15, `frame rate at close range is usable (${fps.toFixed(1)} fps; target 30 or better)`);
```
Do not add any headless option. `altitudeM()` reports the last frame's altitude, so wait a frame after `setView` (the `settle()` inside `view` does).

- [ ] **Step 6: Update `README.md`.** In the feature description mention: 8K surface maps (loaded only for nearby bodies), atmospheres, Saturn's rings with shadows and faint rings for the other giants, Earth's night lights, clouds and ocean glint, and that you can descend to 0.2% of a planet's radius (about 13 km at Earth). Update the `npm run textures` line to say it downloads the full 2K/8K set (give the actual total MB printed by the script) and the note about the GPU memory budget (`HI_RES_BUDGET`, up to two bodies at 8K). Replace any "2% of the radius" wording with 0.2%. Keep the credits section and add that Uranus and Neptune are 2K because no 8K maps exist. Keep the scale-explanation paragraph (and its accurate range: now about 1.27e4 m to 1.2e13 m).

- [ ] **Step 7: Run everything.** Run: `npm test && npm run typecheck && npm run build`. Expected: all tests pass (report the count), typecheck clean, build succeeds.

- [ ] **Step 8: Run the smoke test in a visible window.** Run: `npm run smoke`. Expected: every line `PASS`, ending `SMOKE PASSED`. On a failure, diagnose with `scripts/shot.mjs` screenshots and fix the owning module; never loosen a threshold without understanding why. After the first fully passing run, apply the "at most half the measured difference" rule from Step 5 to the four A/B thresholds and re-run once.

- [ ] **Step 9: Definition-of-done evidence.** Put actual command output or a screenshot path for each item in the report:
1. `npm run textures` output ends with the total and every listed file is present (`ls public/textures | wc -l` and the count from the Task 1 test's list).
2. The smoke run's minimum-altitude and Neptune checks, plus `t7-lowest.png` and `t7-hires.png` (no faceted horizon).
3. The smoke run's `at most two bodies held 8K maps` line.
4. `t5-*.png`: atmospheres on Earth, Venus, Mars and the four giants; `t5-mercury.png` shows none.
5. `t6-saturn-solstice.png` (Cassini Division, mutual shadows) and `t6-jupiter-ring.png`, `t6-uranus-rings.png`, `t6-neptune-rings.png`.
6. `t7-night.png`, `t7-clouds.png`, `t7-glint.png`.
7. The Task 4 mean-difference numbers for Mercury and Jupiter versus the phase 1 baselines.
8. Test and smoke output, plus the measured frame rate at the minimum altitude (report the number even if it is above the target).

- [ ] **Step 10: Commit.**

```bash
git add -A
git commit -m "Extend smoke test with effect A/B checks, texture budget and frame rate; update README" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review (done while writing this plan)

**Spec coverage:** catalog fields (maps, atmosphere, rings, glint, cloud shell) and download list: Tasks 1-2. Mesh detail, texture tiers, hysteresis and the budget of two: Tasks 3-4. Closer camera (0.2%) and near-plane behaviour: Task 1 (constant) plus verification in Tasks 7 and 8. Atmospheres for every planet that has one, hidden below 20 px, inside/outside shell handling, precision via a float64 camera offset: Task 5. Saturn rings from the real alpha strip with radii checked against the texture's Cassini profile, procedural faint rings from the band lists, planet-on-ring and ring-on-planet shadows, draw order: Task 6. Earth night lights, cloud shell below the minimum altitude, ocean glint from a derived mask, fallbacks: Task 7. GPU-limit fallback (hi tier disabled below 8192): Task 4 (`SolarScene` constructor). Extended visible smoke test (night lights, limb, rings, texture bound, frame rate), README and definition of done: Task 8. Error handling: missing 8K stays 2K (Task 4, `TextureManager`); missing night/cloud maps turn the feature off (Tasks 4 and 7); shader compile errors surface as console errors and fail the smoke test (Tasks 4-8).

**Deviations from the spec, all recorded:** (1) the hi-tier fallback is "disabled" instead of "capped at 4K" because no 4K files exist for most maps (already corrected in the spec); (2) Saturn's ring inner radius is 66,900 km, not 74,500 km (corrected in the spec, verified against the real texture); (3) the download list is derived from the catalog.

**Placeholders:** none. Shader constants and atmosphere numbers are explicit initial values with stated acceptance looks and stated tuning rules; every code step has full code.

**Type consistency:** `MapSlot`, `AtmosphereSpec`, `RingSpec`, `RingBand`, `OceanGlint` (Task 1) are used by name in Tasks 4-7; `BodyEffect`, `BodyRenderState`, `BodyUpdateContext`, `TextureManager.get(bodyId, kind, slot, wantHi)` (Task 4) match their uses in Tasks 5-7; the surface uniform names in Task 4 match the writes in Tasks 4, 6 and 7; the `[T5]`, `[T6]`, `[T7]` marker comments appear exactly once each in Task 4's `bodyView.ts` (two `[T7]` markers: one in `createEffects`, one in `updateSurface`, and one in the surface shader).

**Known risks to watch during execution:** (a) GLSL only fails at runtime in the browser, so every shader task has a visible-browser step that treats console errors as failures; (b) atmosphere and ring appearance are tuned by eye against stated acceptance looks; (c) an 8K texture decode can hitch a frame when it first arrives (accepted; a worker-decoded loader is a later optimisation); (d) worst-case GPU memory with Earth at 8K plus one more body is a little over 700 MB, controlled by `HI_RES_BUDGET`.
