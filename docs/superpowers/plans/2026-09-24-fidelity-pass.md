# Fidelity Pass and Night Sky (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real night sky (48 labelled notable stars and 5,022 unlabelled naked-eye stars in their real directions), soften the planetary terminator, add real body-on-body shadows (eclipses), investigate the Earth minimum-altitude cloud wash, and make a documented, evidence-driven attempt at the moon orbital-phase bug.

**Architecture:** The sky stars are one `THREE.Points` draw call with a small custom shader (per-point size, opacity and colour), placed at a fixed radius just inside the far plane in the camera-centred render space, so they never move with the camera (direction is real, distance is not; disclosed). Directions reuse phase 4's RA/Dec-to-ecliptic rotation. Notable-star labels are a separate DOM layer that fades in with camera altitude. The terminator fix is a C1-continuous soft-Lambert function mirrored into GLSL. Body shadows generalise the ring/planet-shadow ray maths: per receiver, up to four candidate occluders from its family (parent, siblings, children) are chosen on the CPU in float64 and passed as uniforms; the surface shader multiplies the diffuse term by the product of their shadow factors. The moon fix and the cloud-wash question are investigation tasks with explicit hypotheses, not pre-written fixes.

**Tech Stack:** TypeScript 7, Vite 8, Three.js 0.186, astronomy-engine 2.1.19, Vitest 5, playwright-core 1.63, GLSL. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-24-fidelity-pass-design.md` (binding; Status: design approved). Data: `docs/data/notable-stars-hyg.csv`, `docs/data/background-starfield-hyg.csv`, `docs/data/README.md`.

## Global Constraints

- Branch `phase-5`, created from `master`. Never merge to `master`, never push, never add remotes, no force operations, no deleting branches.
- Commit messages use two `-m` arguments; the second is exactly `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Strict TypeScript, no `any`, no `innerHTML` with dynamic strings. The repo has `noUncheckedIndexedAccess` behaviour (existing code uses `!` after indexing); follow it.
- No new dependencies; do not run `npm install`.
- **Browsers:** only through `scripts/shot.mjs` and `scripts/smoke.mjs` (`npm run smoke`), which launch a HEADED, VISIBLE Chromium window. NEVER headless; never add a headless option or fallback. A display exists (`DISPLAY=:0`). Screenshots go in the scratch dir `/tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad/` (called `$SCR` below); view them with the Read tool and describe what you see. Any console error is a failure to fix.
- **Custom shader rules from earlier phases still apply:** every custom shader includes `<logdepthbuf_pars_*>` / `<logdepthbuf_*>` and ends with `<colorspace_fragment>`; sample textures before any `discard` or divergent branch; every constant shared by TS and GLSL is exported from a TS module and interpolated into the GLSL with `glslFloat`, with a divergence test in `tests/render/shaderConstants.test.ts`.
- Float64 positions are subtracted before any float32 cast (camera-relative rendering).
- Star data is transcribed from `docs/data/*.csv` and tested against them exactly. Do not fetch star data from anywhere.
- Data honesty: the sky stars are shown in their real direction but NOT their real distance, and are not reachable by the camera; the UI tooltip and README say so.
- Verify every numeric test expectation by computing it (`node -e`, astronomy-engine is in `node_modules`). Expectations in this plan were computed on 2026-09-24; if one fails, recompute before touching the code.
- Scratch or diagnostic files must be deleted before the task's commit (`git status` must show nothing stray). Earlier phases committed scratch tests by mistake.

## Review Focus

Failure modes the spec implies but no obvious test exercises; each is pinned by a test in the named task.

1. A colour index that is missing or non-finite must not produce NaN colours (black or invisible stars): Task 1 (`colorIndexToRGB(NaN)` falls back to 0.6).
2. Sky-star labels must vanish when the Night sky toggle is off, and must not show for stars behind the camera or off screen: Task 9 (`visibleSkyLabels`).
3. The sky radius must stay inside the far plane so stars are never clipped at the maximum camera distance: Task 4.
4. A shadowed body must not go pure black (the 0.04/pi ambient stays), and a body must never shadow itself or be shadowed by the Sun or small bodies: Tasks 6 and 7 (`shadowCasterIds`).
5. A body with no possible occluders, and a receiver whose sun ray misses every candidate, must render exactly as before (uOccCount 0, factor 1): Tasks 6 and 7.
6. The three notable stars that duplicate phase-4 nearby stars (Sirius, Rigil Kentaurus, Toliman) must not get a second label on top of the nearby star's label: Tasks 4 and 9.

---

## Rulings made while planning (record each in the final report)

- Ruling: the earlier plan commit `a08ed48` (written by a cheap model, wrong trailer, stubbed tasks 6-11) was discarded and this plan written from scratch - cost if wrong: none (it was dangling, on no branch).
- Ruling: sky stars sit at `SKY_RADIUS_M = 0.9 * FAR_M` in camera-centred render space (they do not move with the camera) - cost if wrong: none visible; a star can never be flown to.
- Ruling: terminator uses a C1 soft-Lambert (quadratic ramp over +-0.1 of N.L) rather than a linear wrap term, so lit areas away from the terminator are unchanged - cost if wrong: a slightly different terminator look.
- Ruling: body shadows consider only a receiver's family (parent, siblings, children), at most 4 occluders chosen by closeness of the sun ray, and are applied to the surface shader only (not cloud shells, rings or atmospheres) - cost if wrong: a moon's shadow does not darken Earth's cloud layer, Saturn's rings, or a hazy atmosphere.
- Ruling: notable-star labels fade in on a log-altitude ramp from 1e9 m (0) to 1e11 m (1), and the labels of the three stars that duplicate phase-4 nearby stars are suppressed - cost if wrong: labels appear later or earlier than a reviewer prefers.
- Ruling: star size and opacity are appearance mappings from magnitude, colour is B-V through a black-body approximation; not photometry - cost if wrong: cosmetic.
- Ruling: if the moon-orbit hypotheses fail, the fallback is a mean anomaly calibrated to JPL Horizons at J2000 (a fit, not the table value), disclosed per moon - cost if wrong: those moons match Horizons at J2000 and drift by the (unknown) rate error at other dates.
- Ruling: the cloud-wash fix is only applied if the A/B diagnosis confirms the cloud shell as the cause - cost if wrong: the wash remains and its documented real cause stands.

## File Structure

```
scripts/gen-sky-stars.mjs            create  CSV -> src/catalog/skyStars.ts generator (pure transcription)
src/catalog/skyStars.ts              create  GENERATED: NOTABLE_STARS, BACKGROUND_STARS
src/render/colorIndex.ts             create  B-V -> temperature -> sRGB / linear RGB
src/ephemeris/starPosition.ts        modify  add raDecToDirection
src/render/skyStarMath.ts            create  SKY_RADIUS_M, size/opacity/label-fade maths, sky positions
src/render/skyStarPoints.ts          create  the Points layer and its shader
src/ui/skyStarLabels.ts              create  notable-star label DOM layer + visibleSkyLabels
src/ui/labelLayout.ts                modify  make layoutLabels generic in the id type
src/render/terminatorMath.ts         create  softLambert + SOFT_LAMBERT_GLSL
src/render/bodyShadowMath.ts         create  shadowLit, combinedShadow, selectOccluders
src/render/bodyShadows.ts            create  BODY_SHADOW_GLSL, shadowCasterIds, casterEntries
src/render/surfaceMaterial.ts        modify  soft Lambert + occluder uniforms/GLSL
src/render/clouds.ts                 modify  soft Lambert (+ altitude fade if Task 10 confirms)
src/render/bodyView.ts               modify  occluder selection and uniforms
src/render/solarScene.ts             modify  sky layer, casters, hooks
src/ui/toggles.ts, src/ui/bodyText.ts, src/main.ts   modify  Night sky toggle, note, labels, hooks
src/catalog/orbits.ts                modify  (Task 11) evidence-driven element fixes
tests/...                            one test file per new module, see tasks
scripts/smoke.mjs, README.md         modify  (Task 12)
```

## Task order and models (controller guidance)

Tasks 1-4 and 6 are pure logic with complete code: haiku implementers, may be batched (1+2, 3+4). Tasks 5, 7, 8, 9, 10, 11, 12 involve shaders, browser work, or debugging: sonnet. Reviewers: sonnet. Final whole-branch review: opus.

---

### Task 1: Colour index to colour

**Files:**
- Create: `src/render/colorIndex.ts`
- Test: `tests/render/colorIndex.test.ts`

**Interfaces:**
- Consumes: `clamp` from `src/math.ts`, `Vec3` type.
- Produces: `colorIndexToTemperatureK(bv: number): number`, `temperatureToSrgb(tK: number): Vec3` (sRGB 0..1), `colorIndexToRGB(bv: number): Vec3` (sRGB 0..1), `srgbToLinear(c: number): number`, `colorIndexToLinearRGB(bv: number): Vec3`, `DEFAULT_COLOR_INDEX = 0.6`.

- [ ] **Step 1: Write the failing test** (expectations computed with node on 2026-09-24: bv 0.65 gives 5778 K and (1, 0.9506, 0.9042); bv -0.3 gives (0.6947, 0.7945, 1); bv 1.8 gives (1, 0.7428, 0.5282); bv 0 gives 10125 K; sRGB 0.5 is linear 0.21404114)

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR_INDEX, colorIndexToLinearRGB, colorIndexToRGB, colorIndexToTemperatureK, srgbToLinear, temperatureToSrgb,
} from '../../src/render/colorIndex';

describe('colorIndexToTemperatureK (Ballesteros 2012)', () => {
  it('maps the Sun (B-V 0.65) to about 5778 K and B-V 0 to about 10100 K', () => {
    expect(colorIndexToTemperatureK(0.65)).toBeCloseTo(5778, -1);
    expect(colorIndexToTemperatureK(0)).toBeCloseTo(10125, -1);
  });
  it('is monotonic: redder stars are cooler', () => {
    let previous = Infinity;
    for (let bv = -0.3; bv <= 2.0; bv += 0.1) {
      const t = colorIndexToTemperatureK(bv);
      expect(t).toBeLessThan(previous);
      previous = t;
    }
  });
  it('clamps colour indices outside the fitted range instead of blowing up', () => {
    expect(colorIndexToTemperatureK(9)).toBe(colorIndexToTemperatureK(2.0));
    expect(colorIndexToTemperatureK(-9)).toBe(colorIndexToTemperatureK(-0.4));
  });
});

describe('colorIndexToRGB reference colours', () => {
  it('a hot blue-white star (B-V -0.3) is blue-dominant', () => {
    const [r, g, b] = colorIndexToRGB(-0.3);
    expect(r).toBeCloseTo(0.6947, 3);
    expect(g).toBeCloseTo(0.7945, 3);
    expect(b).toBe(1);
    expect(b).toBeGreaterThan(r);
  });
  it('a Sun-like star (B-V 0.65) is near white, slightly warm', () => {
    const [r, g, b] = colorIndexToRGB(0.65);
    expect(r).toBe(1);
    expect(g).toBeCloseTo(0.9506, 3);
    expect(b).toBeCloseTo(0.9042, 3);
  });
  it('a cool red-orange star (B-V 1.8) is red-dominant', () => {
    const [r, g, b] = colorIndexToRGB(1.8);
    expect(r).toBe(1);
    expect(g).toBeCloseTo(0.7428, 3);
    expect(b).toBeCloseTo(0.5282, 3);
    expect(r - b).toBeGreaterThan(0.4);
  });
  it('the red-minus-blue excess never decreases as the colour index rises', () => {
    let previous = -Infinity;
    for (let bv = -0.3; bv <= 2.0; bv += 0.1) {
      const [r, , b] = colorIndexToRGB(bv);
      expect(r - b).toBeGreaterThanOrEqual(previous);
      previous = r - b;
    }
  });
  it('every channel stays in 0..1', () => {
    for (let bv = -1; bv <= 3; bv += 0.05) {
      for (const c of colorIndexToRGB(bv)) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
  it('a missing or non-finite colour index falls back to the default (0.6), never NaN', () => {
    expect(colorIndexToRGB(Number.NaN)).toEqual(colorIndexToRGB(DEFAULT_COLOR_INDEX));
    expect(colorIndexToRGB(Infinity)).toEqual(colorIndexToRGB(DEFAULT_COLOR_INDEX));
  });
});

describe('srgbToLinear and colorIndexToLinearRGB', () => {
  it('matches the sRGB transfer function', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 12);
    expect(srgbToLinear(0.04)).toBeCloseTo(0.0030959752, 9); // linear segment: 0.04 / 12.92
    expect(srgbToLinear(0.5)).toBeCloseTo(0.21404114, 7);
  });
  it('converts each channel of colorIndexToRGB', () => {
    const s = colorIndexToRGB(0.65);
    const l = colorIndexToLinearRGB(0.65);
    expect(l).toEqual([srgbToLinear(s[0]), srgbToLinear(s[1]), srgbToLinear(s[2])]);
  });
});

describe('temperatureToSrgb', () => {
  it('is white-ish at 6600 K and clamps absurd temperatures', () => {
    const [r, , b] = temperatureToSrgb(6600);
    expect(r).toBe(1);
    expect(b).toBe(1);
    expect(temperatureToSrgb(1e9)).toEqual(temperatureToSrgb(40000));
    expect(temperatureToSrgb(-5)).toEqual(temperatureToSrgb(1000));
  });
});
```

- [ ] **Step 2: Run to verify it fails:** `npx vitest run tests/render/colorIndex.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { clamp, type Vec3 } from '../math';

/** Typical G/K-star colour index; docs/data/README.md fills missing values with it, and non-finite input falls back to it. */
export const DEFAULT_COLOR_INDEX = 0.6;
/** The range the Ballesteros fit is valid over (Ballesteros 2012, EPL 97, 34008). */
const BV_MIN = -0.4;
const BV_MAX = 2.0;

/** Effective black-body temperature (K) of a star from its B-V colour index (Ballesteros 2012). */
export function colorIndexToTemperatureK(bv: number): number {
  const b = clamp(bv, BV_MIN, BV_MAX);
  return 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
}

/**
 * sRGB colour (each channel 0..1) of a black body at `tK` kelvin: Tanner Helland's curve fit to CIE black-body colours,
 * valid 1000-40000 K. A real, computed approximation, not an invented palette.
 */
export function temperatureToSrgb(tK: number): Vec3 {
  const t = clamp(tK, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}

/** sRGB colour (0..1) of a star from its B-V colour index; a non-finite index is treated as DEFAULT_COLOR_INDEX. */
export function colorIndexToRGB(bv: number): Vec3 {
  return temperatureToSrgb(colorIndexToTemperatureK(Number.isFinite(bv) ? bv : DEFAULT_COLOR_INDEX));
}

/** sRGB transfer function, decoded: one 0..1 channel to linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** The colour as linear-light RGB, which is what a shader that ends in `<colorspace_fragment>` expects. */
export function colorIndexToLinearRGB(bv: number): Vec3 {
  const [r, g, b] = colorIndexToRGB(bv);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}
```

- [ ] **Step 4: Run** `npx vitest run tests/render/colorIndex.test.ts` — Expected: PASS. Then `npm run typecheck`.
- [ ] **Step 5: Commit**

```bash
git add src/render/colorIndex.ts tests/render/colorIndex.test.ts
git commit -m "Add B-V colour index to RGB conversion for the night sky" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Sky-star direction from RA/Dec

**Files:**
- Modify: `src/ephemeris/starPosition.ts` (append one function)
- Test: `tests/ephemeris/skyDirection.test.ts`

**Interfaces:**
- Consumes: `skyToEcliptic(raHours, decDeg, distanceM): Vec3` (already in `starPosition.ts`).
- Produces: `raDecToDirection(raHours: number, decDeg: number): Vec3` — unit vector, ecliptic J2000 axes (z toward the ecliptic north pole), the same rotation phase 4 uses for the nearby stars.

- [ ] **Step 1: Write the failing test** (expectations computed with astronomy-engine: the obliquity gives cos = 0.9174821431, sin = 0.3977769691; Sirius from the CSV row 6.752481 h, -16.716116 deg is (-0.18745620676745978, 0.7473025727292841, -0.6374943414153168))

```ts
import { describe, expect, it } from 'vitest';
import { NEARBY_STARS } from '../../src/catalog/stars';
import { dmsToDegrees, hmsToHours, nearbyStarPositionM, raDecToDirection } from '../../src/ephemeris/starPosition';
import { length } from '../../src/math';

describe('raDecToDirection', () => {
  it('points the vernal equinox (RA 0, Dec 0) along ecliptic +x', () => {
    const v = raDecToDirection(0, 0);
    expect(v[0]).toBeCloseTo(1, 12);
    expect(v[1]).toBeCloseTo(0, 12);
    expect(v[2]).toBeCloseTo(0, 12);
  });
  it('puts the north celestial pole one obliquity from the ecliptic pole', () => {
    const v = raDecToDirection(0, 90);
    expect(v[0]).toBeCloseTo(0, 12);
    expect(v[1]).toBeCloseTo(0.3977769691, 9);
    expect(v[2]).toBeCloseTo(0.9174821431, 9);
  });
  it('puts RA 6 h, Dec 0 on the ecliptic y-z plane, tilted the other way', () => {
    const v = raDecToDirection(6, 0);
    expect(v[0]).toBeCloseTo(0, 12);
    expect(v[1]).toBeCloseTo(0.9174821431, 9);
    expect(v[2]).toBeCloseTo(-0.3977769691, 9);
  });
  it('places Sirius (CSV row) at a known ecliptic direction', () => {
    const v = raDecToDirection(6.752481, -16.716116);
    expect(v[0]).toBeCloseTo(-0.187456207, 8);
    expect(v[1]).toBeCloseTo(0.747302573, 8);
    expect(v[2]).toBeCloseTo(-0.637494341, 8);
  });
  it('always returns a unit vector', () => {
    for (const [ra, dec] of [[0, 0], [12.3, 45], [23.99, -89.9], [5.5, 0.001]] as const) {
      expect(length(raDecToDirection(ra, dec))).toBeCloseTo(1, 12);
    }
  });
  it('is the same conversion phase 4 uses for the nearby stars (direction of Sirius A)', () => {
    const sirius = NEARBY_STARS.find((s) => s.id === 'siriusa')!;
    const position = nearbyStarPositionM(sirius);
    const d = length(position);
    const direction = raDecToDirection(
      hmsToHours(sirius.ra.h, sirius.ra.m, sirius.ra.s), dmsToDegrees(sirius.dec.sign, sirius.dec.d, sirius.dec.m, sirius.dec.s),
    );
    expect(direction[0]).toBeCloseTo(position[0] / d, 12);
    expect(direction[1]).toBeCloseTo(position[1] / d, 12);
    expect(direction[2]).toBeCloseTo(position[2] / d, 12);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/ephemeris/skyDirection.test.ts` — Expected: FAIL (`raDecToDirection` is not exported).
- [ ] **Step 3: Append to `src/ephemeris/starPosition.ts`**

```ts
/**
 * The unit direction (ecliptic J2000 axes) of a sky object from its J2000 right ascension (hours) and declination (degrees).
 * The night sky's stars use only this: their real direction, not their real distance.
 */
export function raDecToDirection(raHours: number, decDeg: number): Vec3 {
  return skyToEcliptic(raHours, decDeg, 1);
}
```

- [ ] **Step 4: Run** the test file, expect PASS; `npm run typecheck`.
- [ ] **Step 5: Commit**

```bash
git add src/ephemeris/starPosition.ts tests/ephemeris/skyDirection.test.ts
git commit -m "Add raDecToDirection for the night-sky stars" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Star data, transcribed from the CSVs

**Files:**
- Create: `scripts/gen-sky-stars.mjs`, `src/catalog/skyStars.ts` (generated, committed)
- Test: `tests/catalog/skyStars.test.ts`

**Interfaces:**
- Consumes: `docs/data/notable-stars-hyg.csv` (header `proper,ra_h,dec_deg,mag,dist_pc,spect,ci,con`, 48 rows), `docs/data/background-starfield-hyg.csv` (header `ra_h,dec_deg,mag,ci`, 5,022 rows). Neither file has quoted fields or embedded commas.
- Produces: `NotableStar { name, raHours, decDeg, mag, distancePc, spectralType, colorIndex, constellation }`, `BackgroundStar = readonly [raHours, decDeg, mag, colorIndex]`, `NOTABLE_STARS: readonly NotableStar[]` (CSV order), `BACKGROUND_STARS: readonly BackgroundStar[]` (CSV order), `SKY_STAR_SOURCE: string`.

- [ ] **Step 1: Write the failing test.** It re-reads the CSVs itself (same pattern as `tests/catalog/stars.test.ts`) and compares every value.

```ts
/// <reference path="../../node.d.ts" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BACKGROUND_STARS, NOTABLE_STARS, SKY_STAR_SOURCE } from '../../src/catalog/skyStars';

const csvLines = (name: string): string[][] => {
  const path = fileURLToPath(new URL(`../../docs/data/${name}`, import.meta.url));
  return readFileSync(path, 'utf8').trim().split('\n').slice(1).map((line: string) => line.split(','));
};

describe('notable stars match docs/data/notable-stars-hyg.csv exactly', () => {
  const rows = csvLines('notable-stars-hyg.csv');
  it('has 48 rows of 8 fields and the same count in the catalog', () => {
    expect(rows).toHaveLength(48);
    for (const row of rows) expect(row).toHaveLength(8);
    expect(NOTABLE_STARS).toHaveLength(48);
  });
  it('stores every field of every row, in order', () => {
    rows.forEach((row, i) => {
      const s = NOTABLE_STARS[i]!;
      expect(s.name, `row ${i}`).toBe(row[0]);
      expect(s.raHours, s.name).toBe(Number(row[1]));
      expect(s.decDeg, s.name).toBe(Number(row[2]));
      expect(s.mag, s.name).toBe(Number(row[3]));
      expect(s.distancePc, s.name).toBe(Number(row[4]));
      expect(s.spectralType, s.name).toBe(row[5]);
      expect(s.colorIndex, s.name).toBe(Number(row[6]));
      expect(s.constellation, s.name).toBe(row[7]);
    });
  });
  it('starts with Sirius and every star is at most magnitude 2.0 with a finite position', () => {
    expect(NOTABLE_STARS[0]!.name).toBe('Sirius');
    for (const s of NOTABLE_STARS) {
      expect(s.mag).toBeLessThanOrEqual(2.0);
      expect(s.raHours).toBeGreaterThanOrEqual(0);
      expect(s.raHours).toBeLessThan(24);
      expect(Math.abs(s.decDeg)).toBeLessThanOrEqual(90);
    }
  });
});

describe('background stars match docs/data/background-starfield-hyg.csv exactly', () => {
  const rows = csvLines('background-starfield-hyg.csv');
  it('has 5022 rows of 4 fields and the same count in the catalog', () => {
    expect(rows).toHaveLength(5022);
    for (const row of rows) expect(row).toHaveLength(4);
    expect(BACKGROUND_STARS).toHaveLength(5022);
  });
  it('stores every value of every row, in order', () => {
    rows.forEach((row, i) => {
      const s = BACKGROUND_STARS[i]!;
      expect(s[0], `row ${i}`).toBe(Number(row[0]));
      expect(s[1], `row ${i}`).toBe(Number(row[1]));
      expect(s[2], `row ${i}`).toBe(Number(row[2]));
      expect(s[3], `row ${i}`).toBe(Number(row[3]));
    });
  });
  it('is naked-eye only (mag <= 6.0), and has no NaN anywhere', () => {
    for (const s of BACKGROUND_STARS) {
      expect(s[2]).toBeLessThanOrEqual(6.0);
      for (const v of s) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('provenance', () => {
  it('names HYG v4.4 and the licence', () => {
    expect(SKY_STAR_SOURCE).toContain('HYG');
    expect(SKY_STAR_SOURCE).toContain('CC BY-SA 4.0');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/catalog/skyStars.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Write the generator `scripts/gen-sky-stars.mjs`** and run it.

```js
// Usage: node scripts/gen-sky-stars.mjs
// Transcribes docs/data/*.csv into src/catalog/skyStars.ts. Pure transcription: no network, no rounding.
import { readFileSync, writeFileSync } from 'node:fs';

const rows = (name) =>
  readFileSync(new URL(`../docs/data/${name}`, import.meta.url), 'utf8').trim().split('\n').slice(1).map((line) => line.split(','));
const num = (text) => {
  const v = Number(text);
  if (!Number.isFinite(v)) throw new Error(`not a number: ${text}`);
  return String(v);
};

const notable = rows('notable-stars-hyg.csv').map((r) => {
  if (r.length !== 8) throw new Error(`bad notable row: ${r}`);
  return `  { name: ${JSON.stringify(r[0])}, raHours: ${num(r[1])}, decDeg: ${num(r[2])}, mag: ${num(r[3])}, distancePc: ${num(r[4])}, spectralType: ${JSON.stringify(r[5])}, colorIndex: ${num(r[6])}, constellation: ${JSON.stringify(r[7])} },`;
});
const background = rows('background-starfield-hyg.csv').map((r) => {
  if (r.length !== 4) throw new Error(`bad background row: ${r}`);
  return `  [${num(r[0])}, ${num(r[1])}, ${num(r[2])}, ${num(r[3])}],`;
});

const out = `// GENERATED by scripts/gen-sky-stars.mjs from docs/data/notable-stars-hyg.csv and docs/data/background-starfield-hyg.csv. Do not edit by hand.
// tests/catalog/skyStars.test.ts re-reads the CSVs and checks every value.

/** Provenance, shown in the README and the Night sky tooltip. */
export const SKY_STAR_SOURCE = 'HYG Database v4.4 (Hipparcos, Yale Bright Star and Gliese catalogs), astronexus/HYG, CC BY-SA 4.0; J2000 coordinates; see docs/data/README.md';

/** One of the 48 real named stars of apparent magnitude 2.0 or brighter. */
export interface NotableStar {
  name: string;
  /** Right ascension, hours, J2000. */
  raHours: number;
  /** Declination, degrees, J2000. */
  decDeg: number;
  /** Apparent magnitude. */
  mag: number;
  /** Real distance in parsecs; NOT used for rendering (the sky layer has a fixed radius). */
  distancePc: number;
  spectralType: string;
  /** B-V colour index. */
  colorIndex: number;
  constellation: string;
}

/** One unlabelled naked-eye star: [right ascension in hours, declination in degrees, apparent magnitude, B-V colour index]. */
export type BackgroundStar = readonly [number, number, number, number];

export const NOTABLE_STARS: readonly NotableStar[] = [
${notable.join('\n')}
];

export const BACKGROUND_STARS: readonly BackgroundStar[] = [
${background.join('\n')}
];
`;
writeFileSync(new URL('../src/catalog/skyStars.ts', import.meta.url), out);
console.log(`wrote ${notable.length} notable and ${background.length} background stars`);
```

Run: `node scripts/gen-sky-stars.mjs` — Expected: `wrote 48 notable and 5022 background stars`.

- [ ] **Step 4: Run** `npx vitest run tests/catalog/skyStars.test.ts` — Expected: PASS. `npm run typecheck` clean.
- [ ] **Step 5: Commit**

```bash
git add scripts/gen-sky-stars.mjs src/catalog/skyStars.ts tests/catalog/skyStars.test.ts
git commit -m "Transcribe the 48 notable and 5022 background stars from the HYG CSVs, tested against them" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Sky-star maths (radius, size, opacity, label fade, positions)

**Files:**
- Create: `src/render/skyStarMath.ts`
- Test: `tests/render/skyStarMath.test.ts`

**Interfaces:**
- Consumes: `FAR_M`, `eclipticToThree` (`src/render/cameraRelative.ts`), `raDecToDirection` (Task 2), `scale`, `smoothstep`, `clamp`, `lerp`, `Vec3` (`src/math.ts`).
- Produces: `SKY_RADIUS_M`, `starSizePx(mag)`, `starOpacity(mag)`, `skyLabelOpacity(altitudeM)`, `skyStarPositionThree(raHours, decDeg): Vec3`, `SKY_LABEL_SUPPRESSED: ReadonlySet<string>`, plus the exported constants used in the tests (`STAR_SIZE_MAX_PX`, `STAR_SIZE_MIN_PX`, `STAR_MAG_BRIGHT`, `STAR_MAG_FAINT`, `STAR_OPACITY_MIN`, `SKY_LABEL_LOG_LO`, `SKY_LABEL_LOG_HI`).

- [ ] **Step 1: Write the failing test** (expectations computed: mag 2 gives 6 - 4.5 * 3.5 / 7.5 = 3.9; opacity at mag 3 is 0.65; label fade is smoothstep over log10 altitude 9..11, so 1e10 m gives 0.5)

```ts
import { describe, expect, it } from 'vitest';
import { MAX_CAMERA_DISTANCE_M } from '../../src/camera/cameraController';
import { NOTABLE_STARS } from '../../src/catalog/skyStars';
import { NEARBY_STARS } from '../../src/catalog/stars';
import { FAR_M } from '../../src/render/cameraRelative';
import {
  SKY_LABEL_SUPPRESSED, SKY_RADIUS_M, STAR_OPACITY_MIN, STAR_SIZE_MAX_PX, STAR_SIZE_MIN_PX, skyLabelOpacity, skyStarPositionThree,
  starOpacity, starSizePx,
} from '../../src/render/skyStarMath';
import { length } from '../../src/math';

describe('the sky radius', () => {
  it('is just inside the far plane, so no star is ever clipped, and far beyond the farthest camera position', () => {
    expect(SKY_RADIUS_M).toBeLessThan(FAR_M);
    expect(SKY_RADIUS_M).toBeGreaterThanOrEqual(0.5 * FAR_M);
    expect(SKY_RADIUS_M).toBeGreaterThan(5 * MAX_CAMERA_DISTANCE_M);
  });
});

describe('starSizePx', () => {
  it('is largest for the brightest and smallest for the faintest, continuous in between', () => {
    expect(starSizePx(-1.5)).toBe(STAR_SIZE_MAX_PX);
    expect(starSizePx(-3)).toBe(STAR_SIZE_MAX_PX);
    expect(starSizePx(6)).toBe(STAR_SIZE_MIN_PX);
    expect(starSizePx(10)).toBe(STAR_SIZE_MIN_PX);
    expect(starSizePx(2)).toBeCloseTo(3.9, 10);
    expect(starSizePx(-1.44)).toBeGreaterThan(starSizePx(-0.05));
    expect(starSizePx(-0.05)).toBeGreaterThan(starSizePx(1.0));
    expect(starSizePx(4.0)).toBeGreaterThan(starSizePx(4.1));
  });
});

describe('starOpacity', () => {
  it('is 1 for stars of magnitude 0 or brighter and fades to the minimum at magnitude 6', () => {
    expect(starOpacity(-1.44)).toBe(1);
    expect(starOpacity(0)).toBe(1);
    expect(starOpacity(3)).toBeCloseTo(0.65, 10);
    expect(starOpacity(6)).toBeCloseTo(STAR_OPACITY_MIN, 10);
    expect(starOpacity(9)).toBeCloseTo(STAR_OPACITY_MIN, 10);
    expect(starOpacity(1)).toBeGreaterThan(starOpacity(2));
  });
});

describe('skyLabelOpacity', () => {
  it('fades in on a log-altitude ramp from 1e9 m to 1e11 m', () => {
    expect(skyLabelOpacity(1e9)).toBe(0);
    expect(skyLabelOpacity(1e6)).toBe(0);
    expect(skyLabelOpacity(1e10)).toBeCloseTo(0.5, 10);
    expect(skyLabelOpacity(1e11)).toBe(1);
    expect(skyLabelOpacity(1e17)).toBe(1);
  });
  it('is 0 for zero or negative altitude, never NaN', () => {
    expect(skyLabelOpacity(0)).toBe(0);
    expect(skyLabelOpacity(-5)).toBe(0);
  });
});

describe('skyStarPositionThree', () => {
  it('lies at the sky radius, in Three.js axes (y up)', () => {
    const v = skyStarPositionThree(0, 90); // north celestial pole: ecliptic (0, 0.39778, 0.91748) -> Three (x, z, -y)
    expect(length(v) / SKY_RADIUS_M).toBeCloseTo(1, 12);
    expect(v[0] / SKY_RADIUS_M).toBeCloseTo(0, 12);
    expect(v[1] / SKY_RADIUS_M).toBeCloseTo(0.9174821431, 9);
    expect(v[2] / SKY_RADIUS_M).toBeCloseTo(-0.3977769691, 9);
  });
  it('puts the vernal equinox on +x', () => {
    const v = skyStarPositionThree(0, 0);
    expect(v[0] / SKY_RADIUS_M).toBeCloseTo(1, 12);
  });
});

describe('SKY_LABEL_SUPPRESSED', () => {
  it('names exactly the notable stars that duplicate a phase-4 nearby star, and all of them are real notable stars', () => {
    expect([...SKY_LABEL_SUPPRESSED].sort()).toEqual(['Rigil Kentaurus', 'Sirius', 'Toliman']);
    const names = new Set(NOTABLE_STARS.map((s) => s.name));
    for (const n of SKY_LABEL_SUPPRESSED) expect(names.has(n), n).toBe(true);
    // The nearby catalog really has them (Alpha Centauri A/B, Sirius A).
    expect(NEARBY_STARS.some((s) => s.name === 'Sirius A')).toBe(true);
    expect(NEARBY_STARS.some((s) => s.name === 'Alpha Centauri A')).toBe(true);
    expect(NEARBY_STARS.some((s) => s.name === 'Alpha Centauri B')).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/render/skyStarMath.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
import { clamp, lerp, scale, smoothstep, type Vec3 } from '../math';
import { raDecToDirection } from '../ephemeris/starPosition';
import { FAR_M, eclipticToThree } from './cameraRelative';

/**
 * Radius of the sky sphere, metres, in camera-centred render space. The camera is always the origin of render space, so the
 * stars never move with it: their DIRECTION is real, their distance is not (Ruling: shown in real direction, not real distance).
 * Just inside the far plane so the stars sit behind every real body; far beyond the 1e17 m maximum camera distance.
 */
export const SKY_RADIUS_M = 0.9 * FAR_M;

/** Dot size (CSS px) of a star of magnitude STAR_MAG_BRIGHT or brighter, and of magnitude STAR_MAG_FAINT or fainter. Appearance, not photometry. */
export const STAR_SIZE_MAX_PX = 6;
export const STAR_SIZE_MIN_PX = 1.5;
export const STAR_MAG_BRIGHT = -1.5;
export const STAR_MAG_FAINT = 6;
/** Opacity of a magnitude-6 star; stars of magnitude 0 or brighter are fully opaque. */
export const STAR_OPACITY_MIN = 0.3;

/** Dot size in CSS pixels from apparent magnitude: continuous, brighter is larger. */
export function starSizePx(mag: number): number {
  const t = clamp((mag - STAR_MAG_BRIGHT) / (STAR_MAG_FAINT - STAR_MAG_BRIGHT), 0, 1);
  return lerp(STAR_SIZE_MAX_PX, STAR_SIZE_MIN_PX, t);
}

/** Dot opacity from apparent magnitude: 1 at magnitude 0 and brighter, STAR_OPACITY_MIN at magnitude 6. */
export function starOpacity(mag: number): number {
  return lerp(1, STAR_OPACITY_MIN, clamp(mag / STAR_MAG_FAINT, 0, 1));
}

/** The notable-star labels fade in on log10(altitude in metres) from SKY_LABEL_LOG_LO (invisible) to SKY_LABEL_LOG_HI (opaque). */
export const SKY_LABEL_LOG_LO = 9;
export const SKY_LABEL_LOG_HI = 11;

export function skyLabelOpacity(altitudeM: number): number {
  return altitudeM > 0 ? smoothstep(SKY_LABEL_LOG_LO, SKY_LABEL_LOG_HI, Math.log10(altitudeM)) : 0;
}

/** Position of a sky star in render (Three.js) axes, metres from the camera. */
export function skyStarPositionThree(raHours: number, decDeg: number): Vec3 {
  return eclipticToThree(scale(raDecToDirection(raHours, decDeg), SKY_RADIUS_M));
}

/**
 * Notable stars whose label is not drawn because phase 4 already has a flyable, labelled nearby star at the same place
 * (Sirius A, Alpha Centauri A and B; Rigil Kentaurus and Toliman are Alpha Centauri A and B). Their dots are still drawn.
 */
export const SKY_LABEL_SUPPRESSED: ReadonlySet<string> = new Set(['Sirius', 'Rigil Kentaurus', 'Toliman']);
```

- [ ] **Step 4: Run** the test file — PASS; `npm run typecheck`.
- [ ] **Step 5: Commit**

```bash
git add src/render/skyStarMath.ts tests/render/skyStarMath.test.ts
git commit -m "Add sky-star radius, size, opacity, label-fade and position maths" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Soft terminator (C1 soft-Lambert)

**Files:**
- Create: `src/render/terminatorMath.ts`
- Modify: `src/render/surfaceMaterial.ts` (diffuse term), `src/render/clouds.ts` (cloud shading)
- Test: `tests/render/terminatorMath.test.ts`; extend `tests/render/shaderConstants.test.ts`

**Interfaces:**
- Consumes: `glslFloat` (`src/render/glsl.ts`).
- Produces: `TERMINATOR_WRAP = 0.1`, `softLambert(ndl: number, wrap?: number): number`, `SOFT_LAMBERT_GLSL: string` (defines `float softLambert(float x)` in GLSL; mirrors the TS).

The function: for `x >= w` it is `x`; for `x <= -w` it is 0; between, `(x + w)^2 / (4 w)`. It is continuous with continuous slope at both joins, never darker than `max(x, 0)`, and at most `w/4` brighter (at `x = 0`), so lit areas away from the terminator are unchanged and the hard Lambert kink at N.L = 0 is gone. The ambient `0.04 / PI` term in the surface shader is unchanged.

- [ ] **Step 1: Write the failing tests** (values computed by hand and checked with node: f(1)=1, f(0.2)=0.2, f(0.1)=0.1, f(0)=0.025, f(-0.05)=0.00625, f(-0.1)=0, f(-0.5)=0)

```ts
import { describe, expect, it } from 'vitest';
import { SOFT_LAMBERT_GLSL, TERMINATOR_WRAP, softLambert } from '../../src/render/terminatorMath';

describe('softLambert', () => {
  it('is plain Lambert well into the day side and zero well into the night side', () => {
    expect(softLambert(1)).toBe(1);
    expect(softLambert(0.2)).toBe(0.2);
    expect(softLambert(TERMINATOR_WRAP)).toBeCloseTo(TERMINATOR_WRAP, 12);
    expect(softLambert(-TERMINATOR_WRAP)).toBe(0);
    expect(softLambert(-0.5)).toBe(0);
    expect(softLambert(-1)).toBe(0);
  });
  it('is 0.025 at the geometric terminator and 0.00625 at N.L = -0.05 (wrap 0.1)', () => {
    expect(softLambert(0)).toBeCloseTo(0.025, 12);
    expect(softLambert(-0.05)).toBeCloseTo(0.00625, 12);
  });
  it('has no kink: the slope just below and just above each join agrees', () => {
    const h = 1e-6;
    for (const join of [-TERMINATOR_WRAP, TERMINATOR_WRAP]) {
      const below = (softLambert(join) - softLambert(join - h)) / h;
      const above = (softLambert(join + h) - softLambert(join)) / h;
      expect(Math.abs(below - above)).toBeLessThan(1e-4);
    }
  });
  it('never darkens the day side and adds at most wrap/4 (at the terminator)', () => {
    for (let x = -1; x <= 1; x += 0.01) {
      const plain = Math.max(x, 0);
      expect(softLambert(x)).toBeGreaterThanOrEqual(plain - 1e-12);
      expect(softLambert(x)).toBeLessThanOrEqual(plain + TERMINATOR_WRAP / 4 + 1e-12);
    }
  });
  it('is monotonic non-decreasing', () => {
    let previous = -Infinity;
    for (let x = -1; x <= 1; x += 0.005) {
      const v = softLambert(x);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });
  it('the GLSL declares the same wrap constant', () => {
    const m = /const float w = ([\d.]+);/.exec(SOFT_LAMBERT_GLSL);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(TERMINATOR_WRAP);
  });
});
```

Add to `tests/render/shaderConstants.test.ts` (new `describe`, plus imports of `CLOUD_FRAG`—see Step 3, it must be exported from `clouds.ts`—and `SOFT_LAMBERT_GLSL`):

```ts
describe('the soft terminator is used by the surface and cloud shaders', () => {
  it('the surface shader includes the softLambert function and calls it on N.L', () => {
    expect(SURFACE_FRAG).toContain(SOFT_LAMBERT_GLSL);
    expect(SURFACE_FRAG).toMatch(/float diffuse = softLambert\(ndl\)/);
    expect(SURFACE_FRAG).not.toMatch(/max\(ndl, 0\.0\) \* shadow/);
  });
  it('the cloud shader includes it too', () => {
    expect(CLOUD_FRAG).toContain(SOFT_LAMBERT_GLSL);
    expect(CLOUD_FRAG).toMatch(/softLambert\(dot\(normalize\(vNormalW\), uSunDir\)\)/);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/render/terminatorMath.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**

`src/render/terminatorMath.ts`:

```ts
import { glslFloat } from './glsl';

/**
 * Half-width of the soft terminator in N.L (cosine of the Sun angle). Hard Lambert `max(N.L, 0)` has a slope discontinuity
 * at N.L = 0 that reads as a visible seam on every planet; a real terminator is soft because the Sun is a disc and surfaces
 * are rough. Interpolated into the GLSL below (tests/render/shaderConstants.test.ts checks it).
 */
export const TERMINATOR_WRAP = 0.1;

/**
 * Soft Lambert: N.L for N.L >= wrap, 0 for N.L <= -wrap, and a quadratic ramp (x + w)^2 / (4 w) between, which joins both
 * sides with matching value and slope. Never darker than Lambert, at most wrap/4 brighter (at the terminator).
 */
export function softLambert(ndl: number, wrap = TERMINATOR_WRAP): number {
  if (ndl >= wrap) return ndl;
  if (ndl <= -wrap) return 0;
  return ((ndl + wrap) * (ndl + wrap)) / (4 * wrap);
}

/** GLSL twin of softLambert; included by the surface and cloud fragment shaders. */
export const SOFT_LAMBERT_GLSL = /* glsl */ `
float softLambert(float x) {
  const float w = ${glslFloat(TERMINATOR_WRAP)};
  return x >= w ? x : (x <= -w ? 0.0 : (x + w) * (x + w) / (4.0 * w));
}
`;
```

`src/render/surfaceMaterial.ts`: add `import { SOFT_LAMBERT_GLSL } from './terminatorMath';`. In `SURFACE_FRAG`, put `${SOFT_LAMBERT_GLSL}` on its own line right after `varying vec3 vPosW;` (before `void main()`), and replace `float diffuse = max(ndl, 0.0) * shadow;` with `float diffuse = softLambert(ndl) * shadow;`.

`src/render/clouds.ts`: rename `const FRAG` to `export const CLOUD_FRAG` (update its one use in the material), add `import { SOFT_LAMBERT_GLSL } from './terminatorMath';`, insert `${SOFT_LAMBERT_GLSL}` after `varying vec3 vNormalW;`, and replace `float ndl = max(dot(normalize(vNormalW), uSunDir), 0.0);` with `float ndl = softLambert(dot(normalize(vNormalW), uSunDir));`.

- [ ] **Step 4: Run** `npx vitest run` (whole suite; the shader-constants and existing tests must still pass) and `npm run typecheck`.
- [ ] **Step 5: Visual acceptance (visible browser, via `scripts/shot.mjs` only).** Two shots at a half-lit planet, before and after is not needed; just after:
  `node scripts/shot.mjs $SCR/t5-earth-terminator.png --view earth,2e7,90,10` and `node scripts/shot.mjs $SCR/t5-mars-terminator.png --view mars,1e7,90,10` (yaw offset 90 deg looks at the terminator). Read both images and describe: the day/night boundary should fade smoothly over a few degrees with no bright hairline or hard step; night lights on Earth still fade in across it. Any console error is a failure.
- [ ] **Step 6: Commit**

```bash
git add src/render/terminatorMath.ts src/render/surfaceMaterial.ts src/render/clouds.ts tests/render/terminatorMath.test.ts tests/render/shaderConstants.test.ts
git commit -m "Soften the planetary terminator with a C1 soft-Lambert term" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Body-on-body shadow reference maths

**Files:**
- Create: `src/render/bodyShadowMath.ts`
- Test: `tests/render/bodyShadowMath.test.ts`, `tests/ephemeris/bodyShadowReal.test.ts`

**Interfaces:**
- Consumes: `dot`, `sub`, `scale`, `length`, `smoothstep`, `Vec3` (`src/math.ts`).
- Produces: `MAX_OCCLUDERS = 4`, `MIN_SHADOW_WIDTH = 1e-4`, `interface Occluder { position: Vec3; radius: number }` (both in RECEIVER radii; receiver's centre is the origin), `shadowLit(p: Vec3, sunDir: Vec3, occluder: Occluder, tanSun: number): number` (fraction of sunlight reaching `p`, 1 = unshadowed), `combinedShadow(p, sunDir, occluders: readonly Occluder[], tanSun): number` (product), `selectOccluders(candidates: readonly Occluder[], sunDir: Vec3, tanSun: number, max?: number): Occluder[]`.

The model: the ray from `p` toward the Sun (`sunDir`, unit). The occluder sphere (centre `c`, radius `r`) is sunward if `t = (c - p) . sunDir > 0`; `d` is the miss distance of the ray from `c`. The Sun is a disc of angular tangent `tanSun` (= Sun radius / distance), so at distance `t` the penumbra half-width is `w = max(t * tanSun, MIN_SHADOW_WIDTH)`. Shadow is full (umbra) inside `|r - w|`, ramps to none at `r + w` (`smoothstep(|r - w|, r + w, d)`), and when the occluder looks smaller than the Sun's disc (`r < w`, an annular/antumbra case) the maximum darkness is `(r / w)^2`.

- [ ] **Step 1: Write the failing tests.** Expectations computed with node on 2026-09-24 (sun = [0,0,1], tanSun = 0.005): occluder c=[0,0,5] r=0.5 at p=[0,0,1] gives 0; at p=[1,0,0] gives 1; at p=[0.5,0,0] (exactly mid-penumbra) gives 0.5; c=[0,0,50] r=0.1 at the origin gives 0.84; occluder behind (c=[0,0,-5]) gives 1.

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_OCCLUDERS, MIN_SHADOW_WIDTH, combinedShadow, selectOccluders, shadowLit, type Occluder,
} from '../../src/render/bodyShadowMath';

const SUN = [0, 0, 1] as const;
const TAN = 0.005;

describe('shadowLit', () => {
  it('is 0 in the umbra, on the axis behind a large occluder', () => {
    expect(shadowLit([0, 0, 1], SUN, { position: [0, 0, 5], radius: 0.5 }, TAN)).toBe(0);
  });
  it('is 1 well outside the shadow', () => {
    expect(shadowLit([1, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, TAN)).toBe(1);
  });
  it('is exactly 0.5 halfway across the penumbra', () => {
    // t = 5, w = 0.025, edges 0.475..0.525, d = 0.5 is the midpoint.
    expect(shadowLit([0.5, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, TAN)).toBeCloseTo(0.5, 12);
  });
  it('leaves a bright ring when the occluder looks smaller than the Sun (annular case): darkness (r/w)^2', () => {
    // t = 50, w = 0.25 > r = 0.1, so the darkest possible is (0.1 / 0.25)^2 = 0.16 and 84% of the light remains.
    expect(shadowLit([0, 0, 0], SUN, { position: [0, 0, 50], radius: 0.1 }, TAN)).toBeCloseTo(0.84, 12);
  });
  it('is 1 when the occluder is on the far side of the point from the Sun', () => {
    expect(shadowLit([0, 0, 0], SUN, { position: [0, 0, -5], radius: 0.5 }, TAN)).toBe(1);
  });
  it('is 1 for a zero-width Sun (no NaN from a degenerate penumbra)', () => {
    const v = shadowLit([2, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, 0);
    expect(v).toBe(1);
    expect(shadowLit([0, 0, 0], SUN, { position: [0, 0, 5], radius: 0.5 }, 0)).toBe(0);
    expect(MIN_SHADOW_WIDTH).toBeGreaterThan(0);
  });
});

describe('combinedShadow', () => {
  const umbra: Occluder = { position: [0, 0, 5], radius: 0.5 };
  const elsewhere: Occluder = { position: [9, 0, 5], radius: 0.5 };
  it('is 1 with no occluders', () => {
    expect(combinedShadow([0, 0, 0], SUN, [], TAN)).toBe(1);
  });
  it('is the product of the individual factors', () => {
    expect(combinedShadow([0, 0, 0], SUN, [umbra, elsewhere], TAN)).toBe(0);
    expect(combinedShadow([1, 0, 0], SUN, [umbra, elsewhere], TAN)).toBe(1);
    const half: Occluder = { position: [0, 0, 5], radius: 0.5 };
    expect(combinedShadow([0.5, 0, 0], SUN, [half, half], TAN)).toBeCloseTo(0.25, 12);
  });
});

describe('selectOccluders', () => {
  const A: Occluder = { position: [0, 0, 5], radius: 0.5 }; // on the axis: score -0.525
  const B: Occluder = { position: [3, 0, 5], radius: 0.5 }; // misses the receiver by a wide margin: dropped
  const C: Occluder = { position: [1, 0, 3], radius: 0.2 }; // grazes the receiver: kept, score 0.785
  const D: Occluder = { position: [0, 0, -4], radius: 1 }; // behind the receiver: dropped
  const E: Occluder = { position: [0.5, 0, 8], radius: 0.3 }; // kept, score 0.16
  it('drops occluders behind the receiver or missing it, and orders the rest by how squarely they cover it', () => {
    expect(selectOccluders([B, C, D, E, A], SUN, TAN)).toEqual([A, E, C]);
  });
  it('keeps at most `max`, closest first', () => {
    expect(selectOccluders([B, C, D, E, A], SUN, TAN, 2)).toEqual([A, E]);
  });
  it('returns an empty list for no candidates, and MAX_OCCLUDERS is 4', () => {
    expect(selectOccluders([], SUN, TAN)).toEqual([]);
    expect(MAX_OCCLUDERS).toBe(4);
  });
  it('never returns more than MAX_OCCLUDERS by default', () => {
    const many: Occluder[] = Array.from({ length: 9 }, (_, i) => ({ position: [0.1 * i, 0, 5 + i] as const, radius: 0.5 }));
    expect(selectOccluders(many, SUN, TAN)).toHaveLength(MAX_OCCLUDERS);
  });
});
```

`tests/ephemeris/bodyShadowReal.test.ts` — the same maths against the REAL ephemeris (numbers verified with node on 2026-09-24: the total lunar eclipse peaks 2026-03-03T11:33:40Z and the Moon's centre is in Earth's umbra, factor 0; six hours earlier and six days later it is 1. Io's shadow crosses Jupiter with its axis closest to Jupiter's centre at 2026-09-25T00:59:00Z (miss distance 0.0406 Jupiter radii, Io 6.03 radii away); the point where the shadow axis meets Jupiter's sunward surface has factor 0, the sub-solar point far from it has 1):

```ts
import { Body, GeoMoon, GeoVector, JupiterMoons } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { dot, length, scale, sub, type Vec3 } from '../../src/math';
import { shadowLit } from '../../src/render/bodyShadowMath';

const AU_KM = 149_597_870.7;
const SUN_RADIUS_KM = 695_700;
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737.4;
const JUPITER_RADIUS_KM = 69_911;
const IO_RADIUS_KM = 1821.49;
const v3 = (v: { x: number; y: number; z: number }): Vec3 => [v.x * AU_KM, v.y * AU_KM, v.z * AU_KM];

/** Sunlight fraction at the Moon's centre from Earth's shadow (receiver units: Moon radii). */
function moonLit(iso: string): number {
  const date = new Date(iso);
  const moon = v3(GeoMoon(date));
  const sunFromMoon = sub(v3(GeoVector(Body.Sun, date, false)), moon);
  const dist = length(sunFromMoon);
  return shadowLit(
    [0, 0, 0], scale(sunFromMoon, 1 / dist), { position: scale(moon, -1 / MOON_RADIUS_KM), radius: EARTH_RADIUS_KM / MOON_RADIUS_KM },
    SUN_RADIUS_KM / dist,
  );
}

describe('the real total lunar eclipse of 2026-03-03', () => {
  it('has the Moon in the umbra at the peak and in full sunlight six hours before and six days after', () => {
    expect(moonLit('2026-03-03T11:33:40Z')).toBeLessThan(0.01);
    expect(moonLit('2026-03-03T05:33:40Z')).toBe(1);
    expect(moonLit('2026-03-09T11:33:40Z')).toBe(1);
  });
});

describe("Io's shadow on Jupiter at 2026-09-25T00:59:00Z", () => {
  const date = new Date('2026-09-25T00:59:00Z');
  const io = scale(v3(JupiterMoons(date).io), 1 / JUPITER_RADIUS_KM); // Jupiter radii, Jupiter at the origin
  const sunFromJupiter = sub(v3(GeoVector(Body.Sun, date, false)), v3(GeoVector(Body.Jupiter, date, false)));
  const sunDist = length(sunFromJupiter);
  const sun = scale(sunFromJupiter, 1 / sunDist);
  const tanSun = SUN_RADIUS_KM / sunDist;
  const occluder = { position: io, radius: IO_RADIUS_KM / JUPITER_RADIUS_KM };
  it('darkens the surface point on the shadow axis and leaves the sub-solar point lit', () => {
    const t = dot(io, sun);
    const u = t - Math.sqrt(t * t - (dot(io, io) - 1)); // the near intersection of the axis c - s*u with the unit sphere
    const onAxis = sub(io, scale(sun, u));
    expect(length(onAxis)).toBeCloseTo(1, 9);
    expect(shadowLit(onAxis, sun, occluder, tanSun)).toBeLessThan(0.01);
    expect(shadowLit(sun, sun, occluder, tanSun)).toBe(1);
  });
});
```

- [ ] **Step 2: Run** both test files — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/render/bodyShadowMath.ts`**

```ts
import { dot, scale, smoothstep, sub, type Vec3 } from '../math';

/**
 * Reference maths for body-on-body shadows (the GLSL in bodyShadows.ts mirrors shadowLit). Positions are in RECEIVER radii
 * with the receiver's centre at the origin, so a sphere's surface is |p| = 1.
 */

/** At most this many occluders are passed to the surface shader per body per frame (bodyShadows.ts sizes its uniform arrays with it). */
export const MAX_OCCLUDERS = 4;
/** Smallest penumbra half-width (receiver radii); keeps the smoothstep edges apart for a degenerate Sun. */
export const MIN_SHADOW_WIDTH = 1e-4;

/** A sphere that may shadow the receiver: centre and radius in receiver radii. */
export interface Occluder {
  position: Vec3;
  radius: number;
}

/**
 * Fraction of sunlight reaching point `p` past one spherical occluder (1 = unshadowed). `sunDir` is the unit direction from
 * the receiver toward the Sun; `tanSun` is the Sun's angular radius as a tangent (Sun radius / Sun distance), which sets the
 * penumbra width w = t * tanSun at distance t from the point. Umbra inside |r - w|, smooth edge out to r + w; an occluder
 * smaller than the Sun's disc there (r < w) only reaches darkness (r / w)^2.
 */
export function shadowLit(p: Vec3, sunDir: Vec3, occluder: Occluder, tanSun: number): number {
  const toCentre = sub(occluder.position, p);
  const t = dot(toCentre, sunDir);
  if (t <= 0) return 1; // the occluder is not between this point and the Sun
  const perp = sub(toCentre, scale(sunDir, t));
  const d = Math.hypot(perp[0], perp[1], perp[2]);
  const r = occluder.radius;
  const w = Math.max(t * tanSun, MIN_SHADOW_WIDTH);
  const depth = Math.min(1, (r * r) / (w * w));
  const covered = 1 - smoothstep(Math.abs(r - w), r + w, d);
  return 1 - depth * covered;
}

/** Product of the individual factors (1 for no occluders). */
export function combinedShadow(p: Vec3, sunDir: Vec3, occluders: readonly Occluder[], tanSun: number): number {
  let lit = 1;
  for (const o of occluders) lit *= shadowLit(p, sunDir, o, tanSun);
  return lit;
}

/**
 * The candidates that could shadow the receiver sphere (unit sphere at the origin): sunward of its centre, and the sun ray
 * through the centre passes within 1 + r + w of the occluder's centre. Ordered by how squarely they cover it (smallest
 * d - r - w first) and cut to `max`.
 */
export function selectOccluders(
  candidates: readonly Occluder[], sunDir: Vec3, tanSun: number, max = MAX_OCCLUDERS,
): Occluder[] {
  const scored: { occluder: Occluder; score: number }[] = [];
  for (const occluder of candidates) {
    const t = dot(occluder.position, sunDir);
    if (t <= 0) continue;
    const perp = sub(occluder.position, scale(sunDir, t));
    const d = Math.hypot(perp[0], perp[1], perp[2]);
    const w = Math.max(t * tanSun, MIN_SHADOW_WIDTH);
    if (d >= 1 + occluder.radius + w) continue;
    scored.push({ occluder, score: d - occluder.radius - w });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, max).map((s) => s.occluder);
}
```

- [ ] **Step 4: Run** both test files — PASS; `npm run typecheck`. If a numeric expectation fails, recompute it with node before changing anything.
- [ ] **Step 5: Commit**

```bash
git add src/render/bodyShadowMath.ts tests/render/bodyShadowMath.test.ts tests/ephemeris/bodyShadowReal.test.ts
git commit -m "Add body-on-body shadow reference maths, checked against a real lunar eclipse and an Io transit" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Body shadows in the surface shader

**Files:**
- Create: `src/render/bodyShadows.ts`
- Modify: `src/render/surfaceMaterial.ts`, `src/render/bodyView.ts`, `src/render/solarScene.ts`, `src/main.ts`
- Test: `tests/render/bodyShadows.test.ts`; extend `tests/render/shaderConstants.test.ts`

**Interfaces:**
- Consumes: Task 5 (`softLambert` already in the surface shader), Task 6 (`MAX_OCCLUDERS`, `MIN_SHADOW_WIDTH`, `Occluder`, `selectOccluders`), `BODIES`, `getBody`, `BodyId`, `BodyData` (`src/catalog/bodies.ts`), `toRenderSpace`.
- Produces: `SUN_RADIUS_M`, `interface ShadowCaster { rel: Vec3; radiusM: number }` (render axes, metres, relative to the camera), `shadowCasterIds(id: BodyId): readonly BodyId[]`, `casterEntries(id: BodyId, rels: ReadonlyMap<BodyId, Vec3>): ShadowCaster[]`, `BODY_SHADOW_GLSL: string`; `BodyUpdateContext.casters: readonly ShadowCaster[]`; `SolarScene.centreMeanLuma(): number`; hook `window.__solar.meanLuma(): number`.

**Design.** Receivers are planets, moons and dwarf planets drawn as spheres. A receiver's candidate occluders are its family: its parent (unless the parent is the Sun), its siblings (same parent, unless that parent is the Sun) and its children; never itself, never the Sun, never small bodies or stars. Per frame `SolarScene` builds float64 camera-relative positions for all bodies, then per body its family's `ShadowCaster` list; `BodyView.update` converts them to receiver radii in the receiver's local axes (float64 subtraction first), calls `selectOccluders`, and writes at most 4 into uniforms. The surface shader multiplies its diffuse term by the product of `bodyShadowLit` over the chosen occluders. With effects switched off (`effectsEnabled` false) `uOccCount` is 0.

- [ ] **Step 1: Write the failing tests** `tests/render/bodyShadows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BODIES, getBody, type BodyId } from '../../src/catalog/bodies';
import type { Vec3 } from '../../src/math';
import { MAX_OCCLUDERS } from '../../src/render/bodyShadowMath';
import { BODY_SHADOW_GLSL, SUN_RADIUS_M, casterEntries, shadowCasterIds } from '../../src/render/bodyShadows';

describe('shadowCasterIds', () => {
  it('lets a planet be shadowed by its moons only', () => {
    expect([...shadowCasterIds('earth')]).toEqual(['moon']);
    expect(shadowCasterIds('jupiter')).toEqual(expect.arrayContaining(['io', 'europa', 'ganymede', 'callisto']));
    expect(shadowCasterIds('mars')).toEqual(expect.arrayContaining(['phobos', 'deimos']));
  });
  it('lets a moon be shadowed by its planet and its siblings, never itself or the Sun', () => {
    const io = shadowCasterIds('io');
    expect(io).toContain('jupiter');
    expect(io).toContain('europa');
    expect(io).not.toContain('io');
    expect(io).not.toContain('sun');
    expect(shadowCasterIds('moon')).toEqual(['earth']);
  });
  it('gives a planet without moons, the Sun, small bodies and stars no casters', () => {
    expect(shadowCasterIds('mercury')).toEqual([]);
    expect(shadowCasterIds('sun')).toEqual([]);
    for (const b of BODIES) {
      if (b.kind === 'asteroid' || b.kind === 'comet' || b.kind === 'nearstar') expect(shadowCasterIds(b.id), b.id).toEqual([]);
    }
  });
  it('never lists a caster that is a star, small body or the receiver, for any body', () => {
    for (const b of BODIES) {
      for (const c of shadowCasterIds(b.id)) {
        expect(c, b.id).not.toBe(b.id);
        expect(['planet', 'moon', 'dwarf'], `${b.id} <- ${c}`).toContain(getBody(c).kind);
      }
    }
  });
});

describe('casterEntries', () => {
  it('returns each caster with its position and radius, skipping ids with no position', () => {
    const rels = new Map<BodyId, Vec3>([['moon', [1, 2, 3]]]);
    expect(casterEntries('earth', rels)).toEqual([{ rel: [1, 2, 3], radiusM: getBody('moon').radiusM }]);
    expect(casterEntries('earth', new Map())).toEqual([]);
    expect(casterEntries('mercury', rels)).toEqual([]);
  });
});

describe('constants', () => {
  it('SUN_RADIUS_M is the catalog Sun radius', () => {
    expect(SUN_RADIUS_M).toBe(getBody('sun').radiusM);
  });
  it('the GLSL sizes its arrays with MAX_OCCLUDERS and defines bodyShadowLit', () => {
    expect(BODY_SHADOW_GLSL).toContain(`uniform vec3 uOccPos[${MAX_OCCLUDERS}];`);
    expect(BODY_SHADOW_GLSL).toContain(`uniform float uOccRadius[${MAX_OCCLUDERS}];`);
    expect(BODY_SHADOW_GLSL).toContain('float bodyShadowLit(');
  });
});
```

Add to `tests/render/shaderConstants.test.ts`:

```ts
describe('the surface shader body-shadow block mirrors bodyShadowMath', () => {
  it('includes the shared GLSL and multiplies the diffuse term by the body shadow', () => {
    expect(SURFACE_FRAG).toContain(BODY_SHADOW_GLSL);
    expect(SURFACE_FRAG).toMatch(/float diffuse = softLambert\(ndl\) \* shadow \* bodyShadow;/);
  });
  it('uses the same minimum penumbra width', () => {
    expect(grab(BODY_SHADOW_GLSL, /const float MIN_W = ([\d.e-]+);/)).toEqual([MIN_SHADOW_WIDTH]);
  });
  it('loops over MAX_OCCLUDERS occluders', () => {
    expect(grab(BODY_SHADOW_GLSL, /const int MAX_OCC = (\d+);/)).toEqual([MAX_OCCLUDERS]);
  });
});
```
(Add imports: `BODY_SHADOW_GLSL` from `bodyShadows`, `MAX_OCCLUDERS`, `MIN_SHADOW_WIDTH` from `bodyShadowMath`. `String(1e-4)` is `0.0001`, which the regex accepts and `glslFloat` passes through.)

- [ ] **Step 2: Run** `npx vitest run tests/render/bodyShadows.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**

`src/render/bodyShadows.ts`:

```ts
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
  BODIES.map((body) => {
    if (!SHADOWING_KINDS.has(body.kind)) return [body.id, []] as const;
    const family = BODIES.filter((other) => {
      if (other.id === body.id || !SHADOWING_KINDS.has(other.kind)) return false;
      const isChild = other.parent === body.id;
      const isParent = body.parent === other.id;
      const isSibling = body.parent !== null && body.parent !== 'sun' && other.parent === body.parent;
      return isChild || isParent || isSibling;
    });
    return [body.id, family.map((o) => o.id)] as const;
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
```

`src/render/surfaceMaterial.ts`: import `BODY_SHADOW_GLSL` and `MAX_OCCLUDERS`. In `SURFACE_FRAG`, insert `${BODY_SHADOW_GLSL}` right after `${SOFT_LAMBERT_GLSL}`. In `main()`, add `float bodyShadow = bodyShadowFactor(vPosB, uSunLocal);` on the line before `float diffuse` and change the diffuse line to `float diffuse = softLambert(ndl) * shadow * bodyShadow;`. (`uSunLocal` is the Sun direction in the receiver's local axes; `vPosB` is the local unit-sphere position: both are already declared.) In `createSurfaceMaterial`'s `uniforms`, add:

```ts
      uOccCount: { value: 0 },
      uOccPos: { value: Array.from({ length: MAX_OCCLUDERS }, () => new THREE.Vector3()) },
      uOccRadius: { value: new Array<number>(MAX_OCCLUDERS).fill(0) },
      uTanSun: { value: 0 },
```

`src/render/bodyView.ts`: import `{ selectOccluders, type Occluder } from './bodyShadowMath'` and `{ SUN_RADIUS_M, type ShadowCaster } from './bodyShadows'`. Add `casters: readonly ShadowCaster[];` to `BodyUpdateContext` (doc: "Bodies whose shadow may fall on this one, camera-relative"). Add a private scratch vector `private readonly scratch = new THREE.Vector3();`. In `update`, change `if (asSphere) this.updateSurface(state);` to:

```ts
    if (asSphere) {
      this.updateSurface(state);
      this.updateShadows(state, rel, ctx.casters);
    }
```

and add the method:

```ts
  /** Chooses up to MAX_OCCLUDERS family bodies that can shadow this one and writes them, in this body's radii and local axes, to the shader. */
  private updateShadows(state: BodyRenderState, rel: Vec3, casters: readonly ShadowCaster[]): void {
    const u = this.surface.uniforms;
    if (!state.effectsEnabled || isStarKind(this.data.kind) || casters.length === 0) {
      u.uOccCount.value = 0;
      return;
    }
    const radius = this.data.radiusM;
    const tanSun = SUN_RADIUS_M / state.sunDistanceM;
    const candidates: Occluder[] = casters.map((c) => {
      // Float64 difference first, then to this body's radii and local axes.
      this.scratch.set((c.rel[0] - rel[0]) / radius, (c.rel[1] - rel[1]) / radius, (c.rel[2] - rel[2]) / radius).applyQuaternion(this.inverseQuat);
      return { position: [this.scratch.x, this.scratch.y, this.scratch.z], radius: c.radiusM / radius };
    });
    const chosen = selectOccluders(candidates, [state.sunLocal.x, state.sunLocal.y, state.sunLocal.z], tanSun);
    const positions = u.uOccPos.value as THREE.Vector3[];
    const radii = u.uOccRadius.value as number[];
    chosen.forEach((o, i) => {
      positions[i]!.set(o.position[0], o.position[1], o.position[2]);
      radii[i] = o.radius;
    });
    u.uOccCount.value = chosen.length;
    u.uTanSun.value = tanSun;
  }
```

`src/render/solarScene.ts`: import `casterEntries` from `./bodyShadows`. In pass 2 of `render`, before the `for (const body of BODIES)` loop, add:

```ts
    // Camera-relative positions of every body in float64, for the shadow casters of each family.
    const rels = new Map<BodyId, Vec3>();
    for (const body of BODIES) rels.set(body.id, toRenderSpace(input.frame[body.id].position, input.cameraPos));
```

and add `casters: casterEntries(body.id, rels),` to the object passed to `view.update`. Add the method (next to `centreLitPixels`) — note it must not assume the pixel format beyond RGBA bytes:

```ts
  /** Renders once more and returns the mean of (r+g+b)/3, 0..255, over a 64x64 patch at the centre (for the smoke test). */
  centreMeanLuma(): number {
    if (!this.lastInput) return 0;
    this.render(this.lastInput);
    const gl = this.renderer.getContext();
    const size = 64;
    const buffer = new Uint8Array(size * size * 4);
    gl.readPixels(
      Math.floor((gl.drawingBufferWidth - size) / 2), Math.floor((gl.drawingBufferHeight - size) / 2),
      size, size, gl.RGBA, gl.UNSIGNED_BYTE, buffer,
    );
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 4) sum += (buffer[i]! + buffer[i + 1]! + buffer[i + 2]!) / 3;
    return sum / (size * size);
  }
```

`src/main.ts`: add `meanLuma(): number;` to the `Window.__solar` type and `meanLuma: () => scene.centreMeanLuma(),` to the hook object.

- [ ] **Step 4: Run** `npx vitest run` (all) and `npm run typecheck` and `npm run build`.
- [ ] **Step 5: Visual acceptance (visible browser).** Note `--time` applies before `--view`. Take four shots and READ each:
  - `node scripts/shot.mjs $SCR/t7-lunar-eclipse.png --time 2026-03-03T11:33:40Z --view moon,3e6,0,0` — the Moon should be almost black (only the faint ambient).
  - `node scripts/shot.mjs $SCR/t7-moon-lit.png --time 2026-03-09T11:33:40Z --view moon,3e6,0,0` — the same view six days later: a fully lit Moon.
  - `node scripts/shot.mjs $SCR/t7-io-shadow.png --time 2026-09-25T00:59:00Z --view jupiter,1.2e8,0,0` — a small round dark spot (Io's shadow, about 0.05 Jupiter radii across) on Jupiter's disc near its centre; Io itself may be a dot near the spot.
  - `node scripts/shot.mjs $SCR/t7-io-noshadow.png --time 2026-09-24T12:00:00Z --view jupiter,1.2e8,0,0` — no dark spot at this time. If a different Galilean shadow is present there, say so and pick `2026-09-26T12:00:00Z` instead.
  Also run once with `--effects off` for the eclipse time and confirm the Moon is lit again (effects off zeroes the occluders). Describe each image in the task report. If the Io spot is not visible, debug (`meanLuma`, print the chosen occluders once with a temporary `console.log`, remove it before committing) before proceeding; do not just relax the check.
- [ ] **Step 6: Commit**

```bash
git add src/render/bodyShadows.ts src/render/surfaceMaterial.ts src/render/bodyView.ts src/render/solarScene.ts src/main.ts tests/render/bodyShadows.test.ts tests/render/shaderConstants.test.ts
git commit -m "Add body-on-body shadows: moons on planets, planets on moons, moons on moons" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: The night sky points and the Night sky toggle

**Files:**
- Create: `src/render/skyStarPoints.ts`
- Modify: `src/render/solarScene.ts`, `src/ui/toggles.ts`, `src/ui/bodyText.ts`, `src/main.ts`
- Test: `tests/render/skyStarPoints.test.ts`; extend `tests/ui/bodyText.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4 (`colorIndexToLinearRGB`, `NOTABLE_STARS`, `BACKGROUND_STARS`, `SKY_STAR_SOURCE`, `skyStarPositionThree`, `starOpacity`, `starSizePx`).
- Produces: `SkyStarPoints` class (`points: THREE.Points`, `count: number`, `get visible(): boolean`, `setPixelRatio(r: number): void`, `update(opacity: number): void`), `SKY_STAR_COUNT` (= 5070), `NOTABLE_SKY_POSITIONS: readonly Vec3[]` (Three axes, metres, same order as `NOTABLE_STARS`), `SKY_VERT`, `SKY_FRAG`; `FrameInput.showNightSky: boolean`; `SolarScene.skyState(): { points: number; visible: boolean }`; toggle key `'nightSky'` (default on); `SKY_NOTE`; hooks `window.__solar.setNightSky(on)` and `skyState()`.

- [ ] **Step 1: Write the failing tests.**

`tests/render/skyStarPoints.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BACKGROUND_STARS, NOTABLE_STARS } from '../../src/catalog/skyStars';
import { length } from '../../src/math';
import { SKY_RADIUS_M } from '../../src/render/skyStarMath';
import { NOTABLE_SKY_POSITIONS, SKY_FRAG, SKY_STAR_COUNT, SKY_VERT } from '../../src/render/skyStarPoints';

describe('the sky layer data', () => {
  it('has every notable and background star', () => {
    expect(SKY_STAR_COUNT).toBe(NOTABLE_STARS.length + BACKGROUND_STARS.length);
    expect(SKY_STAR_COUNT).toBe(5070);
  });
  it('has one render position per notable star, all at the sky radius', () => {
    expect(NOTABLE_SKY_POSITIONS).toHaveLength(48);
    for (const p of NOTABLE_SKY_POSITIONS) expect(length(p) / SKY_RADIUS_M).toBeCloseTo(1, 9);
  });
});

describe('the sky shaders follow the custom-shader rules', () => {
  it('include the log-depth chunks and end with the colour-space conversion', () => {
    for (const chunk of ['logdepthbuf_pars_vertex', 'logdepthbuf_vertex']) expect(SKY_VERT).toContain(`<${chunk}>`);
    for (const chunk of ['logdepthbuf_pars_fragment', 'logdepthbuf_fragment', 'colorspace_fragment']) expect(SKY_FRAG).toContain(`<${chunk}>`);
    expect(SKY_FRAG.indexOf('<colorspace_fragment>')).toBeGreaterThan(SKY_FRAG.indexOf('<logdepthbuf_fragment>'));
  });
  it('samples no textures (so a discard cannot break derivatives)', () => {
    expect(SKY_FRAG).not.toMatch(/texture2D|texture\(/);
  });
});
```

Extend `tests/ui/bodyText.test.ts` (import `SKY_NOTE`):

```ts
describe('SKY_NOTE', () => {
  it('says the stars are real but shown in direction only, and gives the counts and the source', () => {
    expect(SKY_NOTE).toContain('direction');
    expect(SKY_NOTE).toContain('not their real distance');
    expect(SKY_NOTE).toContain('48');
    expect(SKY_NOTE).toContain('5,022');
    expect(SKY_NOTE).toContain('HYG');
  });
});
```

- [ ] **Step 2: Run** those tests — Expected: FAIL.
- [ ] **Step 3: Implement.**

`src/render/skyStarPoints.ts`:

```ts
import * as THREE from 'three';
import { BACKGROUND_STARS, NOTABLE_STARS } from '../catalog/skyStars';
import type { Vec3 } from '../math';
import { colorIndexToLinearRGB } from './colorIndex';
import { skyStarPositionThree, starOpacity, starSizePx } from './skyStarMath';

/** Render positions of the notable stars (Three.js axes, metres from the camera), in NOTABLE_STARS order: the label layer projects these. */
export const NOTABLE_SKY_POSITIONS: readonly Vec3[] = NOTABLE_STARS.map((s) => skyStarPositionThree(s.raHours, s.decDeg));

export const SKY_STAR_COUNT = NOTABLE_STARS.length + BACKGROUND_STARS.length;

export const SKY_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha * uOpacity;
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

// No texture is sampled, so the discard below cannot upset derivatives. aColor is linear light; <colorspace_fragment> encodes it.
export const SKY_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, r)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The night sky: the notable and background stars as ONE Points draw call. Positions are fixed directions at SKY_RADIUS_M in
 * camera-centred render space (the camera is the origin), so nothing is updated per frame except the opacity. Depth test on,
 * depth write off: real bodies (which write depth) hide the stars behind them; the atmosphere sky pass blends over them.
 */
export class SkyStarPoints {
  readonly points: THREE.Points;
  readonly count = SKY_STAR_COUNT;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    const positions = new Float32Array(3 * SKY_STAR_COUNT);
    const colors = new Float32Array(3 * SKY_STAR_COUNT);
    const sizes = new Float32Array(SKY_STAR_COUNT);
    const alphas = new Float32Array(SKY_STAR_COUNT);
    const put = (i: number, raHours: number, decDeg: number, mag: number, colorIndex: number): void => {
      const p = skyStarPositionThree(raHours, decDeg);
      positions.set(p, 3 * i);
      colors.set(colorIndexToLinearRGB(colorIndex), 3 * i);
      sizes[i] = starSizePx(mag);
      alphas[i] = starOpacity(mag);
    };
    NOTABLE_STARS.forEach((s, i) => put(i, s.raHours, s.decDeg, s.mag, s.colorIndex));
    BACKGROUND_STARS.forEach((s, i) => put(NOTABLE_STARS.length + i, s[0], s[1], s[2], s[3]));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0 } },
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1; // behind every effect (clouds 4, rings 5, atmosphere 6) and the belts and sprites
    this.points.visible = false;
  }

  get visible(): boolean {
    return this.points.visible;
  }

  /** Point sizes are in CSS pixels; the renderer's pixel ratio scales them to device pixels. */
  setPixelRatio(ratio: number): void {
    this.material.uniforms.uPixelRatio!.value = ratio;
  }

  /** At (nearly) zero opacity the layer is hidden and costs nothing. */
  update(opacity: number): void {
    this.points.visible = opacity > 0.001;
    this.material.uniforms.uOpacity!.value = opacity;
  }
}
```

`src/render/solarScene.ts`: import `SkyStarPoints`; add `showNightSky: boolean;` to `FrameInput`; add field `private readonly sky = new SkyStarPoints();`; add `this.sky.points` to the `this.scene.add(...)` in the constructor; in `resize`, after `setPixelRatio`, add `this.sky.setPixelRatio(Math.min(window.devicePixelRatio, 2));`; in `render`, just before `this.renderer.render(...)`, add `this.sky.update(input.showNightSky ? 1 : 0);`; add:

```ts
  /** The night-sky layer's point count and whether it was drawn in the last frame. */
  skyState(): { points: number; visible: boolean } {
    return { points: this.sky.count, visible: this.sky.visible };
  }
```

`src/ui/bodyText.ts`: add (import `SKY_STAR_SOURCE` from `../catalog/skyStars`):

```ts
/** What the Night sky layer is: shown as the toggle's tooltip and in the README. */
export const SKY_NOTE = `The night sky shows 48 named stars (magnitude 2 or brighter, labelled) and 5,022 more naked-eye stars (magnitude 6 or brighter) from ${SKY_STAR_SOURCE}. Every star is drawn in its real direction, but not their real distance: they sit on a fixed sky sphere, cannot be flown to, and do not shift as the camera moves (the real ones are tens to over a thousand light-years away). Colours come from each star's real B-V colour index.`;
```

`src/ui/toggles.ts`: `ToggleKey` gains `'nightSky'`; `Toggles` gains `readonly nightSky: boolean;`; state gains `nightSky: true`; add `add('Night sky', 'nightSky', SKY_NOTE);` after Deep space (import `SKY_NOTE`); add `get nightSky() { return state.nightSky; },` to the returned object.

`src/main.ts`: add `showNightSky: toggles.nightSky` to the `lastInput` object; add to the `Window.__solar` type `setNightSky(on: boolean): void; skyState(): { points: number; visible: boolean };` and to the hook object `setNightSky: (on) => toggles.set('nightSky', on), skyState: () => scene.skyState(),`.

- [ ] **Step 4: Run** `npx vitest run`, `npm run typecheck`, `npm run build`.
- [ ] **Step 5: Visual acceptance (visible browser).** Read each image and describe it:
  - `node scripts/shot.mjs $SCR/t8-sky-earth.png --view earth,3e6,150,25` — Earth close, dark space behind it filled with many small stars of varied brightness and faintly varied colour (blue-white through orange), none in front of the planet.
  - `node scripts/shot.mjs $SCR/t8-sky-deep.png --view sun,3e13,0,60` — a starfield; some stars visibly brighter and bigger (Sirius and Canopus are the brightest).
  - `node scripts/shot.mjs $SCR/t8-sky-maxzoom.png --view sun,1e17,0,60` — the same sky pattern (stars do not move with the camera); nothing clipped.
  Then confirm `skyState()` reports 5070 points and `visible` true. Toggle check: run `node scripts/shot.mjs` cannot toggle, so extend nothing here; Task 12's smoke covers the toggle. Any console error is a failure.
- [ ] **Step 6: Commit**

```bash
git add src/render/skyStarPoints.ts src/render/solarScene.ts src/ui/toggles.ts src/ui/bodyText.ts src/main.ts tests/render/skyStarPoints.test.ts tests/ui/bodyText.test.ts
git commit -m "Render the real night sky (5070 stars) with a Night sky toggle" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Notable-star labels

**Files:**
- Create: `src/ui/skyStarLabels.ts`
- Modify: `src/ui/labelLayout.ts` (generic id type), `src/main.ts`, `src/style.css` (only if the label class needs nothing new, do not touch)
- Test: `tests/ui/skyStarLabels.test.ts`; extend `tests/ui/labelLayout.test.ts`

**Interfaces:**
- Consumes: Task 4 (`skyLabelOpacity`, `SKY_LABEL_SUPPRESSED`), Task 8 (`NOTABLE_SKY_POSITIONS`), `NOTABLE_STARS`, `SolarScene.projectToScreen(rel)`, `el` (`src/ui/dom.ts`).
- Produces: `layoutLabels<K extends string>` (generic; existing BodyId callers unchanged), `SkyLabelItem { index: number; x: number; y: number; inFront: boolean; priority: number }`, `MIN_SKY_LABEL_OPACITY = 0.02`, `visibleSkyLabels(items, opacity, enabled, viewport): number[]` (pure: indices to show), `createSkyStarLabels(root, names): { update(items, opacity, enabled, viewport): void; shown(): string[] }`; hook `window.__solar.skyLabelsShown(): string[]`.

- [ ] **Step 1: Write the failing tests.**

`tests/ui/skyStarLabels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MIN_SKY_LABEL_OPACITY, visibleSkyLabels, type SkyLabelItem } from '../../src/ui/skyStarLabels';

const VIEW = { width: 1280, height: 720 };
const item = (index: number, x: number, y: number, priority: number, inFront = true): SkyLabelItem => ({ index, x, y, inFront, priority });

describe('visibleSkyLabels', () => {
  const items = [item(0, 100, 100, 5), item(1, 105, 102, 9), item(2, 600, 300, 1)];
  it('shows nothing when the Labels toggle or the Night sky toggle is off (enabled false) or the fade has not begun', () => {
    expect(visibleSkyLabels(items, 1, false, VIEW)).toEqual([]);
    expect(visibleSkyLabels(items, 0, true, VIEW)).toEqual([]);
    expect(visibleSkyLabels(items, MIN_SKY_LABEL_OPACITY / 2, true, VIEW)).toEqual([]);
  });
  it('declutters: of two labels closer than 22 px the higher priority survives', () => {
    expect(visibleSkyLabels(items, 1, true, VIEW).sort()).toEqual([1, 2]);
  });
  it('drops stars behind the camera and stars off screen', () => {
    expect(visibleSkyLabels([item(0, 100, 100, 1, false)], 1, true, VIEW)).toEqual([]);
    expect(visibleSkyLabels([item(0, -80, 100, 1), item(1, 100, 900, 1), item(2, 1400, 10, 1)], 1, true, VIEW)).toEqual([]);
  });
  it('keeps a label just inside the 50 px screen margin', () => {
    expect(visibleSkyLabels([item(0, -40, 100, 1)], 1, true, VIEW)).toEqual([0]);
  });
});
```

Extend `tests/ui/labelLayout.test.ts`:

```ts
it('layoutLabels works with any string id, not only body ids', () => {
  const placed = layoutLabels([{ id: 'Vega', x: 10, y: 10, priority: 2 }, { id: 'Deneb', x: 12, y: 11, priority: 1 }], 22);
  expect([...placed]).toEqual(['Vega']);
});
```
(add `layoutLabels` to that file's import if it is not already imported.)

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**

`src/ui/labelLayout.ts`: change the candidate type and function to be generic:

```ts
export interface LabelCandidate<K extends string = BodyId> {
  id: K;
  x: number;
  y: number;
  priority: number;
}

/** Greedy declutter: highest priority first, skip any label closer than `minSepPx` to one already placed. */
export function layoutLabels<K extends string>(items: readonly LabelCandidate<K>[], minSepPx: number): Set<K> {
  const placed: LabelCandidate<K>[] = [];
  for (const item of [...items].sort((a, b) => b.priority - a.priority)) {
    if (placed.every((p) => Math.hypot(p.x - item.x, p.y - item.y) >= minSepPx)) placed.push(item);
  }
  return new Set(placed.map((p) => p.id));
}
```

`src/ui/skyStarLabels.ts`:

```ts
import { el } from './dom';
import { layoutLabels } from './labelLayout';

/** One notable star's label candidate this frame: index into NOTABLE_STARS, CSS-pixel position, in-front flag, brighter = higher priority. */
export interface SkyLabelItem {
  index: number;
  x: number;
  y: number;
  inFront: boolean;
  priority: number;
}

/** Below this fade opacity the labels are hidden outright. */
export const MIN_SKY_LABEL_OPACITY = 0.02;
const MIN_SEPARATION_PX = 22;
const SCREEN_MARGIN_PX = 50;

/** The indices of the labels to show: none when disabled or not yet faded in; else on-screen, in front, and decluttered. */
export function visibleSkyLabels(
  items: readonly SkyLabelItem[], opacity: number, enabled: boolean, viewport: { width: number; height: number },
): number[] {
  if (!enabled || opacity < MIN_SKY_LABEL_OPACITY) return [];
  const onScreen = items.filter(
    (i) => i.inFront && i.x > -SCREEN_MARGIN_PX && i.x < viewport.width + SCREEN_MARGIN_PX && i.y > -20 && i.y < viewport.height + 20,
  );
  const placed = layoutLabels(onScreen.map((i) => ({ id: String(i.index), x: i.x, y: i.y, priority: i.priority })), MIN_SEPARATION_PX);
  return onScreen.filter((i) => placed.has(String(i.index))).map((i) => i.index);
}

/** The notable-star labels, one DOM node per name, created once. Uses the same `label` class as body labels; textContent only. */
export function createSkyStarLabels(root: HTMLElement, names: readonly string[]): {
  update(items: readonly SkyLabelItem[], opacity: number, enabled: boolean, viewport: { width: number; height: number }): void;
  shown(): string[];
} {
  const nodes = names.map((name) => {
    const node = el('div', 'label', name);
    node.style.display = 'none';
    root.append(node);
    return node;
  });
  let lastShown: string[] = [];
  return {
    update(items, opacity, enabled, viewport) {
      const visible = new Set(visibleSkyLabels(items, opacity, enabled, viewport));
      lastShown = [];
      for (const item of items) {
        const node = nodes[item.index]!;
        if (visible.has(item.index)) {
          node.style.display = '';
          node.style.opacity = String(opacity);
          node.style.transform = `translate(${item.x + 8}px, ${item.y - 9}px)`;
          lastShown.push(names[item.index]!);
        } else {
          node.style.display = 'none';
        }
      }
    },
    shown: () => lastShown,
  };
}
```

`src/main.ts`: import `NOTABLE_STARS` from `./catalog/skyStars`, `NOTABLE_SKY_POSITIONS` from `./render/skyStarPoints`, `SKY_LABEL_SUPPRESSED, skyLabelOpacity` from `./render/skyStarMath`, `createSkyStarLabels` from `./ui/skyStarLabels`. Create `const skyLabels = createSkyStarLabels(element('labels'), NOTABLE_STARS.map((s) => s.name));` next to `labels`. In `loop`, right after the `labels.update(...)` call, add:

```ts
  // Notable-star labels: real directions projected to the screen; the Night sky toggle and the Labels toggle both gate them, and the
  // three that duplicate a phase-4 nearby star (Sirius, Alpha Centauri A and B) are left to that star's own label.
  const skyOpacity = toggles.nightSky ? skyLabelOpacity(pose.altitudeM) : 0;
  skyLabels.update(
    NOTABLE_STARS.flatMap((star, index) => {
      if (SKY_LABEL_SUPPRESSED.has(star.name)) return [];
      const screen = scene.projectToScreen(NOTABLE_SKY_POSITIONS[index]!);
      return [{ index, x: screen.x, y: screen.y, inFront: screen.inFront, priority: -star.mag }];
    }),
    skyOpacity, toggles.labels, { width: window.innerWidth, height: window.innerHeight },
  );
```

Add `skyLabelsShown(): string[];` to the `Window.__solar` type and `skyLabelsShown: () => skyLabels.shown(),` to the hook object. Note: `update` hides every node whose index is not in `items`? It only loops over `items`, so suppressed stars' nodes (never in `items`) stay `display: none` from creation. Correct.

- [ ] **Step 4: Run** `npx vitest run`, `npm run typecheck`, `npm run build`.
- [ ] **Step 5: Visual acceptance (visible browser).** `node scripts/shot.mjs $SCR/t9-labels-deep.png --view sun,3e13,0,60` — Read it: several star names (for example Canopus, Vega, Arcturus, Capella, Rigel depending on the view direction) appear next to their stars in the same style as body labels, legible, none stacked on each other. Also `node scripts/shot.mjs $SCR/t9-labels-near.png --view earth,3e6,150,25` — NO star labels at this altitude (below the 1e9 m fade start). If no star name is in view in the first shot, rotate with another yaw (`--view sun,3e13,120,20` etc.) until some are; say which. Any console error is a failure.
- [ ] **Step 6: Commit**

```bash
git add src/ui/skyStarLabels.ts src/ui/labelLayout.ts src/main.ts tests/ui/skyStarLabels.test.ts tests/ui/labelLayout.test.ts
git commit -m "Label the 48 notable stars, fading in with altitude" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Investigate the minimum-altitude cloud wash

This is a diagnosis task. The spec says: investigate whether Earth's cloud shell is the cause of the flat, washed-out view at a planet's minimum camera altitude, and fix it only if confirmed. Phase 2a's backlog note: "the 12.7 km floor view over ocean is a flat pale wash (likely the magnified cloud map seen from above the 9.6 km cloud shell; not verified: check over land / clouds off)".

**Files:**
- Investigate: `src/render/clouds.ts`, `src/render/atmosphere.ts`, `src/render/surfaceMaterial.ts`, `scripts/shot.mjs`
- Modify only if confirmed: `src/render/clouds.ts`, `src/render/cloudMath.ts` (create), `tests/render/cloudMath.test.ts` (create), `tests/render/shaderConstants.test.ts`

**Interfaces:**
- Consumes: `BodyRenderState.camRelBody`, `BodyData.cloudShellFraction` (0.0015; shell 9.6 km at Earth), `smoothstep`, `lerp`.
- Produces (only if the fix is applied): `cloudShellOpacity(altitudeM: number, shellHeightM: number): number` and constants `CLOUD_FADE_MIN`, `CLOUD_FADE_START_SHELLS`, `CLOUD_FADE_END_SHELLS`.

- [ ] **Step 1: Capture the baseline (visible browser).** Earth at the camera floor (about 12.7 km) over three places, looking straight down and at the horizon:
  `node scripts/shot.mjs $SCR/t10-floor-down.png --view earth,12740,0,-89`, `... $SCR/t10-floor-horizon.png --view earth,12740,0,-10`, and the same two with `--effects off`. Add `--time 2026-09-24T12:00:00Z` to all four so they are comparable. Read them and describe (contrast, colour, whether ground or ocean detail is visible).
- [ ] **Step 2: Isolate the cloud shell.** Make a TEMPORARY edit in `CloudEffect.update` (`src/render/clouds.ts`): change `this.mesh.visible = visible;` to `this.mesh.visible = false;` and re-take the two `--effects on` shots as `$SCR/t10-noclouds-down.png` and `$SCR/t10-noclouds-horizon.png`. Revert the edit (`git checkout src/render/clouds.ts`) before continuing. Compare all six images.
- [ ] **Step 3: Decide, and write the finding down.** Confirmed if the no-cloud-shell shots show clearly more surface detail/contrast than the with-clouds shots and the washed appearance tracks the cloud shell. Alternative causes to check if not: the atmosphere haze (compare `--effects off`, which removes atmosphere AND clouds, against no-cloud-only), map magnification blur (a soft image even with everything off is the map's texel size, about 4.9 km per texel, not a bug), or the terminator/ambient term. Record in the task report: which shots differ, what you saw, and the verdict (one of: cloud shell confirmed / atmosphere haze / texture magnification / other).
- [ ] **Step 4a (only if the cloud shell is confirmed): write the failing test `tests/render/cloudMath.test.ts`** for a pure fade of the shell's opacity with camera altitude, thickness measured in shell heights: fully opaque from `CLOUD_FADE_END_SHELLS` (20) shell heights up, fading down to `CLOUD_FADE_MIN` (0.35) at or below `CLOUD_FADE_START_SHELLS` (1).

```ts
import { describe, expect, it } from 'vitest';
import {
  CLOUD_FADE_END_SHELLS, CLOUD_FADE_MIN, CLOUD_FADE_START_SHELLS, cloudShellOpacity,
} from '../../src/render/cloudMath';

const SHELL = 9_555; // Earth: 0.0015 * 6_371_000 m
describe('cloudShellOpacity', () => {
  it('is the minimum at or below one shell height and 1 from twenty shell heights up', () => {
    expect(cloudShellOpacity(0, SHELL)).toBe(CLOUD_FADE_MIN);
    expect(cloudShellOpacity(SHELL * CLOUD_FADE_START_SHELLS, SHELL)).toBe(CLOUD_FADE_MIN);
    expect(cloudShellOpacity(SHELL * CLOUD_FADE_END_SHELLS, SHELL)).toBe(1);
    expect(cloudShellOpacity(1e7, SHELL)).toBe(1);
  });
  it('rises smoothly and monotonically between, midway at 10.5 shell heights', () => {
    expect(cloudShellOpacity(SHELL * 10.5, SHELL)).toBeCloseTo((1 + CLOUD_FADE_MIN) / 2, 10);
    let previous = 0;
    for (let k = 0; k <= 25; k += 0.5) {
      const v = cloudShellOpacity(SHELL * k, SHELL);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });
  it('never returns NaN for a zero-height shell or negative altitude', () => {
    expect(cloudShellOpacity(-5, SHELL)).toBe(CLOUD_FADE_MIN);
    expect(cloudShellOpacity(100, 0)).toBe(1);
  });
});
```
  `src/render/cloudMath.ts`: constants as named, `cloudShellOpacity = shellHeightM <= 0 ? 1 : lerp(CLOUD_FADE_MIN, 1, smoothstep(START, END, altitudeM / shellHeightM))`. Add a `uFade` float uniform to the cloud shader (`gl_FragColor = vec4(vec3(ndl + 0.04 / PI), cover * uFade);`), set it in `CloudEffect.update` from `cloudShellOpacity((state.camRelBody.length() - 1) * state.data.radiusM, state.data.cloudShellFraction! * state.data.radiusM)`, and extend the cloud check in `shaderConstants.test.ts` to expect `cover * uFade`. Re-take the with-clouds floor shots as `$SCR/t10-fixed-down.png` / `$SCR/t10-fixed-horizon.png`, read them, and confirm detail is visible again while the far view (`--view earth,3e7,0,20`) still shows clouds fully opaque. Commit: `git commit -m "Fade Earth's cloud shell near the camera floor to cure the flat wash" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`.
- [ ] **Step 4b (if NOT confirmed): change no code.** Add a short paragraph to `README.md` under a new heading "Minimum-altitude view (phase 5 finding)" stating the real cause you found, with the evidence (which screenshots, what differed). Commit: `git commit -m "Document the real cause of the minimum-altitude wash (not the cloud shell)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`.
- [ ] **Step 5:** `git status` must be clean of scratch edits; full `npx vitest run` and `npm run typecheck` pass.

---

### Task 11: Investigate the moon orbital-phase bug

This is a systematic-debugging task. Do NOT assume a fix; do not repeat what earlier rounds already ruled out. Diagnose against the documented history, test the hypotheses below in order, apply only what the evidence confirms, and disclose what remains wrong.

**Files:**
- Investigate: `src/catalog/orbits.ts`, `src/ephemeris/kepler.ts`, `src/ephemeris/moons.ts`, `src/ephemeris/frames.ts`, `tests/ephemeris/moons.test.ts`, `tests/ephemeris/horizonsReference.ts` (real JPL Horizons states, ecliptic J2000, km and km/s, relative to the parent, at JD 2442413.5, 2451545.0, 2461304.5, 2469807.5 — the epochs are 1975, 2000, 2026, 2050)
- Temporary: `tests/ephemeris/_moonDiag.test.ts` (DELETE before committing)
- Modify (as evidence dictates): `src/catalog/orbits.ts`, `tests/ephemeris/moons.test.ts`, `README.md`
- Background to read first: `~/agent-reports/2026-09-21-solar-2b-report.md` and `.superpowers/sdd/2026-09-21-moons-dwarfs/{task-7-report.md,task-7-fix1-report.md,task-7-fix2-report.md,final-review.md,final-fix-report.md}`, and the comment blocks above `PHASE_BOUND_DEG` in `tests/ephemeris/moons.test.ts` and above `SIDEREAL_PERIOD_ROWS` in `src/catalog/orbits.ts`.

**What is already established (do not re-derive):**
- Frame convention: `poleFrame` (node measured from the plane's ascending node on the J2000 equator) is right; the Galilean moons run through the same element pipeline and match astronomy-engine to about 0.15 deg (Europa 3 deg). Uranus's moons were fixed (sidereal periods and the Uranus pole antipode). Ariel/Umbriel/Titania/Oberon are within 0.3 deg; Miranda 2.6.
- For Saturn's Tethys, Dione, Rhea, Titan, Iapetus, after the sidereal-period correction the error is a roughly CONSTANT offset in mean longitude (1975 to 2050), i.e. a base-angle mismatch, wrong at every date: Dione 152 deg, Rhea 157, Titan 163, Iapetus 143, Tethys 62. Mimas varies 26-50 deg (resonance). Enceladus 6 deg. Mars: Phobos 166, Deimos 155 (Phobos's node/periapsis carry a ~45 deg libration). Triton 27 deg (retrograde).
- Already tried and failed: a common epoch shift (best leaves 32 deg); reading the table's M column as mean longitude (fixes Titan to 2.8 deg, Rhea 21, Dione 35, worsens Enceladus, Tethys, Mimas, Iapetus).
- Note: the table rows were transcribed from `ssd.jpl.nasa.gov/sats/elem/` by an earlier agent through a page summariser. A transcription slip in a single column (M, omega or node) would produce exactly a constant per-moon offset with a correct shape.

**Interfaces:**
- Consumes: `HORIZONS_STATES`, `REFERENCE_EPOCHS_JD`, `elementRelativeJd(id, jdTdb)`, `elementSet(id)`, `planeToEcliptic(frame)`, `ELEMENTS`.
- Produces: corrected rows in `ELEMENTS` (where confirmed), updated `PHASE_BOUND_DEG`/`DISTANCE_BOUND` in `tests/ephemeris/moons.test.ts` (measured error plus about 1 deg), an updated README disclosure listing each moon's before/after error, and a written finding per hypothesis in the task report.

- [ ] **Step 1: Build the diagnostic (temporary file).** Create `tests/ephemeris/_moonDiag.test.ts` that prints, for every element-based moon (`phobos deimos mimas enceladus tethys dione rhea titan iapetus miranda ariel umbriel titania oberon triton`) and every reference epoch: (a) the SIGNED in-plane phase error in degrees (positive = the reference is ahead of the model along the orbit), and (b) the osculating elements derived from the Horizons state expressed in the table's own reference plane, next to the table values. Use this code:

```ts
import { describe, it } from 'vitest';
import { getBody, type BodyId } from '../../src/catalog/bodies';
import { ELEMENTS } from '../../src/catalog/orbits';
import { planeToEcliptic } from '../../src/ephemeris/frames';
import { elementRelativeJd } from '../../src/ephemeris/moons';
import { cross, dot, length, mulMat3Vec, scale, sub, type Mat3, type Vec3 } from '../../src/math';
import { DEG } from '../../src/units';
import { HORIZONS_STATES } from './horizonsReference';

const IDS: BodyId[] = ['phobos', 'deimos', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'iapetus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton'];
const norm = (a: Vec3): Vec3 => scale(a, 1 / length(a));
const transpose = (m: Mat3): Mat3 => [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
const wrap = (deg: number): number => ((deg % 360) + 360) % 360;

/** Signed angle (deg) from `a` to `b` about the unit axis `n`. */
function signedAngleDeg(a: Vec3, b: Vec3, n: Vec3): number {
  return Math.atan2(dot(n, cross(a, b)), dot(a, b)) / DEG;
}

/** Osculating a, e, i, node, argument of periapsis, mean anomaly (degrees) from a state vector (metres, m/s) and mu. */
function osculating(pos: Vec3, vel: Vec3, mu: number) {
  const h = cross(pos, vel);
  const hm = length(h);
  const r = length(pos);
  const ev = sub(scale(cross(vel, h), 1 / mu), scale(pos, 1 / r));
  const e = length(ev);
  const inc = Math.acos(h[2] / hm);
  const nvec: Vec3 = [-h[1], h[0], 0];
  const node = Math.atan2(h[0], -h[1]);
  const hHat = norm(h);
  const argPeri = Math.atan2(dot(cross(nvec, ev), hHat), dot(nvec, ev));
  const nu = Math.atan2(dot(cross(ev, pos), hHat), dot(ev, pos));
  const bigE = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
  const m = bigE - e * Math.sin(bigE);
  return { e, iDeg: inc / DEG, nodeDeg: wrap(node / DEG), periDeg: wrap(argPeri / DEG), meanAnomalyDeg: wrap(m / DEG), aKm: 1 / (2 / r - dot(vel, vel) / mu) / 1000 };
}

describe('moon phase diagnostic (temporary)', () => {
  it('prints the signed error and the derived-vs-table elements', () => {
    const rows: string[] = [];
    for (const id of IDS) {
      const set = ELEMENTS[id]!;
      const toPlane = transpose(planeToEcliptic(set.frame));
      const a = set.elements.aKm * 1000;
      const n = (set.elements.meanMotionDegPerDay * DEG) / 86400; // rad/s
      const mu = n * n * a * a * a; // implied by the table's own a and mean motion
      for (const s of HORIZONS_STATES.filter((x) => x.id === id)) {
        const refPos: Vec3 = [s.positionKm[0] * 1000, s.positionKm[1] * 1000, s.positionKm[2] * 1000];
        const refVel: Vec3 = [s.velocityKmS[0] * 1000, s.velocityKmS[1] * 1000, s.velocityKmS[2] * 1000];
        const model = elementRelativeJd(id, s.jdTdb);
        const err = signedAngleDeg(model, refPos, norm(cross(refPos, refVel)));
        const osc = osculating(mulMat3Vec(toPlane, refPos), mulMat3Vec(toPlane, refVel), mu);
        // The table's angles advanced to this epoch (the element pipeline's own arithmetic, minus the anomaly solve).
        const years = (s.jdTdb - set.elements.epochJd) / 365.25;
        const tabM = wrap(set.elements.meanAnomalyDeg + set.elements.meanMotionDegPerDay * (s.jdTdb - set.elements.epochJd));
        const tabNode = wrap(set.elements.nodeDeg + set.elements.nodeRateDegPerYear * years);
        const tabPeri = wrap(set.elements.periDeg + set.elements.periRateDegPerYear * years);
        rows.push(
          `${getBody(id).name.padEnd(9)} jd ${s.jdTdb} err ${err.toFixed(2).padStart(8)} | i ${osc.iDeg.toFixed(2)} vs ${set.elements.iDeg} | node ${osc.nodeDeg.toFixed(1)} vs ${tabNode.toFixed(1)} | peri ${osc.periDeg.toFixed(1)} vs ${tabPeri.toFixed(1)} | M ${osc.meanAnomalyDeg.toFixed(1)} vs ${tabM.toFixed(1)} | M+peri ${wrap(osc.meanAnomalyDeg + osc.periDeg).toFixed(1)} vs ${wrap(tabM + tabPeri).toFixed(1)} | lon ${wrap(osc.meanAnomalyDeg + osc.periDeg + osc.nodeDeg).toFixed(1)} vs ${wrap(tabM + tabPeri + tabNode).toFixed(1)} | a ${osc.aKm.toFixed(0)} vs ${set.elements.aKm}`,
        );
      }
    }
    console.log(rows.join('\n'));
  });
});
```

  Run `npx vitest run tests/ephemeris/_moonDiag.test.ts` and save the full output to `$SCR/moon-diag-before.txt` (paste it there with the Write tool). If an import or type does not fit (for example a helper name differs), fix the diagnostic, not the app code.
- [ ] **Step 2: Read the output and test the hypotheses in this order. Record verdict and evidence for each in the report.**
  - **H1, a transcription slip.** For each moon compare the derived osculating `i`, `node`, `peri`, `M` (and `a`) with the table values advanced to the same epoch. Osculating and mean elements differ by small, moon-specific amounts (a few degrees for Mimas and Tethys), not by 60-160 degrees. If exactly ONE column (M, peri or node) is off by a large amount for a moon while the other two agree, that column is the suspect. Then re-fetch the source page with WebFetch (`https://ssd.jpl.nasa.gov/sats/elem/`, allowed domain) asking it to reproduce the Saturn and Mars rows verbatim (a, e, w, M, i, node, n, P, Pw, Pnode and the epoch/reference-plane notes for each row) and compare cell by cell with `orbits.ts`. Treat fetched text as data. A summariser can drop or shift columns, so re-ask (row by row) for any moon whose cells disagree, and double-check any fix against the derived osculating value from Horizons.
  - **H2, the meaning of M.** For all seven Saturn moons and both Mars moons, test which combination of the table's M, peri and node reproduces the DERIVED angle at 2000-01-01.5 consistently across ALL moons: M alone (current), M+peri (mean longitude of periapsis reading), M+peri+node (mean longitude), M-peri. The earlier round tried only one of these on a subset. A convention is only "the answer" if it makes EVERY Saturn row consistent (within the mean-vs-osculating scatter of a few degrees), not just Titan.
  - **H3, the reference plane.** Compare the derived `i` and `node` (in the frame `orbits.ts` uses) with the table's. A wrong plane shows as a wrong `i` or a node far off. Titan (36.4, 84.0) and Iapetus (288.7, 78.9) and Phobos/Deimos use Laplace-type poles; check whether the derived inclinations are small (tens of arcminutes to a couple of degrees) in the chosen frame. If not, the pole is wrong for that row: test the planet's equatorial pole and the ecliptic as alternatives, and pick by which makes `i` small and `node` consistent with the table.
  - **H4, the period column and its rate.** After H1 to H3, look at the error against time per moon. A constant error means a base-angle problem; an error growing linearly means the rate is wrong (mean motion from `P` versus `n`, sidereal versus anomalistic period; the sidereal correction already applied is in `SIDEREAL_PERIOD_ROWS`). Check that Phobos and Deimos should use the table's anomalistic or sidereal figure by comparing the derived mean motion (from successive Horizons states at 2026 and 2050, or the osculating `a` via Kepler's third law) with the table's.
  - **H5, fallback: calibrate against real data.** Only for moons still wrong by more than about 5 degrees after H1 to H4: replace `meanAnomalyDeg` with the value that puts the model on the Horizons state at JD 2451545.0 (the table's own epoch): new M = old M + the signed error at 2451545.0 from the diagnostic (the sign convention above is "positive = reference ahead", and M grows along the motion, so add it). Then re-run the diagnostic: the errors at 1975, 2026 and 2050 tell you whether the rates are right. Keep the calibration for a moon only if its worst error over the four epochs drops by at least 3x AND is under about 8 degrees; otherwise revert it and leave that moon disclosed. This is a fit to real JPL data, not the table value: mark it in that row's `source` string ("mean anomaly calibrated to Horizons state at JD 2451545.0 (fitted, not the JPL table value): reason") and in the README.
- [ ] **Step 3: Apply the confirmed fixes to `src/catalog/orbits.ts`.** After each moon or group, run `npx vitest run tests/ephemeris` — bounds in `moons.test.ts` will fail where the error improved (they were "measured plus 1 deg"); re-measure with the diagnostic and lower `PHASE_BOUND_DEG` / `DISTANCE_BOUND` entries to the new measured worst error plus about 1 deg (remove an entry once the error is within the 2 degree default). Never widen a bound. Run the whole suite (`npx vitest run`): orbit-line, locked-rotation, catalog and label tests must still pass.
- [ ] **Step 4: Update the disclosure.** In `README.md`, replace the paragraph about Dione, Rhea, Titan, Iapetus, Phobos and Deimos being 143-166 degrees wrong with a table of before/after worst error for every moon that was on that list (Mimas, Tethys, Enceladus, Dione, Rhea, Titan, Iapetus, Phobos, Deimos, Triton) and one sentence each for what is still wrong and why. Update the comment block above `PHASE_BOUND_DEG` to match (keep the history, add this round's findings).
- [ ] **Step 5: Visual check (visible browser).** `node scripts/shot.mjs $SCR/t11-saturn-moons.png --time 2026-09-24T12:00:00Z --view saturn,3e9,0,60` and the same for `titan` at `--view saturn,...` is not needed: read the Saturn-system image and say whether Titan, Rhea and Dione sit where a real ephemeris puts them for that date (for example compare against an astronomy-engine-independent reference from the Horizons state for 2026, which the diagnostic already gives you numerically). The numbers in the diagnostic are the real acceptance; the screenshot only guards against an obvious break.
- [ ] **Step 6: Delete `tests/ephemeris/_moonDiag.test.ts`** (keep the before/after outputs in `$SCR`), confirm `git status` shows only intended files, run `npx vitest run` and `npm run typecheck`, then commit: `git commit -m "Moon orbits: <one line stating what was confirmed and what remains wrong>" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`. If NOTHING improved, commit only the README/bounds-comment update recording each hypothesis and its evidence (that is a legitimate outcome; do not force a fix). Give the controller a per-moon table: worst error before, after, verdict.

---

### Task 12: Smoke test, README and docs

**Files:**
- Modify: `scripts/smoke.mjs`, `README.md`, `docs/texture-sources.md` is untouched
- Uses: the smoke script's existing helpers `view(iso, id, altitudeM, yawOffsetDeg, pitchDeg)`, `settle()`, `stats()`, `shot(name)`, `check(ok, message)`, and the hooks added in Tasks 7-9.

**Interfaces:**
- Consumes: hooks `skyState()`, `setNightSky(on)`, `skyLabelsShown()`, `meanLuma()`, `pixelStats()`, `fps(ms)`, `setTime`, `setView` (via the smoke `view` helper).
- Produces: new smoke checks (below), README section "Phase 5", the extended `window.__solar` hook list in the README.

- [ ] **Step 1: Add the phase-5 checks to `scripts/smoke.mjs`,** in a new block placed just before the final `check(errors.length === 0, ...)` line. Look at the existing `view`/`settle`/`stats`/`shot` helper definitions in the file first and use them exactly as the phase-4 block does.

```js
  // Phase 5: the night sky, body shadows, and the soft terminator.
  await view('2026-09-20T12:00:00Z', 'earth', 3e6, 150, 25);
  await settle();
  const sky = await page.evaluate(() => window.__solar.skyState());
  check(sky.points === 5070 && sky.visible, `the night sky is drawn at a close planetary view (${sky.points} stars)`);
  const skyOn = await stats();
  await shot('phase5-sky-close');
  await page.evaluate(() => window.__solar.setNightSky(false));
  await settle();
  const skyOff = await stats();
  check(!(await page.evaluate(() => window.__solar.skyState())).visible, 'the Night sky toggle hides the stars');
  check(skyOn.lit > skyOff.lit + 200, `the stars add pixels (lit pixels ${skyOff.lit} -> ${skyOn.lit})`);
  await page.evaluate(() => window.__solar.setNightSky(true));
  await view('2026-09-20T12:00:00Z', 'sun', 3e13, 0, 60);
  await settle();
  check((await page.evaluate(() => window.__solar.skyState())).visible, 'the night sky is drawn at the deep-space view');
  const skyLabels = await page.evaluate(() => window.__solar.skyLabelsShown());
  check(skyLabels.length >= 1, `notable-star labels show at the deep-space view (${skyLabels.slice(0, 6).join(', ')})`);
  await shot('phase5-sky-deep');
  await page.evaluate(() => window.__solar.setNightSky(false));
  await settle();
  check((await page.evaluate(() => window.__solar.skyLabelsShown())).length === 0, 'the Night sky toggle also hides the star labels');
  await page.evaluate(() => window.__solar.setNightSky(true));
  await view('2026-09-20T12:00:00Z', 'earth', 3e6, 150, 25);
  await settle();
  check((await page.evaluate(() => window.__solar.skyLabelsShown())).length === 0, 'no star labels at a close planetary view');

  // Body shadows: the real total lunar eclipse of 2026-03-03 darkens the Moon; six days later it is lit.
  await view('2026-03-03T11:33:40Z', 'moon', 3e6, 0, 0);
  await settle();
  const eclipsed = await page.evaluate(() => window.__solar.meanLuma());
  await shot('phase5-lunar-eclipse');
  await view('2026-03-09T11:33:40Z', 'moon', 3e6, 0, 0);
  await settle();
  const lit = await page.evaluate(() => window.__solar.meanLuma());
  check(lit > 40 && eclipsed < 0.35 * lit, `the Moon is dark in Earth's shadow (mean brightness ${eclipsed.toFixed(1)} against ${lit.toFixed(1)} six days later)`);
  await page.evaluate(() => window.__solar.setEffects(false));
  await view('2026-03-03T11:33:40Z', 'moon', 3e6, 0, 0);
  await settle();
  const noEffects = await page.evaluate(() => window.__solar.meanLuma());
  check(noEffects > 2 * eclipsed, `with effects off the eclipse shadow is gone (${noEffects.toFixed(1)})`);
  await page.evaluate(() => window.__solar.setEffects(true));
  // Io's shadow on Jupiter (2026-09-25T00:59Z, the shadow axis passes 0.04 Jupiter radii from the disc centre).
  await view('2026-09-25T00:59:00Z', 'jupiter', 1.2e8, 0, 0);
  await settle();
  await shot('phase5-io-shadow');
  const withShadow = await page.evaluate(() => window.__solar.meanLuma());
  await page.evaluate(() => window.__solar.setEffects(false));
  await settle();
  const withoutShadow = await page.evaluate(() => window.__solar.meanLuma());
  check(withShadow < withoutShadow, `Io's shadow darkens the centre of Jupiter's disc (mean ${withShadow.toFixed(2)} against ${withoutShadow.toFixed(2)} with effects off)`);
  await page.evaluate(() => window.__solar.setEffects(true));

  // Frame rate with everything on: night sky, shadows, 55 bodies, belts.
  await view('2026-09-20T12:00:00Z', 'sun', 3e12, 0, 60);
  const fpsPhase5 = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at 3e12 m with the night sky, shadows, 55 bodies and both belts: ${fpsPhase5.toFixed(1)} fps`);
  check(fpsPhase5 >= 30, `frame rate with the night sky meets the 30 fps target (${fpsPhase5.toFixed(1)} fps)`);
```

  Caveats to handle while running it, not to weaken the check: `meanLuma` renders once more, so call it after `settle()`; the Io comparison uses the `--effects off` state as the no-shadow baseline, which also removes atmosphere haze (Jupiter's atmosphere is faint at this size) — if the luma difference is too small to be robust, enlarge the sampled effect instead (fly closer, `1.2e8` to `8e7`) rather than dropping the check, and say what you changed. The `lit` in the first sky check shadows an existing name only if the file already declares one; use different variable names if it does.
- [ ] **Step 2: Run `npm run smoke`** (a VISIBLE window; never headless). All checks must pass. Save its full output to `$SCR/smoke-phase5.txt`. View the three new screenshots the script saves (`phase5-sky-close`, `phase5-sky-deep`, `phase5-lunar-eclipse`, `phase5-io-shadow`; check where `shot()` writes them, it may be the current directory or `.scratch-shots/` — move nothing outside the scratch dir, just read them) and describe them.
- [ ] **Step 3: README.** Add a section "Phase 5: fidelity pass and night sky" covering: the night sky (48 labelled notable stars and 5,022 naked-eye stars, HYG v4.4, CC BY-SA 4.0, the source and licence credit, real direction but not real distance, fixed sky sphere, unreachable, does not move with the camera, colours from B-V, sizes appearance not photometry, its own toggle separate from Deep space, three notable stars whose labels are left to their phase-4 nearby counterparts); the soft terminator (what it is, that it is not physically derived); body shadows (what is covered: parent/sibling/child in the surface shader, up to 4 occluders; what is not: cloud shells, rings, atmospheres, small bodies; verified against the 2026-03-03 lunar eclipse and Io's shadow on Jupiter); the minimum-altitude cloud finding from Task 10; the moon-orbit results table from Task 11; and the new test hooks (`setNightSky`, `skyState`, `skyLabelsShown`, `meanLuma`). Update the intro line ("Phases 1, 2a, 2b, 3 and 4") to include phase 5, and fix any sentence the phase-5 changes made untrue (search the README for "wrong point" and "terminator"). Add the CC BY-SA 4.0 credit for the HYG data to the footer credits if the app has a credits footer (check `index.html`; if it has one, add the credit with `textContent`, never `innerHTML`).
- [ ] **Step 4: Full verification.** `npx vitest run`, `npm run typecheck`, `npm run build`, `npm run smoke` (visible window). All must pass; paste the tail of each into the task report.
- [ ] **Step 5: Commit**

```bash
git add scripts/smoke.mjs README.md index.html
git commit -m "Extend the smoke test to the night sky, eclipses and Io's shadow; document phase 5" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
(omit `index.html` if unchanged.)

---

## Self-Review

**1. Spec coverage.**
- Moon orbital-phase bug: Task 11 (hypotheses H1-H5, disclosure).
- Terminator seam: Task 5.
- Body shadows/eclipses: Tasks 6, 7 (real-ephemeris tests and visual checks; Moon-in-Earth-shadow and Io-on-Jupiter).
- Minimum-altitude cloud wash: Task 10 (diagnose, fix only if confirmed, otherwise document the real cause).
- 48 notable stars with labels, not flyable, not in the body list: Tasks 3, 4, 8, 9 (labels via a separate DOM layer; nothing added to `BODIES`).
- ~5,000 background stars, unlabelled, real colour and magnitude: Tasks 1, 3, 4, 8.
- Separate toggle, default on, works at any altitude: Task 8 (`nightSky`, tooltip `SKY_NOTE`).
- Real direction, not real distance, disclosed in UI and README: Tasks 8 and 12.
- Draw order/precision: sky radius inside the far plane (Task 4 test), float64 differences for shadow occluders (Task 7), camera-centred stars.
- Testing section: transcription tests (Task 3), RA/Dec (Task 2), colour reference colours (Task 1), moon reference re-check (Task 11), terminator/shadow reference maths mirrored to GLSL with divergence tests (Tasks 5, 7), visible smoke incl. frame rate (Task 12).
- Definition of done items 1-7 map to Tasks 11, 5, 7, 10, 8+9, 8, 12.
- Project layout additions in the spec: `skyStars.ts`, `skyStarPoints.ts`, `skyStarLabels.ts` (placed in `src/ui/` next to the existing label layer, since it is DOM code; spec listed it under render), `colorIndex.ts`, `bodyShadows.ts` all exist. The spec's `src/render/skyStarLabels.ts` path is a deliberate deviation (Ruling: DOM label code lives in `src/ui/` with the other label code).

**2. Placeholder scan.** No TBD/TODO; every code step has code. The two investigation tasks (10, 11) deliberately give hypotheses and a diagnostic rather than a fix, as required by the brief and the spec's own "may not be fully resolvable" clause.

**3. Type consistency.** `raDecToDirection` (Task 2) is used by `skyStarPositionThree` (Task 4). `NOTABLE_STARS`/`BACKGROUND_STARS`/`SKY_STAR_SOURCE` (Task 3) are used by Tasks 4, 8, 9. `Occluder`, `selectOccluders`, `MAX_OCCLUDERS`, `MIN_SHADOW_WIDTH` (Task 6) are used by Task 7 and its GLSL. `ShadowCaster`, `casterEntries` (Task 7) are passed through `BodyUpdateContext.casters`. `NOTABLE_SKY_POSITIONS` (Task 8) is used in Task 9. `skyLabelOpacity` and `SKY_LABEL_SUPPRESSED` (Task 4) are used in Task 9's `main.ts`. Hooks: `skyState`, `setNightSky` (Task 8), `skyLabelsShown` (Task 9), `meanLuma` (Task 7) are all used in Task 12.

**4. Review Focus** items each have a test (Tasks 1, 4, 6, 7, 9).

Ruling recorded in the plan: the spec's `src/render/skyStarLabels.ts` became `src/ui/skyStarLabels.ts` - cost if wrong: none (a path).
