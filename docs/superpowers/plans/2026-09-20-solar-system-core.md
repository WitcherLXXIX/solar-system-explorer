# Solar System Explorer, Phase 1 (Core Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser app where the user zooms continuously from 2% of a planet's radius above its surface out past Neptune, on one unbroken real scale, with real planetary positions, time control and a HUD.

**Architecture:** Simulation state is float64 metres in the heliocentric ecliptic J2000 frame. Every frame, all positions are subtracted from the camera position in float64 and only then handed to Three.js as float32, so the render camera is always at the origin. A logarithmic depth buffer covers the near/far range. Positions and orientations come from astronomy-engine.

**Tech Stack:** TypeScript 7, Vite 8, Three.js 0.186 (WebGL2), astronomy-engine 2.1.19, Vitest 5, playwright-core 1.63 driving the system Chromium (headed).

**Spec:** `docs/superpowers/specs/2026-09-20-solar-system-core-design.md`

## Global Constraints

- Node 26 / npm 12. Exact pinned versions: `three@0.186.0`, `astronomy-engine@2.1.19`, `@types/three@0.186.0`, `typescript@7.0.2`, `vite@8.3.0`, `vitest@5.0.1`, `playwright-core@1.63.0`. Install with `--save-exact`.
- Working directory for all commands: `/home/bobbywitcher/src/solar-system` (git repo already initialised, repo-local git identity already set; work on `main`, commit after every task).
- Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (pass it as a second `-m` argument).
- World frame: heliocentric ecliptic J2000, metres, float64, `z` = ecliptic north. Only the render layer converts to Three.js axes, using `three = (x, z, -y)`.
- Always pass a JS `Date` object to astronomy-engine, never a bare number (a number means days since J2000 there).
- Camera limits: minimum altitude is `0.02 x radius` of the focused body; maximum camera distance is the single constant `MAX_CAMERA_DISTANCE_M = 1.2e13`.
- **Any browser launched for testing MUST be headed and visible to the user** (`headless: false`), never headless. If there is no display (`DISPLAY`/`WAYLAND_DISPLAY` unset), stop and report; do not fall back to headless. Closing the window when finished is fine.
- No `innerHTML` with dynamic strings; use `textContent`. Strict TypeScript, no `any`.
- Tests live in `tests/` mirroring `src/` and use Vitest (`import { describe, expect, it } from 'vitest'`).
- Out of scope for phase 1 (do not build): moons, dwarf planets, belts, comets, atmospheres, rings, stars, hosting.

## File Structure

```
package.json  tsconfig.json  vite.config.ts  index.html  .gitignore  README.md
src/units.ts                   constants (AU, light speed, DEG ...)
src/math.ts                    Vec3/Mat3 types and float64 helpers
src/catalog/bodies.ts          static body data
src/ephemeris/ephemeris.ts     bodyPosition, bodyOrientation, orbitalPeriodDays, sampleOrbit
src/ephemeris/frame.ts         computeFrame(date) -> positions + orientations for every body
src/clock/clock.ts             SimClock
src/format/format.ts           number/distance/date/text formatting
src/camera/cameraController.ts focus + log-altitude camera with fly-to
src/render/cameraRelative.ts   pure render maths (camera-relative transform, sizes, opacity)
src/render/textures.ts         texture loading with flat-colour fallback
src/render/webgl.ts            WebGL2 availability check
src/render/bodyView.ts         one body: sphere mesh + sub-pixel sprite
src/render/orbitLine.ts        one orbit line, rebuilt camera-relative each frame
src/render/solarScene.ts       renderer, camera, lighting, per-frame render
src/ui/dom.ts                  tiny element helper
src/ui/input.ts                wheel / drag / pinch -> camera controller calls
src/ui/timeBar.ts  scaleReadout.ts  infoPanel.ts  bodyList.ts  toggles.ts
src/ui/labelLayout.ts          pure label declutter
src/ui/labels.ts               DOM labels
src/main.ts                    wiring + animation loop + window.__solar debug hook
src/style.css
scripts/fetch-textures.mjs     downloads the 2K textures
scripts/lib/browser.mjs        dev server + visible browser helpers
scripts/smoke.mjs  shot.mjs    headed smoke test and screenshot tool
tests/**                       Vitest suites mirroring src
```

---

### Task 1: Project scaffold, units and math helpers

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `src/units.ts`, `src/math.ts`
- Test: `tests/math.test.ts`

**Interfaces:**
- Produces (`src/units.ts`): `AU_M`, `C_M_S`, `LIGHT_YEAR_M`, `DEG`, `DAY_S`, `YEAR_S` (all `number`).
- Produces (`src/math.ts`): `type Vec3 = readonly [number, number, number]`; `type Mat3 = readonly [Vec3, Vec3, Vec3]` (three COLUMNS: body x, y, z axes); functions `add(a,b)`, `sub(a,b)`, `scale(a,k)`, `dot(a,b)`, `cross(a,b)`, `length(a)`, `lerpVec(a,b,t)` (all on `Vec3`), `clamp(x,lo,hi)`, `lerp(a,b,t)`, `smoothstep(e0,e1,x)`, `lerpAngle(a,b,t)` (radians, shortest path).

- [ ] **Step 1: Create the project files and install dependencies**

`package.json`:
```json
{
  "name": "solar-system",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "smoke": "node scripts/smoke.mjs",
    "textures": "node scripts/fetch-textures.mjs"
  }
}
```

Run:
```bash
npm install --save-exact three@0.186.0 astronomy-engine@2.1.19
npm install --save-dev --save-exact @types/three@0.186.0 playwright-core@1.63.0 typescript@7.0.2 vite@8.3.0 vitest@5.0.1
```
Expected: both succeed; `package.json` gains `dependencies` and `devDependencies` with exact versions.

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

`.gitignore`:
```
node_modules
dist
public/textures/*.jpg
*.log
```

- [ ] **Step 2: Write the failing test** — `tests/math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { add, clamp, cross, dot, lerp, lerpAngle, lerpVec, length, scale, smoothstep, sub } from '../src/math';
import { AU_M, C_M_S, DEG } from '../src/units';

describe('vector helpers', () => {
  it('adds, subtracts and scales', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });
  it('computes dot, cross and length', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(length([3, 4, 12])).toBe(13);
  });
  it('interpolates vectors', () => {
    expect(lerpVec([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });
});

describe('scalar helpers', () => {
  it('clamps and lerps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
  it('smoothsteps between edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
  });
  it('lerps angles along the shortest path', () => {
    expect(lerpAngle(170 * DEG, -170 * DEG, 0.5)).toBeCloseTo(Math.PI, 12);
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 12);
  });
});

describe('units', () => {
  it('uses the exact IAU astronomical unit and speed of light', () => {
    expect(AU_M).toBe(149_597_870_700);
    expect(C_M_S).toBe(299_792_458);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/math.test.ts`
Expected: FAIL (cannot resolve `../src/math`).

- [ ] **Step 4: Write the implementation**

`src/units.ts`:
```ts
export const AU_M = 149_597_870_700;
export const C_M_S = 299_792_458;
export const DAY_S = 86_400;
export const YEAR_S = 365.25 * DAY_S;
export const LIGHT_YEAR_M = C_M_S * YEAR_S;
export const DEG = Math.PI / 180;
```

`src/math.ts`:
```ts
export type Vec3 = readonly [number, number, number];
/** Three COLUMNS: the body's x, y and z axes expressed in world coordinates. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Interpolates angles (radians) along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * t;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing and exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold project with units and math helpers" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Body catalog

**Files:**
- Create: `src/catalog/bodies.ts`
- Test: `tests/catalog/bodies.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'`; `interface BodyData { id: BodyId; name: string; kind: 'star' | 'planet'; radiusM: number; massKg: number; rotationPeriodH: number /* sidereal, negative = retrograde */; axialTiltDeg: number; surfaceGravity: number /* m/s2 */; meanTempK: number; tempNote?: string; texture: string /* file stem in public/textures */; color: string /* CSS hex */; source: string }`; `BODIES: readonly BodyData[]` (Sun first, then by distance); `BODY_IDS: readonly BodyId[]`; `getBody(id: BodyId): BodyData`.

- [ ] **Step 1: Write the failing test** — `tests/catalog/bodies.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BODIES, BODY_IDS, getBody } from '../../src/catalog/bodies';

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
      expect(b.texture.length, b.id).toBeGreaterThan(0);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/catalog`
Expected: FAIL (cannot resolve `../../src/catalog/bodies`).

- [ ] **Step 3: Write the implementation** — `src/catalog/bodies.ts`:

```ts
export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

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
  /** File stem in public/textures (without .jpg). */
  texture: string;
  /** CSS colour used for the flat fallback, sprites and orbit lines. */
  color: string;
  source: string;
}

const PLANET_SOURCE = 'NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet)';

export const BODIES: readonly BodyData[] = [
  {
    id: 'sun', name: 'Sun', kind: 'star', radiusM: 695_700_000, massKg: 1.9885e30, rotationPeriodH: 609.12,
    axialTiltDeg: 7.25, surfaceGravity: 274.0, meanTempK: 5772, tempNote: 'effective temperature of the photosphere',
    texture: '2k_sun', color: '#ffd27a', source: 'NASA Sun Fact Sheet; IAU 2015 nominal solar values',
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', radiusM: 2_439_400, massKg: 3.30e23, rotationPeriodH: 1407.6,
    axialTiltDeg: 0.034, surfaceGravity: 3.7, meanTempK: 440.15, texture: '2k_mercury', color: '#a8a29e', source: PLANET_SOURCE,
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', radiusM: 6_051_800, massKg: 4.87e24, rotationPeriodH: -5832.5,
    axialTiltDeg: 177.4, surfaceGravity: 8.9, meanTempK: 737.15, texture: '2k_venus_surface', color: '#e3c07a', source: PLANET_SOURCE,
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', radiusM: 6_371_000, massKg: 5.97e24, rotationPeriodH: 23.9345,
    axialTiltDeg: 23.4, surfaceGravity: 9.8, meanTempK: 288.15, texture: '2k_earth_daymap', color: '#4f86d6', source: PLANET_SOURCE,
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', radiusM: 3_389_500, massKg: 6.42e23, rotationPeriodH: 24.6229,
    axialTiltDeg: 25.2, surfaceGravity: 3.7, meanTempK: 208.15, texture: '2k_mars', color: '#c1440e', source: PLANET_SOURCE,
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', radiusM: 69_911_000, massKg: 1.898e27, rotationPeriodH: 9.925,
    axialTiltDeg: 3.1, surfaceGravity: 23.1, meanTempK: 163.15, tempNote: 'at the 1 bar level',
    texture: '2k_jupiter', color: '#c99b6d', source: PLANET_SOURCE,
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', radiusM: 58_232_000, massKg: 5.68e26, rotationPeriodH: 10.656,
    axialTiltDeg: 26.7, surfaceGravity: 9.0, meanTempK: 133.15, tempNote: 'at the 1 bar level',
    texture: '2k_saturn', color: '#e0c98f', source: PLANET_SOURCE,
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', radiusM: 25_362_000, massKg: 8.68e25, rotationPeriodH: -17.24,
    axialTiltDeg: 97.8, surfaceGravity: 8.7, meanTempK: 78.15, tempNote: 'at the 1 bar level',
    texture: '2k_uranus', color: '#9fd8e0', source: PLANET_SOURCE,
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', radiusM: 24_622_000, massKg: 1.02e26, rotationPeriodH: 16.11,
    axialTiltDeg: 28.3, surfaceGravity: 11.0, meanTempK: 73.15, tempNote: 'at the 1 bar level',
    texture: '2k_neptune', color: '#4a6fe0', source: PLANET_SOURCE,
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

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add body catalog with NASA fact-sheet data" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Ephemeris (positions, orientation, orbits, frame)

**Files:**
- Create: `src/ephemeris/ephemeris.ts`, `src/ephemeris/frame.ts`
- Test: `tests/ephemeris/ephemeris.test.ts`, `tests/ephemeris/frame.test.ts`

**Interfaces:**
- Consumes: `BodyId`, `BODY_IDS` from `src/catalog/bodies`; `Vec3`, `Mat3` from `src/math`; `AU_M`, `DEG`, `DAY_S` from `src/units`.
- Produces (`ephemeris.ts`): `bodyPosition(id: BodyId, date: Date): Vec3` (metres, heliocentric ecliptic J2000); `bodyOrientation(id: BodyId, date: Date): Mat3` (columns = body x, y, z axes in the ecliptic frame; z is the north pole, x points at the prime meridian on the equator); `orbitalPeriodDays(id: BodyId): number | null` (null for the Sun); `sampleOrbit(id: BodyId, start: Date, count: number): Float64Array` (xyz triples in metres over one period from `start`).
- Produces (`frame.ts`): `interface FrameEntry { position: Vec3; orientation: Mat3 }`; `type Frame = Record<BodyId, FrameEntry>`; `computeFrame(date: Date): Frame`.

astronomy-engine facts (verified): `HelioVector(body, date)` returns AU in the EQJ frame; `Rotation_EQJ_ECL()` + `RotateVector(rotation, vector)` convert to ecliptic; `RotationAxis(body, date)` returns `{ ra /* sidereal HOURS */, dec /* degrees */, spin /* degrees, prime-meridian angle W */ }`; `PlanetOrbitalPeriod(body)` returns days; the `Body` enum values are strings.

- [ ] **Step 1: Write the failing tests** — `tests/ephemeris/ephemeris.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bodyOrientation, bodyPosition, orbitalPeriodDays, sampleOrbit } from '../../src/ephemeris/ephemeris';
import { cross, dot, length } from '../../src/math';
import { AU_M, DEG } from '../../src/units';

const J2000 = new Date('2000-01-01T12:00:00Z');
const au = (m: number) => m / AU_M;

describe('bodyPosition', () => {
  it('puts the Sun at the origin', () => {
    const p = bodyPosition('sun', J2000);
    expect(length(p)).toBeLessThan(1);
  });
  it('places Earth at the known ecliptic J2000 position', () => {
    const p = bodyPosition('earth', J2000);
    expect(au(p[0])).toBeCloseTo(-0.17714, 3);
    expect(au(p[1])).toBeCloseTo(0.96723, 3);
    expect(Math.abs(au(p[2]))).toBeLessThan(1e-3);
  });
  it('gets Earth perihelion and aphelion distances right', () => {
    expect(au(length(bodyPosition('earth', new Date('2026-01-03T17:00:00Z'))))).toBeCloseTo(0.9833, 3);
    expect(au(length(bodyPosition('earth', new Date('2026-07-06T18:00:00Z'))))).toBeCloseTo(1.0167, 3);
  });
  it('places Neptune about 30 AU away', () => {
    const p = bodyPosition('neptune', J2000);
    expect(au(p[0])).toBeCloseTo(16.813, 2);
    expect(au(p[1])).toBeCloseTo(-24.991, 2);
    expect(au(length(p))).toBeCloseTo(30.12, 1);
  });
});

describe('orbitalPeriodDays', () => {
  it('is null for the Sun and correct for planets', () => {
    expect(orbitalPeriodDays('sun')).toBeNull();
    expect(orbitalPeriodDays('earth')).toBeCloseTo(365.256, 1);
    expect(orbitalPeriodDays('neptune')).toBeGreaterThan(60_000);
    expect(orbitalPeriodDays('neptune')).toBeLessThan(60_400);
  });
});

describe('bodyOrientation', () => {
  it('returns orthonormal right-handed axes', () => {
    const [x, y, z] = bodyOrientation('mars', J2000);
    expect(length(x)).toBeCloseTo(1, 9);
    expect(length(y)).toBeCloseTo(1, 9);
    expect(length(z)).toBeCloseTo(1, 9);
    expect(dot(x, y)).toBeCloseTo(0, 9);
    expect(dot(x, z)).toBeCloseTo(0, 9);
    const c = cross(x, y);
    expect(dot(c, z)).toBeCloseTo(1, 9);
  });
  it('tilts Earth by about 23.4 degrees from the ecliptic pole', () => {
    const z = bodyOrientation('earth', J2000)[2];
    expect(Math.acos(z[2]) / DEG).toBeCloseTo(23.44, 1);
  });
  it('points Earth\'s prime meridian where Greenwich sidereal time says at J2000', () => {
    // GMST at J2000.0 is 280.4606 deg, so Greenwich is at RA 280.46 deg on the equator.
    // Converting that direction to the ecliptic (obliquity 23.4393 deg) gives about (0.1816, -0.9022, 0.3912).
    const x = bodyOrientation('earth', J2000)[0];
    expect(x[0]).toBeCloseTo(0.1816, 2);
    expect(x[1]).toBeCloseTo(-0.9022, 2);
    expect(x[2]).toBeCloseTo(0.3912, 2);
  });
  it('lays Uranus on its side and spins it retrograde (IAU convention)', () => {
    // The IAU north pole of Uranus points about 82 degrees from ecliptic north, and W decreases with time.
    const a = bodyOrientation('uranus', J2000);
    const tilt = Math.acos(a[2][2]) / DEG;
    expect(tilt).toBeGreaterThan(80);
    expect(tilt).toBeLessThan(84);
    const later = bodyOrientation('uranus', new Date(J2000.getTime() + 3_600_000));
    expect(dot(cross(a[0], later[0]), a[2])).toBeLessThan(0);
  });
  it('spins Earth once per sidereal day, prograde', () => {
    const period = 86_164.0989 * 1000;
    const a = bodyOrientation('earth', J2000);
    const full = bodyOrientation('earth', new Date(J2000.getTime() + period));
    const half = bodyOrientation('earth', new Date(J2000.getTime() + period / 2));
    expect(dot(a[0], full[0])).toBeGreaterThan(Math.cos(0.05 * DEG));
    expect(dot(a[0], half[0])).toBeLessThan(-0.9999);
    const later = bodyOrientation('earth', new Date(J2000.getTime() + 3_600_000));
    expect(dot(cross(a[0], later[0]), a[2])).toBeGreaterThan(0);
  });
  it('spins Venus retrograde', () => {
    const a = bodyOrientation('venus', J2000);
    const later = bodyOrientation('venus', new Date(J2000.getTime() + 86_400_000));
    expect(dot(cross(a[0], later[0]), a[2])).toBeLessThan(0);
  });
});

describe('sampleOrbit', () => {
  it('samples one closed orbit starting at the given date', () => {
    const samples = sampleOrbit('earth', J2000, 720);
    expect(samples.length).toBe(720 * 3);
    const start = bodyPosition('earth', J2000);
    expect(samples[0]).toBeCloseTo(start[0], 0);
    expect(samples[1]).toBeCloseTo(start[1], 0);
    for (let i = 0; i < 720; i++) {
      const r = au(Math.hypot(samples[3 * i]!, samples[3 * i + 1]!, samples[3 * i + 2]!));
      expect(r).toBeGreaterThan(0.98);
      expect(r).toBeLessThan(1.02);
    }
  });
  it('refuses the Sun', () => {
    expect(() => sampleOrbit('sun', J2000, 10)).toThrow();
  });
});
```

`tests/ephemeris/frame.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BODY_IDS } from '../../src/catalog/bodies';
import { computeFrame } from '../../src/ephemeris/frame';

describe('computeFrame', () => {
  it('has an entry for every body with finite numbers', () => {
    const frame = computeFrame(new Date('2026-09-20T12:00:00Z'));
    for (const id of BODY_IDS) {
      const entry = frame[id];
      expect(entry.position.every(Number.isFinite), id).toBe(true);
      expect(entry.orientation.every((axis) => axis.every(Number.isFinite)), id).toBe(true);
    }
    expect(Math.hypot(...frame.sun.position)).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ephemeris`
Expected: FAIL (cannot resolve modules).

- [ ] **Step 3: Write the implementation**

`src/ephemeris/ephemeris.ts`:
```ts
import {
  Body, HelioVector, MakeTime, PlanetOrbitalPeriod, RotateVector, Rotation_EQD_EQJ, Rotation_EQJ_ECL,
  RotationAxis, SiderealTime, Vector,
} from 'astronomy-engine';
import type { BodyId } from '../catalog/bodies';
import type { Mat3, Vec3 } from '../math';
import { AU_M, DAY_S, DEG } from '../units';

const AE_BODY: Record<BodyId, Body> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

const EQJ_TO_ECL = Rotation_EQJ_ECL();

/** Heliocentric position in metres, ecliptic J2000 frame. */
export function bodyPosition(id: BodyId, date: Date): Vec3 {
  const v = RotateVector(EQJ_TO_ECL, HelioVector(AE_BODY[id], date));
  return [v.x * AU_M, v.y * AU_M, v.z * AU_M];
}

function rotZ(v: Vec3, t: number): Vec3 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
}

function rotX(v: Vec3, t: number): Vec3 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}

/**
 * Body axes in the ecliptic frame (columns x, y, z; z = north pole, x = prime meridian on the equator).
 *
 * Most bodies use the IAU rotation model from astronomy-engine's RotationAxis:
 * R = Rz(alpha + 90 deg) * Rx(90 deg - delta) * Rz(W), body-fixed to EQJ, then EQJ to ecliptic.
 *
 * Earth is special-cased. Its pole is only about 8 arcseconds from the celestial pole, so the right
 * ascension that RotationAxis reports is ill-conditioned and the frame built from it was measured to be
 * 134 degrees off at J2000 and drifting. Instead Earth's prime meridian (Greenwich) is placed from
 * Greenwich apparent sidereal time in the true equator of date, then rotated to EQJ and the ecliptic.
 */
export function bodyOrientation(id: BodyId, date: Date): Mat3 {
  const time = MakeTime(date);
  const toEcliptic = (eqj: Vec3): Vec3 => {
    const r = RotateVector(EQJ_TO_ECL, new Vector(eqj[0], eqj[1], eqj[2], time));
    return [r.x, r.y, r.z];
  };

  if (id === 'earth') {
    const gast = SiderealTime(time) * 15 * DEG; // hours to degrees to radians
    const eqdToEqj = Rotation_EQD_EQJ(time);
    const column = (e: Vec3): Vec3 => {
      const eqd = rotZ(e, gast);
      const eqj = RotateVector(eqdToEqj, new Vector(eqd[0], eqd[1], eqd[2], time));
      return toEcliptic([eqj.x, eqj.y, eqj.z]);
    };
    return [column([1, 0, 0]), column([0, 1, 0]), column([0, 0, 1])];
  }

  const axis = RotationAxis(AE_BODY[id], date);
  const alpha = axis.ra * 15 * DEG; // astronomy-engine gives right ascension in sidereal hours
  const delta = axis.dec * DEG;
  const w = axis.spin * DEG;
  const column = (e: Vec3): Vec3 =>
    toEcliptic(rotZ(rotX(rotZ(e, w), Math.PI / 2 - delta), alpha + Math.PI / 2));
  return [column([1, 0, 0]), column([0, 1, 0]), column([0, 0, 1])];
}

export function orbitalPeriodDays(id: BodyId): number | null {
  return id === 'sun' ? null : PlanetOrbitalPeriod(AE_BODY[id]);
}

/** `count` positions (xyz triples, metres) evenly spaced in time over one orbital period from `start`. */
export function sampleOrbit(id: BodyId, start: Date, count: number): Float64Array {
  const period = orbitalPeriodDays(id);
  if (period === null) throw new Error(`${id} has no orbit to sample`);
  const out = new Float64Array(count * 3);
  for (let k = 0; k < count; k++) {
    const date = new Date(start.getTime() + (k / count) * period * DAY_S * 1000);
    out.set(bodyPosition(id, date), 3 * k);
  }
  return out;
}
```

`src/ephemeris/frame.ts`:
```ts
import { BODY_IDS, type BodyId } from '../catalog/bodies';
import type { Mat3, Vec3 } from '../math';
import { bodyOrientation, bodyPosition } from './ephemeris';

export interface FrameEntry {
  position: Vec3;
  orientation: Mat3;
}
export type Frame = Record<BodyId, FrameEntry>;

export function computeFrame(date: Date): Frame {
  const frame = {} as Record<BodyId, FrameEntry>;
  for (const id of BODY_IDS) {
    frame[id] = { position: bodyPosition(id, date), orientation: bodyOrientation(id, date) };
  }
  return frame;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS. If the Earth-rotation or Venus-retrograde test fails, the handedness or the IAU rotation composition is wrong: fix the implementation, not the test (the tests encode physical facts).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add ephemeris: positions, IAU orientation, orbit sampling, frame" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Simulation clock

**Files:**
- Create: `src/clock/clock.ts`
- Test: `tests/clock/clock.test.ts`

**Interfaces:**
- Consumes: `clamp` from `src/math`.
- Produces: `SPEED_STEPS: readonly [1, 60, 3600, 86400, 2592000, 31557600]` (simulated seconds per real second); `MIN_TIME_MS`, `MAX_TIME_MS` (1700-01-01 and 2300-01-01 UTC); `class SimClock` with `constructor(startMs: number)`, getters `timeMs: number`, `date: Date`, `rate: number`, `playing: boolean`, and methods `tick(realDtS: number): void`, `play()`, `pause()`, `toggle()`, `setRate(rate: number)`, `reverse()`, `setTimeMs(ms: number)`, `resetToNow(nowMs: number)`.

- [ ] **Step 1: Write the failing test** — `tests/clock/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_TIME_MS, MIN_TIME_MS, SPEED_STEPS, SimClock } from '../../src/clock/clock';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);

describe('SimClock', () => {
  it('starts playing at real time', () => {
    const c = new SimClock(T0);
    expect(c.playing).toBe(true);
    expect(c.rate).toBe(1);
    expect(c.timeMs).toBe(T0);
    expect(c.date.getTime()).toBe(T0);
  });
  it('advances by rate x real seconds', () => {
    const c = new SimClock(T0);
    c.setRate(86_400);
    c.tick(0.5);
    expect(c.timeMs).toBe(T0 + 43_200_000);
  });
  it('runs backwards with a negative rate and reverse()', () => {
    const c = new SimClock(T0);
    c.setRate(3600);
    c.reverse();
    expect(c.rate).toBe(-3600);
    c.tick(1);
    expect(c.timeMs).toBe(T0 - 3_600_000);
  });
  it('does not advance while paused', () => {
    const c = new SimClock(T0);
    c.pause();
    c.tick(10);
    expect(c.timeMs).toBe(T0);
    c.toggle();
    expect(c.playing).toBe(true);
  });
  it('clamps to the supported range and pauses at the edge', () => {
    const c = new SimClock(MAX_TIME_MS - 1000);
    c.setRate(SPEED_STEPS[5]);
    c.tick(1);
    expect(c.timeMs).toBe(MAX_TIME_MS);
    expect(c.playing).toBe(false);
    const d = new SimClock(MIN_TIME_MS + 1000);
    d.setRate(-SPEED_STEPS[5]);
    d.tick(1);
    expect(d.timeMs).toBe(MIN_TIME_MS);
    expect(d.playing).toBe(false);
  });
  it('clamps setTimeMs and constructor input', () => {
    const c = new SimClock(0);
    c.setTimeMs(Number.MAX_SAFE_INTEGER);
    expect(c.timeMs).toBe(MAX_TIME_MS);
    expect(new SimClock(Date.UTC(1500, 0, 1)).timeMs).toBe(MIN_TIME_MS);
  });
  it('resets to now at real time and resumes', () => {
    const c = new SimClock(T0);
    c.setRate(86_400);
    c.pause();
    c.resetToNow(T0 + 5000);
    expect(c.timeMs).toBe(T0 + 5000);
    expect(c.rate).toBe(1);
    expect(c.playing).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/clock`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the implementation** — `src/clock/clock.ts`:

```ts
import { clamp } from '../math';

/** Simulated seconds per real second: real time, 1 min, 1 h, 1 day, 30 days, 1 year. */
export const SPEED_STEPS = [1, 60, 3600, 86_400, 2_592_000, 31_557_600] as const;

/** Well inside the date range astronomy-engine supports accurately. */
export const MIN_TIME_MS = Date.UTC(1700, 0, 1);
export const MAX_TIME_MS = Date.UTC(2300, 0, 1);

export class SimClock {
  private ms: number;
  private rateValue = 1;
  private playingValue = true;

  constructor(startMs: number) {
    this.ms = clamp(startMs, MIN_TIME_MS, MAX_TIME_MS);
  }

  get timeMs(): number {
    return this.ms;
  }
  get date(): Date {
    return new Date(this.ms);
  }
  get rate(): number {
    return this.rateValue;
  }
  get playing(): boolean {
    return this.playingValue;
  }

  tick(realDtS: number): void {
    if (!this.playingValue) return;
    const next = this.ms + this.rateValue * realDtS * 1000;
    if (next <= MIN_TIME_MS) {
      this.ms = MIN_TIME_MS;
      this.playingValue = false;
    } else if (next >= MAX_TIME_MS) {
      this.ms = MAX_TIME_MS;
      this.playingValue = false;
    } else {
      this.ms = next;
    }
  }

  play(): void {
    this.playingValue = true;
  }
  pause(): void {
    this.playingValue = false;
  }
  toggle(): void {
    this.playingValue = !this.playingValue;
  }
  setRate(rate: number): void {
    this.rateValue = rate;
  }
  reverse(): void {
    this.rateValue = -this.rateValue;
  }
  setTimeMs(ms: number): void {
    this.ms = clamp(ms, MIN_TIME_MS, MAX_TIME_MS);
  }
  resetToNow(nowMs: number): void {
    this.ms = clamp(nowMs, MIN_TIME_MS, MAX_TIME_MS);
    this.rateValue = 1;
    this.playingValue = true;
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add simulation clock" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Formatting

**Files:**
- Create: `src/format/format.ts`
- Test: `tests/format/format.test.ts`

**Interfaces:**
- Consumes: `AU_M`, `C_M_S`, `LIGHT_YEAR_M`, `YEAR_S` from `src/units`.
- Produces (all `(...) => string` unless noted): `formatDistance(m)`, `formatLightTime(m)`, `formatDate(ms)`, `formatPeriodDays(days)`, `formatHours(hours)`, `formatMass(kg)`, `formatRadius(m)`, `formatTemp(kelvin)`, `formatSpeed(rate, playing)`, and `niceLength(m): number` (rounds down to 1, 2 or 5 x 10^n).

- [ ] **Step 1: Write the failing test** — `tests/format/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatDate, formatDistance, formatHours, formatLightTime, formatMass, formatPeriodDays,
  formatRadius, formatSpeed, formatTemp, niceLength,
} from '../../src/format/format';

describe('formatDistance', () => {
  it('picks metres, km, AU or light-years', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(12.3)).toBe('12.3 m');
    expect(formatDistance(1500)).toBe('1.50 km');
    expect(formatDistance(6_371_000)).toBe('6,371 km');
    expect(formatDistance(149_597_870_700)).toBe('1.00 AU');
    expect(formatDistance(4.5e12)).toBe('30.1 AU');
    expect(formatDistance(4.0e16)).toBe('4.23 ly');
  });
});

describe('formatLightTime', () => {
  it('picks seconds, minutes, hours, days or years', () => {
    expect(formatLightTime(3.844e8)).toBe('1.28 light-s');
    expect(formatLightTime(149_597_870_700)).toBe('8.32 light-min');
    expect(formatLightTime(4.5e12)).toBe('4.17 light-h');
    expect(formatLightTime(1.0e15)).toBe('38.6 light-days');
    expect(formatLightTime(4.0e16)).toBe('4.23 light-yr');
  });
});

describe('formatDate', () => {
  it('formats UTC to the minute', () => {
    expect(formatDate(Date.UTC(2026, 8, 20, 13, 5))).toBe('2026-09-20 13:05 UTC');
  });
});

describe('facts', () => {
  it('formats orbital periods', () => {
    expect(formatPeriodDays(87.97)).toBe('88.0 days');
    expect(formatPeriodDays(365.256)).toBe('365 days');
    expect(formatPeriodDays(4332.6)).toBe('11.9 years');
  });
  it('formats rotation periods, flagging retrograde', () => {
    expect(formatHours(23.9345)).toBe('23.9 h');
    expect(formatHours(1407.6)).toBe('58.6 days');
    expect(formatHours(-5832.5)).toBe('243 days (retrograde)');
  });
  it('formats mass, radius and temperature', () => {
    expect(formatMass(5.972e24)).toBe('5.97 × 10²⁴ kg');
    expect(formatMass(1.9885e30)).toBe('1.99 × 10³⁰ kg');
    expect(formatRadius(6_371_000)).toBe('6,371 km');
    expect(formatTemp(288.15)).toBe('288 K (15 °C)');
  });
});

describe('formatSpeed', () => {
  it('names the time-lapse rate', () => {
    expect(formatSpeed(1, true)).toBe('1× real time');
    expect(formatSpeed(60, true)).toBe('1 min/s');
    expect(formatSpeed(3600, true)).toBe('1 h/s');
    expect(formatSpeed(86_400, true)).toBe('1 day/s');
    expect(formatSpeed(2_592_000, true)).toBe('1 month/s');
    expect(formatSpeed(-31_557_600, true)).toBe('−1 yr/s');
    expect(formatSpeed(86_400, false)).toBe('paused');
  });
});

describe('niceLength', () => {
  it('rounds down to 1, 2 or 5 x 10^n', () => {
    expect(niceLength(730)).toBe(500);
    expect(niceLength(1.9e6)).toBe(1e6);
    expect(niceLength(2.0e6)).toBe(2e6);
    expect(niceLength(9.9e9)).toBe(5e9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/format`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the implementation** — `src/format/format.ts`:

```ts
import { AU_M, C_M_S, LIGHT_YEAR_M, YEAR_S } from '../units';

/** Three significant figures below 100, whole numbers with thousands separators from 100 up. */
function num(n: number): string {
  return n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toPrecision(3);
}

export function formatDistance(m: number): string {
  if (m < 1_000) return `${num(m)} m`;
  if (m < 1e10) return `${num(m / 1_000)} km`;
  if (m < 1.5e14) return `${num(m / AU_M)} AU`;
  return `${num(m / LIGHT_YEAR_M)} ly`;
}

export function formatLightTime(m: number): string {
  const s = m / C_M_S;
  if (s < 60) return `${num(s)} light-s`;
  if (s < 3_600) return `${num(s / 60)} light-min`;
  if (s < 86_400) return `${num(s / 3_600)} light-h`;
  if (s < YEAR_S) return `${num(s / 86_400)} light-days`;
  return `${num(s / YEAR_S)} light-yr`;
}

export function formatDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function formatPeriodDays(days: number): string {
  return days < 1000 ? `${num(days)} days` : `${num(days / 365.25)} years`;
}

export function formatHours(hours: number): string {
  const a = Math.abs(hours);
  const text = a < 48 ? `${num(a)} h` : `${num(a / 24)} days`;
  return hours < 0 ? `${text} (retrograde)` : text;
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

export function formatMass(kg: number): string {
  const [mantissa, exponent] = kg.toExponential(2).split('e') as [string, string];
  const power = [...String(Number(exponent))].map((c) => SUPERSCRIPT[c] ?? c).join('');
  return `${mantissa} × 10${power} kg`;
}

export function formatRadius(m: number): string {
  return `${num(m / 1000)} km`;
}

export function formatTemp(kelvin: number): string {
  return `${Math.round(kelvin)} K (${Math.round(kelvin - 273.15)} °C)`;
}

const SPEED_UNITS: ReadonlyArray<readonly [number, string]> = [
  [31_557_600, 'yr'], [2_592_000, 'month'], [86_400, 'day'], [3_600, 'h'], [60, 'min'],
];

export function formatSpeed(rate: number, playing: boolean): string {
  if (!playing) return 'paused';
  const a = Math.abs(rate);
  const sign = rate < 0 ? '−' : '';
  if (a < 60) return `${sign}${a}× real time`;
  const [seconds, unit] = SPEED_UNITS.find(([s]) => a >= s) ?? [60, 'min'];
  const v = a / seconds;
  return `${sign}${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}/s`;
}

/** Rounds `m` down to 1, 2 or 5 x 10^n, for scale bars. */
export function niceLength(m: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const f = m / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS. If a rounding expectation differs by one digit, recompute it by hand from the formula before changing either side; the test values were derived from the unit constants.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add formatting helpers" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Camera controller

**Files:**
- Create: `src/camera/cameraController.ts`
- Test: `tests/camera/cameraController.test.ts`

**Interfaces:**
- Consumes: `BodyId` from `src/catalog/bodies`; `Vec3`, `add`, `sub`, `scale`, `length`, `lerp`, `lerpAngle`, `lerpVec`, `clamp` from `src/math`; `DEG` from `src/units`.
- Produces: constants `MAX_CAMERA_DISTANCE_M = 1.2e13`, `MIN_ALTITUDE_FRACTION = 0.02`, `FLIGHT_SECONDS = 4`, `FLY_TO_RADII = 4`, `DEFAULT_PITCH = 12 * DEG`, `MAX_PITCH = 89 * DEG`; `interface FocusSource { position(id: BodyId): Vec3; radius(id: BodyId): number }`; `interface CameraPose { position: Vec3; focusPoint: Vec3; focusId: BodyId; altitudeM: number; distanceM: number }`; `sunwardYaw(bodyPosition: Vec3): number`; `class CameraController` with `constructor(source: FocusSource, init: { focusId: BodyId; altitudeM: number; yaw: number; pitch: number })`, getters `isFlying: boolean` and `displayId: BodyId` (flight target while flying, else the focus), and methods `zoom(deltaLog: number)` (positive = out), `orbit(dYaw: number, dPitch: number)`, `flyTo(id: BodyId)`, `update(dtS: number): CameraPose`. Zoom and orbit are ignored during a flight; `flyTo` is ignored during a flight or for the current focus.

Design: the camera sits at `focusPoint + distance x (cos p cos y, cos p sin y, sin p)` where `distance = altitude + radius`; the state is log-altitude so scrolling feels even at every scale. A flight interpolates the focus point between the two bodies (both keep moving), interpolates log-altitude with a bump that rises to `1.3 x separation` mid-flight so both bodies are visible, and swings the view to look from the sunward side of the target.

- [ ] **Step 1: Write the failing test** — `tests/camera/cameraController.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CameraController, DEFAULT_PITCH, FLIGHT_SECONDS, MAX_CAMERA_DISTANCE_M, MAX_PITCH,
  MIN_ALTITUDE_FRACTION, sunwardYaw, type FocusSource,
} from '../../src/camera/cameraController';
import type { BodyId } from '../../src/catalog/bodies';
import type { Vec3 } from '../../src/math';

const positions: Partial<Record<BodyId, Vec3>> = { sun: [0, 0, 0], earth: [1e11, 0, 0], neptune: [4.5e12, 0, 0] };
const radii: Partial<Record<BodyId, number>> = { sun: 6.957e8, earth: 6.371e6, neptune: 2.4622e7 };
const source: FocusSource = {
  position: (id) => positions[id] ?? [0, 0, 0],
  radius: (id) => radii[id] ?? 1e6,
};
const make = () => new CameraController(source, { focusId: 'earth', altitudeM: 1e7, yaw: 0, pitch: 0 });

describe('CameraController pose', () => {
  it('places the camera at focus + (altitude + radius) along the view direction', () => {
    const pose = make().update(0);
    expect(pose.focusId).toBe('earth');
    expect(pose.focusPoint).toEqual([1e11, 0, 0]);
    expect(pose.position[0]).toBeCloseTo(1e11 + 1e7 + 6.371e6, -1);
    expect(pose.position[1]).toBeCloseTo(0, 3);
    expect(pose.altitudeM).toBeCloseTo(1e7, -1);
  });
  it('follows a moving focus body', () => {
    const moving: FocusSource = { position: () => [5, 6, 7], radius: () => 1 };
    const c = new CameraController(moving, { focusId: 'earth', altitudeM: 10, yaw: 0, pitch: 0 });
    expect(c.update(0).focusPoint).toEqual([5, 6, 7]);
  });
});

describe('zoom and orbit', () => {
  it('zooms in log space', () => {
    const c = make();
    c.zoom(Math.LN2);
    expect(c.update(0).altitudeM / 1e7).toBeCloseTo(2, 9);
    c.zoom(-2 * Math.LN2);
    expect(c.update(0).altitudeM / 1e7).toBeCloseTo(0.5, 9);
  });
  it('clamps to 2% of the radius above the surface and to the maximum distance', () => {
    const c = make();
    c.zoom(-100);
    expect(c.update(0).altitudeM).toBeCloseTo(MIN_ALTITUDE_FRACTION * 6.371e6, 3);
    c.zoom(100);
    expect(c.update(0).altitudeM).toBeCloseTo(MAX_CAMERA_DISTANCE_M, -3);
  });
  it('clamps pitch and lets yaw wrap freely', () => {
    const c = make();
    c.orbit(10, 10);
    expect(c.pitch).toBeCloseTo(MAX_PITCH, 12);
    c.orbit(0, -20);
    expect(c.pitch).toBeCloseTo(-MAX_PITCH, 12);
    expect(c.yaw).toBeCloseTo(10, 12);
  });
});

describe('sunwardYaw', () => {
  it('points from the body back toward the origin', () => {
    expect(Math.cos(sunwardYaw([1e11, 0, 0]))).toBeCloseTo(-1, 12);
    expect(Math.sin(sunwardYaw([0, 1e11, 0]))).toBeCloseTo(-1, 12);
  });
});

describe('flyTo', () => {
  it('ignores the current focus and does nothing visible', () => {
    const c = make();
    c.flyTo('earth');
    expect(c.isFlying).toBe(false);
  });
  it('rises above both bodies mid-flight, then lands sunward of the target at 4 radii', () => {
    const c = make();
    c.flyTo('neptune');
    expect(c.isFlying).toBe(true);
    expect(c.displayId).toBe('neptune');
    const mid = c.update(FLIGHT_SECONDS / 2);
    expect(mid.altitudeM).toBeGreaterThan(1e12);
    expect(c.isFlying).toBe(true);
    const end = c.update(FLIGHT_SECONDS);
    expect(c.isFlying).toBe(false);
    expect(end.focusId).toBe('neptune');
    expect(end.focusPoint).toEqual([4.5e12, 0, 0]);
    expect(end.altitudeM).toBeCloseTo(4 * 2.4622e7, -1);
    expect(end.position[0]).toBeLessThan(4.5e12);
    expect(c.pitch).toBeCloseTo(DEFAULT_PITCH, 12);
  });
  it('ignores zoom, orbit and a second flight while flying', () => {
    const c = make();
    c.flyTo('neptune');
    const before = c.yaw;
    c.zoom(5);
    c.orbit(1, 1);
    c.flyTo('sun');
    expect(c.yaw).toBe(before);
    expect(c.displayId).toBe('neptune');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/camera`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the implementation** — `src/camera/cameraController.ts`:

```ts
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
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add camera controller with log-altitude zoom and fly-to" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Camera-relative render maths

**Files:**
- Create: `src/render/cameraRelative.ts`
- Test: `tests/render/cameraRelative.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `sub`, `clamp`, `smoothstep` from `src/math`.
- Produces: `SPRITE_THRESHOLD_PX = 3`; `eclipticToThree(v: Vec3): Vec3` (`(x, z, -y)`); `toRenderSpace(world: Vec3, camera: Vec3): Vec3` (float64 subtraction FIRST, then axis mapping); `apparentDiameterPx(radiusM: number, distanceM: number, fovYRad: number, viewportHeightPx: number): number`; `orbitLineOpacity(distanceToBodyM: number, orbitRadiusM: number): number` (0 to 0.55); `nearPlane(altitudeM: number): number`.

- [ ] **Step 1: Write the failing test** — `tests/render/cameraRelative.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  apparentDiameterPx, eclipticToThree, nearPlane, orbitLineOpacity, toRenderSpace,
} from '../../src/render/cameraRelative';
import type { Vec3 } from '../../src/math';
import { AU_M, DEG } from '../../src/units';

describe('eclipticToThree', () => {
  it('maps ecliptic north to up and is a proper rotation', () => {
    // toBeCloseTo per component: toEqual would distinguish +0 from -0.
    const close = (actual: Vec3, expected: Vec3) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 12));
    close(eclipticToThree([0, 0, 1]), [0, 1, 0]);
    close(eclipticToThree([1, 0, 0]), [1, 0, 0]);
    close(eclipticToThree([0, 1, 0]), [0, 0, -1]);
  });
});

describe('toRenderSpace', () => {
  it('keeps metre precision 4.5e12 m from the origin', () => {
    const camera: Vec3 = [4.5e12, 2.0e12, -3.0e11];
    const world: Vec3 = [4.5e12 + 1000.123, 2.0e12, -3.0e11];
    const rel = toRenderSpace(world, camera);
    const expected = world[0] - camera[0];
    expect(rel[0]).toBeCloseTo(expected, 9);
    expect(rel[1]).toBeCloseTo(0, 9);
    expect(rel[2]).toBeCloseTo(0, 9);
    expect(Math.abs(Math.fround(rel[0]) - expected)).toBeLessThan(1e-4);
  });
  it('shows why: subtracting after casting to float32 loses hundreds of metres', () => {
    const naive = Math.fround(4.5e12 + 1000) - Math.fround(4.5e12);
    expect(Math.abs(naive - 1000)).toBeGreaterThan(100);
  });
});

describe('apparentDiameterPx', () => {
  const fov = 50 * DEG;
  it('is tiny for Earth seen from 1 AU', () => {
    expect(apparentDiameterPx(6.371e6, AU_M, fov, 1000)).toBeCloseTo(0.0913, 3);
  });
  it('grows as the camera approaches', () => {
    expect(apparentDiameterPx(6.371e6, 2e7, fov, 1000)).toBeGreaterThan(apparentDiameterPx(6.371e6, 2e8, fov, 1000));
  });
});

describe('orbitLineOpacity', () => {
  it('fades out close to the body, where polyline chords would show', () => {
    expect(orbitLineOpacity(1e6, 1.5e11)).toBe(0);
    expect(orbitLineOpacity(1e11, 1.5e11)).toBeCloseTo(0.55, 12);
    const mid = orbitLineOpacity(0.01 * 1.5e11, 1.5e11);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(0.55);
  });
});

describe('nearPlane', () => {
  it('scales with altitude within sane bounds', () => {
    expect(nearPlane(1e5)).toBeCloseTo(5000, 6);
    expect(nearPlane(1)).toBe(1);
    expect(nearPlane(1e13)).toBe(1e10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the implementation** — `src/render/cameraRelative.ts`:

```ts
import { clamp, smoothstep, sub, type Vec3 } from '../math';

/** Bodies covering fewer pixels than this are drawn as a point sprite instead of a sphere. */
export const SPRITE_THRESHOLD_PX = 3;

/** World frame (ecliptic, z north) to Three.js axes (y up). A proper rotation. */
export function eclipticToThree(v: Vec3): Vec3 {
  return [v[0], v[2], -v[1]];
}

/**
 * The precision trick: subtract in float64 first, so the large common offset cancels exactly,
 * then map axes. Only this small camera-relative vector is ever cast to float32 for the GPU.
 */
export function toRenderSpace(world: Vec3, camera: Vec3): Vec3 {
  return eclipticToThree(sub(world, camera));
}

export function apparentDiameterPx(radiusM: number, distanceM: number, fovYRad: number, viewportHeightPx: number): number {
  return (radiusM / (distanceM * Math.tan(fovYRad / 2))) * viewportHeightPx;
}

/**
 * Orbit lines are chords between samples, so near the body they visibly miss it.
 * Fade them out when the camera is within about 2% of the orbit radius of the body.
 */
export function orbitLineOpacity(distanceToBodyM: number, orbitRadiusM: number): number {
  return smoothstep(0.004, 0.02, distanceToBodyM / orbitRadiusM) * 0.55;
}

export function nearPlane(altitudeM: number): number {
  return clamp(altitudeM * 0.05, 1, 1e10);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add camera-relative render maths" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Rendering layer, input, and a first visible scene

This task builds the Three.js layer, the input handling and a minimal page, then verifies it in a **headed** browser. The render classes have no unit tests (they need WebGL); verification is the typecheck, the input unit test, and looking at screenshots taken from a visible browser.

**Files:**
- Create: `scripts/fetch-textures.mjs`, `scripts/lib/browser.mjs`, `scripts/shot.mjs`, `index.html`, `src/style.css`, `src/render/textures.ts`, `src/render/webgl.ts`, `src/render/bodyView.ts`, `src/render/orbitLine.ts`, `src/render/solarScene.ts`, `src/ui/input.ts`, `src/main.ts`
- Test: `tests/ui/input.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces (`solarScene.ts`): `FOV_DEG = 50`, `FAR_M = 1e15`; `interface FrameInput { frame: Frame; cameraPos: Vec3; focusPoint: Vec3; altitudeM: number; date: Date; showOrbits: boolean }`; `interface RenderInfo { rel: Vec3; distanceM: number; screenDiameterPx: number }` (in `bodyView.ts`, re-exported); `class SolarScene` with `constructor(canvas: HTMLCanvasElement, startDate: Date)`, `resize(width: number, height: number): void`, `render(input: FrameInput): Map<BodyId, RenderInfo>`, `projectToScreen(rel: Vec3): { x: number; y: number; inFront: boolean }` (CSS pixels), `centreLitPixels(): number`, getters `fovYRad: number`, `viewportHeight: number`.
- Produces (`input.ts`): `ZOOM_SENSITIVITY = 0.003`; `wheelToLogDelta(deltaY: number, deltaMode: number): number`; `attachInput(target: HTMLElement, handlers: { onZoom(deltaLog: number): void; onOrbit(dYaw: number, dPitch: number): void }): void`.
- Produces (`main.ts`): `window.__solar` debug hook: `{ frames: number; litPixels(): number; altitudeM(): number; isFlying(): boolean; focusId(): BodyId; flyTo(id: BodyId): void }`.

- [ ] **Step 1: Write the failing input test** — `tests/ui/input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ZOOM_SENSITIVITY, wheelToLogDelta } from '../../src/ui/input';

describe('wheelToLogDelta', () => {
  it('scrolling down (positive deltaY) zooms out', () => {
    expect(wheelToLogDelta(100, 0)).toBeCloseTo(100 * ZOOM_SENSITIVITY, 12);
    expect(wheelToLogDelta(-100, 0)).toBeLessThan(0);
  });
  it('normalises line and page delta modes to pixels', () => {
    expect(wheelToLogDelta(3, 1)).toBeCloseTo(3 * 16 * ZOOM_SENSITIVITY, 12);
    expect(wheelToLogDelta(1, 2)).toBeCloseTo(400 * ZOOM_SENSITIVITY, 12);
  });
});
```

Run: `npx vitest run tests/ui`
Expected: FAIL (cannot resolve `../../src/ui/input`).

- [ ] **Step 2: Write `src/ui/input.ts`**

```ts
export const ZOOM_SENSITIVITY = 0.003; // natural-log units of altitude per wheel pixel
const ORBIT_SENSITIVITY = 0.005; // radians per dragged pixel

export function wheelToLogDelta(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return pixels * ZOOM_SENSITIVITY;
}

export interface InputHandlers {
  onZoom(deltaLog: number): void;
  onOrbit(dYaw: number, dPitch: number): void;
}

/** Wheel zooms; one-pointer drag orbits; two-pointer pinch zooms. */
export function attachInput(target: HTMLElement, handlers: InputHandlers): void {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;

  target.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      handlers.onZoom(wheelToLogDelta(e.deltaY, e.deltaMode));
    },
    { passive: false },
  );

  target.addEventListener('pointerdown', (e) => {
    target.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinchDistance = currentPinch();
  });

  target.addEventListener('pointermove', (e) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, next);
    if (pointers.size === 1) {
      // Dragging right moves the camera left (yaw down); dragging down moves it up (pitch up).
      handlers.onOrbit(-(next.x - previous.x) * ORBIT_SENSITIVITY, (next.y - previous.y) * ORBIT_SENSITIVITY);
    } else if (pointers.size === 2) {
      const distance = currentPinch();
      if (pinchDistance > 0 && distance > 0) handlers.onZoom(-Math.log(distance / pinchDistance));
      pinchDistance = distance;
    }
  });

  const release = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    pinchDistance = 0;
  };
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);

  function currentPinch(): number {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
```

Run: `npx vitest run tests/ui`
Expected: PASS.

- [ ] **Step 3: Write the texture downloader** — `scripts/fetch-textures.mjs`

```js
// Downloads the 2K planet textures from Solar System Scope (CC BY 4.0) into public/textures.
import { mkdir, stat, writeFile } from 'node:fs/promises';

const FILES = [
  '2k_sun', '2k_mercury', '2k_venus_surface', '2k_earth_daymap', '2k_mars',
  '2k_jupiter', '2k_saturn', '2k_uranus', '2k_neptune',
];
const DIR = new URL('../public/textures/', import.meta.url);
await mkdir(DIR, { recursive: true });

for (const name of FILES) {
  const target = new URL(`${name}.jpg`, DIR);
  if (await stat(target).then(() => true, () => false)) {
    console.log(`have  ${name}`);
    continue;
  }
  // The site serves an HTML page unless a browser-like user agent is sent.
  const res = await fetch(`https://www.solarsystemscope.com/textures/download/${name}.jpg`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!res.ok || !isJpeg || bytes.length < 100_000) {
    throw new Error(`${name}: expected a JPEG, got status ${res.status}, ${bytes.length} bytes`);
  }
  await writeFile(target, bytes);
  console.log(`got   ${name} (${Math.round(bytes.length / 1024)} KB)`);
}
```

Run: `npm run textures`
Expected: nine `got` lines (or `have`), files in `public/textures/`. They are gitignored on purpose.

- [ ] **Step 4: Write the visible-browser helpers** — `scripts/lib/browser.mjs`

```js
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

/** Starts the Vite dev server on a fixed port. */
export async function startServer(port = 5199) {
  const server = await createServer({ server: { port, strictPort: true }, logLevel: 'warn' });
  await server.listen();
  return { server, url: `http://localhost:${port}/` };
}

/**
 * Launches a VISIBLE (headed) Chromium window. Never headless: the user wants to see every browser test.
 * Refuses to run without a display instead of falling back to headless.
 */
export async function launchVisible() {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.error('No display available. Browser tests must run in a visible window; stopping.');
    process.exit(2);
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
    headless: false,
    args: ['--window-size=1320,860', '--window-position=80,40'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return { browser, page, errors };
}
```

`scripts/shot.mjs`:
```js
// Usage: node scripts/shot.mjs out.png [--fly <bodyId>] [--wheel <pixels>]
// Opens a visible browser, optionally flies/zooms, saves a screenshot, prints console errors.
import { launchVisible, startServer } from './lib/browser.mjs';

const args = process.argv.slice(2);
const out = args[0] ?? 'shot.png';
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const { server, url } = await startServer();
const { browser, page, errors } = await launchVisible();
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__solar && window.__solar.frames > 5, null, { timeout: 30000 });
  const fly = option('--fly');
  if (fly) {
    await page.evaluate((id) => window.__solar.flyTo(id), fly);
    await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 15000 });
  }
  const wheel = option('--wheel');
  if (wheel) {
    await page.mouse.move(640, 360);
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, Number(wheel) / 20);
      await page.waitForTimeout(30);
    }
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
  console.log(`saved ${out}; console errors: ${errors.length ? errors.join(' | ') : 'none'}`);
} finally {
  await page.waitForTimeout(Number(process.env.SHOT_HOLD_MS ?? 1500));
  await browser.close();
  await server.close();
}
```

- [ ] **Step 5: Write the render layer**

`src/render/webgl.ts`:
```ts
export function isWebGL2Available(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
```

`src/render/textures.ts`:
```ts
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
```

`src/render/bodyView.ts`:
```ts
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
```

`src/render/orbitLine.ts`:
```ts
import * as THREE from 'three';
import type { BodyId } from '../catalog/bodies';
import { sampleOrbit } from '../ephemeris/ephemeris';
import type { Vec3 } from '../math';

const ORBIT_SAMPLES = 720;
const STALE_MS = 10 * 365.25 * 86_400_000; // orbits precess slowly; resample after ten years

export class OrbitLine {
  readonly line: THREE.LineLoop;
  private world: Float64Array;
  private sampledAtMs: number;
  private readonly positions = new Float32Array(ORBIT_SAMPLES * 3);
  private readonly attribute = new THREE.BufferAttribute(this.positions, 3);

  constructor(private readonly id: BodyId, color: string, date: Date) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.attribute);
    this.line = new THREE.LineLoop(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.line.frustumCulled = false;
    this.world = sampleOrbit(id, date, ORBIT_SAMPLES);
    this.sampledAtMs = date.getTime();
  }

  update(cameraPos: Vec3, date: Date, opacity: number): void {
    if (Math.abs(date.getTime() - this.sampledAtMs) > STALE_MS) {
      this.world = sampleOrbit(this.id, date, ORBIT_SAMPLES);
      this.sampledAtMs = date.getTime();
    }
    // Same mapping as eclipticToThree, inlined for the hot loop: subtract in float64, then cast.
    for (let i = 0; i < ORBIT_SAMPLES; i++) {
      const b = 3 * i;
      this.positions[b] = this.world[b]! - cameraPos[0];
      this.positions[b + 1] = this.world[b + 2]! - cameraPos[2];
      this.positions[b + 2] = -(this.world[b + 1]! - cameraPos[1]);
    }
    this.attribute.needsUpdate = true;
    this.line.visible = opacity > 0.001;
    (this.line.material as THREE.LineBasicMaterial).opacity = opacity;
  }
}
```

`src/render/solarScene.ts`:
```ts
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
  // decay 0: no distance falloff, so outer planets stay readable; the light direction still gives correct phases.
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
      const result = view.update(entry, input.cameraPos, this.fovYRad, this.height);
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

- [ ] **Step 6: Write the minimal page and wiring** (the full HUD arrives in Task 9)

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Solar System Explorer</title>
  </head>
  <body>
    <canvas id="scene"></canvas>
    <div id="fallback" hidden></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/style.css` (extended in Task 9):
```css
:root { color-scheme: dark; }
html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
#scene { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
#scene:active { cursor: grabbing; }
#fallback { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center;
  font: 16px/1.5 system-ui, sans-serif; color: #e8ecf4; }
```

`src/main.ts`:
```ts
import './style.css';
import { CameraController, sunwardYaw, DEFAULT_PITCH, type FocusSource } from './camera/cameraController';
import { SimClock } from './clock/clock';
import { getBody, type BodyId } from './catalog/bodies';
import { computeFrame, type Frame } from './ephemeris/frame';
import { SolarScene, type FrameInput } from './render/solarScene';
import { isWebGL2Available } from './render/webgl';
import { attachInput } from './ui/input';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;

if (!isWebGL2Available()) {
  const fallback = document.querySelector<HTMLElement>('#fallback')!;
  fallback.hidden = false;
  fallback.textContent = 'This app needs WebGL 2, which your browser or graphics driver does not provide.';
  canvas.hidden = true;
  throw new Error('WebGL 2 unavailable');
}

const clock = new SimClock(Date.now());
let frame: Frame = computeFrame(clock.date);

const source: FocusSource = {
  position: (id) => frame[id].position,
  radius: (id) => getBody(id).radiusM,
};

const camera = new CameraController(source, {
  focusId: 'earth',
  altitudeM: 3 * getBody('earth').radiusM,
  yaw: sunwardYaw(frame.earth.position),
  pitch: DEFAULT_PITCH,
});

const scene = new SolarScene(canvas, clock.date);
const showOrbits = true;

function resize(): void {
  scene.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

attachInput(canvas, {
  onZoom: (deltaLog) => camera.zoom(deltaLog),
  onOrbit: (dYaw, dPitch) => camera.orbit(dYaw, dPitch),
});

let frames = 0;
let lastInput: FrameInput | null = null;
let last = performance.now();

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  clock.tick(dt);
  frame = computeFrame(clock.date);
  const pose = camera.update(dt);
  lastInput = {
    frame, cameraPos: pose.position, focusPoint: pose.focusPoint,
    altitudeM: pose.altitudeM, date: clock.date, showOrbits,
  };
  scene.render(lastInput);
  frames++;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

declare global {
  interface Window {
    __solar?: {
      frames: number;
      litPixels(): number;
      altitudeM(): number;
      isFlying(): boolean;
      focusId(): BodyId;
      flyTo(id: BodyId): void;
    };
  }
}

window.__solar = {
  get frames() {
    return frames;
  },
  litPixels: () => scene.centreLitPixels(),
  altitudeM: () => (lastInput ? lastInput.altitudeM : 0),
  isFlying: () => camera.isFlying,
  focusId: () => camera.displayId,
  flyTo: (id) => camera.flyTo(id),
};
```

- [ ] **Step 7: Typecheck and run all tests**

Run: `npm run typecheck && npx vitest run`
Expected: both clean. Fix any type errors (for example a missing `!`/narrowing) before continuing.

- [ ] **Step 8: Look at it in a visible browser**

Run (a visible Chromium window opens on the user's screen and closes itself):
```bash
node scripts/shot.mjs /tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad/shot-earth.png
node scripts/shot.mjs /tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad/shot-out.png --wheel 6000
node scripts/shot.mjs /tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad/shot-neptune.png --fly neptune
```
Then read each PNG with the Read tool and check:
- `shot-earth.png`: a textured, sunlit Earth filling much of the view (continents visible), Sun-side lighting, and orbit lines not crossing the globe. If Earth is black, the camera is on the night side: check `sunwardYaw` usage. If the map is mirrored or Africa is not roughly toward the Sun-facing meridian for the current UTC time, note it (texture longitude alignment) and report rather than guessing.
- `shot-out.png`: after scrolling out, planets appear as small dots or tiny discs with faint orbit lines; the Sun is a bright dot or disc.
- `shot-neptune.png`: a blue sunlit Neptune.
- Each run prints `console errors: none`. Any console error is a failure to fix.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add Three.js render layer, input handling and first visible scene" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: HUD (time bar, scale readout, info panel, labels, body list, toggles)

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/timeBar.ts`, `src/ui/scaleReadout.ts`, `src/ui/infoPanel.ts`, `src/ui/bodyList.ts`, `src/ui/toggles.ts`, `src/ui/labelLayout.ts`, `src/ui/labels.ts`
- Modify: `index.html`, `src/style.css`, `src/main.ts`
- Test: `tests/ui/labelLayout.test.ts`

**Interfaces:**
- Consumes: `SimClock`, `SPEED_STEPS` (Task 4); `formatDate`, `formatSpeed`, `formatDistance`, `formatLightTime`, `formatRadius`, `formatMass`, `formatPeriodDays`, `formatHours`, `formatTemp`, `niceLength` (Task 5); `BODIES`, `BODY_IDS`, `getBody`, `BodyId` (Task 2); `orbitalPeriodDays` (Task 3); `CameraPose` (Task 6); `RenderInfo`, `SolarScene` (Task 8).
- Produces: `el(tag, className?, text?)` (`dom.ts`); `createTimeBar(root: HTMLElement, clock: SimClock): { update(): void }`; `createScaleReadout(root: HTMLElement): { update(args: { pose: CameraPose; fovYRad: number; viewportHeightPx: number; sunDistanceM: number }): void }`; `createInfoPanel(root: HTMLElement): { setBody(id: BodyId): void; update(sunDistanceM: number): void }`; `createBodyList(root: HTMLElement, onSelect: (id: BodyId) => void): { setActive(id: BodyId): void }`; `createToggles(root: HTMLElement): { readonly orbits: boolean; readonly labels: boolean }`; `layoutLabels(items: readonly LabelCandidate[], minSepPx: number): Set<BodyId>` where `LabelCandidate = { id: BodyId; x: number; y: number; priority: number }`; `createLabels(root: HTMLElement): { update(items: LabelItem[], enabled: boolean): void }` where `LabelItem = { id: BodyId; name: string; x: number; y: number; visible: boolean; priority: number }`.

- [ ] **Step 1: Write the failing label-layout test** — `tests/ui/labelLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { layoutLabels } from '../../src/ui/labelLayout';

describe('layoutLabels', () => {
  it('keeps both labels when they are far apart', () => {
    const shown = layoutLabels(
      [{ id: 'earth', x: 0, y: 0, priority: 1 }, { id: 'mars', x: 100, y: 0, priority: 2 }],
      20,
    );
    expect(shown).toEqual(new Set(['earth', 'mars']));
  });
  it('drops the lower-priority label when two collide', () => {
    const shown = layoutLabels(
      [{ id: 'earth', x: 0, y: 0, priority: 1 }, { id: 'venus', x: 5, y: 5, priority: 2 }],
      20,
    );
    expect(shown).toEqual(new Set(['venus']));
  });
  it('is empty for no input', () => {
    expect(layoutLabels([], 20).size).toBe(0);
  });
});
```

Run: `npx vitest run tests/ui/labelLayout.test.ts`
Expected: FAIL (cannot resolve module).

- [ ] **Step 2: Write `src/ui/labelLayout.ts`**

```ts
import type { BodyId } from '../catalog/bodies';

export interface LabelCandidate {
  id: BodyId;
  x: number;
  y: number;
  priority: number;
}

/** Greedy declutter: highest priority first, skip any label closer than `minSepPx` to one already placed. */
export function layoutLabels(items: readonly LabelCandidate[], minSepPx: number): Set<BodyId> {
  const placed: LabelCandidate[] = [];
  for (const item of [...items].sort((a, b) => b.priority - a.priority)) {
    if (placed.every((p) => Math.hypot(p.x - item.x, p.y - item.y) >= minSepPx)) placed.push(item);
  }
  return new Set(placed.map((p) => p.id));
}
```

Run: `npx vitest run tests/ui/labelLayout.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the DOM helper and HUD modules**

`src/ui/dom.ts`:
```ts
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
```

`src/ui/timeBar.ts`:
```ts
import { SPEED_STEPS, MAX_TIME_MS, MIN_TIME_MS, type SimClock } from '../clock/clock';
import { formatSpeed } from '../format/format';
import { el } from './dom';

export function createTimeBar(root: HTMLElement, clock: SimClock): { update(): void } {
  let step = 0;
  const direction = () => (clock.rate < 0 ? -1 : 1);

  const reverse = el('button', 'btn', 'Reverse');
  const playPause = el('button', 'btn', 'Pause');
  const slower = el('button', 'btn', 'Slower');
  const faster = el('button', 'btn', 'Faster');
  const now = el('button', 'btn', 'Now');
  const speed = el('span', 'speed');
  const date = el('input', 'date');
  date.type = 'datetime-local';
  date.min = new Date(MIN_TIME_MS).toISOString().slice(0, 16);
  date.max = new Date(MAX_TIME_MS).toISOString().slice(0, 16);
  date.setAttribute('aria-label', 'Simulation date and time (UTC)');
  const zone = el('span', 'zone', 'UTC');

  const setStep = (next: number): void => {
    step = Math.min(SPEED_STEPS.length - 1, Math.max(0, next));
    clock.setRate(direction() * SPEED_STEPS[step]!);
  };

  reverse.addEventListener('click', () => clock.reverse());
  playPause.addEventListener('click', () => clock.toggle());
  slower.addEventListener('click', () => setStep(step - 1));
  faster.addEventListener('click', () => setStep(step + 1));
  now.addEventListener('click', () => {
    clock.resetToNow(Date.now());
    step = 0;
  });
  date.addEventListener('change', () => {
    const ms = Date.parse(`${date.value}:00Z`);
    if (!Number.isNaN(ms)) clock.setTimeMs(ms);
  });

  root.append(reverse, playPause, slower, speed, faster, now, date, zone);

  return {
    update() {
      playPause.textContent = clock.playing ? 'Pause' : 'Play';
      speed.textContent = formatSpeed(clock.rate, clock.playing);
      if (document.activeElement !== date) date.value = new Date(clock.timeMs).toISOString().slice(0, 16);
    },
  };
}
```

`src/ui/scaleReadout.ts`:
```ts
import { formatDistance, formatLightTime, niceLength } from '../format/format';
import type { CameraPose } from '../camera/cameraController';
import { getBody } from '../catalog/bodies';
import { el } from './dom';

const TARGET_BAR_PX = 120;

export function createScaleReadout(root: HTMLElement): {
  update(args: { pose: CameraPose; fovYRad: number; viewportHeightPx: number; sunDistanceM: number }): void;
} {
  const title = el('div', 'readout-title');
  const altitude = el('div', 'readout-line');
  const light = el('div', 'readout-line dim');
  const sun = el('div', 'readout-line dim');
  const bar = el('div', 'scalebar');
  const barLabel = el('div', 'scalebar-label');
  root.append(title, altitude, light, sun, bar, barLabel);

  return {
    update({ pose, fovYRad, viewportHeightPx, sunDistanceM }) {
      title.textContent = getBody(pose.focusId).name;
      altitude.textContent = `Altitude ${formatDistance(pose.altitudeM)}`;
      light.textContent = `Light travel ${formatLightTime(pose.altitudeM)}`;
      sun.textContent = `Distance from Sun ${formatDistance(sunDistanceM)}`;
      const metresPerPx = (2 * Math.tan(fovYRad / 2) * pose.distanceM) / viewportHeightPx;
      const barM = niceLength(metresPerPx * TARGET_BAR_PX);
      bar.style.width = `${barM / metresPerPx}px`;
      barLabel.textContent = formatDistance(barM);
    },
  };
}
```

`src/ui/infoPanel.ts`:
```ts
import { getBody, type BodyId } from '../catalog/bodies';
import { orbitalPeriodDays } from '../ephemeris/ephemeris';
import {
  formatDistance, formatHours, formatMass, formatPeriodDays, formatRadius, formatTemp,
} from '../format/format';
import { el } from './dom';

export function createInfoPanel(root: HTMLElement): { setBody(id: BodyId): void; update(sunDistanceM: number): void } {
  const heading = el('h2');
  const kind = el('p', 'dim');
  const list = el('dl', 'facts');
  const foot = el('p', 'dim small');
  root.append(heading, kind, list, foot);
  let sunDistanceValue: HTMLElement | null = null;

  const addRow = (label: string, value: string, title?: string): HTMLElement => {
    const dt = el('dt', '', label);
    const dd = el('dd', '', value);
    if (title) dd.title = title;
    list.append(dt, dd);
    return dd;
  };

  return {
    setBody(id) {
      const body = getBody(id);
      const period = orbitalPeriodDays(id);
      heading.textContent = body.name;
      kind.textContent = body.kind === 'star' ? 'Star (G2V)' : 'Planet';
      list.replaceChildren();
      addRow('Radius', formatRadius(body.radiusM), 'Volumetric mean radius');
      addRow('Mass', formatMass(body.massKg));
      addRow('Orbital period', period === null ? 'n/a' : formatPeriodDays(period), 'From astronomy-engine (VSOP87)');
      addRow('Day length', formatHours(body.rotationPeriodH), 'Sidereal rotation period');
      addRow('Axial tilt', `${body.axialTiltDeg}°`);
      addRow('Surface gravity', `${body.surfaceGravity.toFixed(1)} m/s²`);
      addRow('Mean temperature', formatTemp(body.meanTempK), body.tempNote);
      sunDistanceValue = addRow('Distance from Sun', '');
      foot.textContent = `Source: ${body.source}`;
    },
    update(sunDistanceM) {
      if (sunDistanceValue) sunDistanceValue.textContent = formatDistance(sunDistanceM);
    },
  };
}
```

`src/ui/bodyList.ts`:
```ts
import { BODIES, type BodyId } from '../catalog/bodies';
import { el } from './dom';

export function createBodyList(root: HTMLElement, onSelect: (id: BodyId) => void): { setActive(id: BodyId): void } {
  const buttons = new Map<BodyId, HTMLButtonElement>();
  for (const body of BODIES) {
    const button = el('button', 'body-btn', body.name);
    button.addEventListener('click', () => onSelect(body.id));
    buttons.set(body.id, button);
    root.append(button);
  }
  return {
    setActive(id) {
      for (const [bodyId, button] of buttons) button.classList.toggle('active', bodyId === id);
    },
  };
}
```

`src/ui/toggles.ts`:
```ts
import { el } from './dom';

export function createToggles(root: HTMLElement): { readonly orbits: boolean; readonly labels: boolean } {
  const state = { orbits: true, labels: true };
  const add = (text: string, key: 'orbits' | 'labels'): void => {
    const label = el('label', 'toggle');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = true;
    box.addEventListener('change', () => {
      state[key] = box.checked;
    });
    label.append(box, el('span', '', text));
    root.append(label);
  };
  add('Orbits', 'orbits');
  add('Labels', 'labels');
  return state;
}
```

`src/ui/labels.ts`:
```ts
import { BODIES, type BodyId } from '../catalog/bodies';
import { el } from './dom';
import { layoutLabels } from './labelLayout';

export interface LabelItem {
  id: BodyId;
  name: string;
  x: number;
  y: number;
  visible: boolean;
  priority: number;
}

const MIN_SEPARATION_PX = 22;

export function createLabels(root: HTMLElement): { update(items: LabelItem[], enabled: boolean): void } {
  const nodes = new Map<BodyId, HTMLElement>();
  for (const body of BODIES) {
    const node = el('div', 'label', body.name);
    node.style.display = 'none';
    nodes.set(body.id, node);
    root.append(node);
  }
  return {
    update(items, enabled) {
      const shown = enabled ? layoutLabels(items.filter((i) => i.visible), MIN_SEPARATION_PX) : new Set<BodyId>();
      for (const item of items) {
        const node = nodes.get(item.id)!;
        if (shown.has(item.id)) {
          node.style.display = '';
          node.style.transform = `translate(${item.x + 10}px, ${item.y - 9}px)`;
        } else {
          node.style.display = 'none';
        }
      }
    },
  };
}
```

- [ ] **Step 4: Replace `index.html` and extend `src/style.css`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Solar System Explorer</title>
  </head>
  <body>
    <canvas id="scene"></canvas>
    <div id="labels"></div>
    <div id="hud">
      <nav id="bodies" class="panel" aria-label="Bodies"></nav>
      <div id="toggles" class="panel"></div>
      <aside id="info" class="panel"></aside>
      <div id="scale" class="panel"></div>
      <div id="timebar" class="panel"></div>
      <footer id="credit">Textures: Solar System Scope (CC BY 4.0). Positions: astronomy-engine.</footer>
    </div>
    <div id="fallback" hidden></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/style.css` (replace the whole file):
```css
:root {
  color-scheme: dark;
  --bg: #000;
  --panel: rgba(10, 14, 26, 0.72);
  --line: rgba(255, 255, 255, 0.12);
  --text: #e8ecf4;
  --dim: #8b95a8;
  --accent: #7cc4ff;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); overflow: hidden; }
#scene { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
#scene:active { cursor: grabbing; }
#fallback { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; font-size: 16px; line-height: 1.5; }

#labels { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.label { position: absolute; left: 0; top: 0; font-size: 12px; letter-spacing: 0.02em; color: var(--text);
  text-shadow: 0 0 4px #000, 0 0 8px #000; white-space: nowrap; }

#hud { position: fixed; inset: 0; pointer-events: none; }
.panel { position: absolute; pointer-events: auto; background: var(--panel); border: 1px solid var(--line);
  border-radius: 10px; padding: 10px 12px; backdrop-filter: blur(8px); font-variant-numeric: tabular-nums; }
.dim { color: var(--dim); }
.small { font-size: 11px; }

#bodies { top: 16px; left: 16px; display: flex; flex-direction: column; gap: 2px; padding: 6px; }
.body-btn { background: none; border: 0; color: var(--text); text-align: left; font: inherit; font-size: 13px;
  padding: 5px 10px; border-radius: 6px; cursor: pointer; }
.body-btn:hover { background: rgba(255, 255, 255, 0.08); }
.body-btn.active { background: rgba(124, 196, 255, 0.18); color: var(--accent); }

#toggles { top: 16px; left: 140px; display: flex; gap: 14px; font-size: 13px; }
.toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }

#info { top: 16px; right: 16px; width: 260px; }
#info h2 { margin: 0; font-size: 20px; font-weight: 600; }
#info p { margin: 2px 0 10px; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 10px; font-size: 13px; }
.facts dt { color: var(--dim); }
.facts dd { margin: 0; text-align: right; }

#scale { bottom: 16px; left: 16px; min-width: 190px; font-size: 13px; }
.readout-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.readout-line { line-height: 1.5; }
.scalebar { height: 6px; margin-top: 8px; border: 1px solid var(--text); border-top: 0; box-sizing: border-box; }
.scalebar-label { font-size: 11px; color: var(--dim); margin-top: 2px; }

#timebar { bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.btn { background: rgba(255, 255, 255, 0.08); border: 1px solid var(--line); color: var(--text); font: inherit;
  font-size: 13px; padding: 5px 10px; border-radius: 6px; cursor: pointer; }
.btn:hover { background: rgba(255, 255, 255, 0.16); }
.speed { min-width: 92px; text-align: center; font-size: 13px; }
.date { background: rgba(255, 255, 255, 0.06); border: 1px solid var(--line); border-radius: 6px; color: var(--text);
  font: inherit; font-size: 13px; padding: 4px 6px; color-scheme: dark; }
.zone { color: var(--dim); font-size: 12px; }

#credit { position: absolute; bottom: 4px; right: 12px; font-size: 10px; color: var(--dim); pointer-events: none; }

@media (max-width: 760px) {
  #info { top: auto; bottom: 150px; right: 8px; width: 210px; }
  #toggles { display: none; }
  #timebar { flex-wrap: wrap; width: calc(100% - 32px); justify-content: center; white-space: normal; }
  #scale { bottom: 110px; }
}
```

- [ ] **Step 5: Wire the HUD into `src/main.ts`**

Add imports at the top (with the existing ones):
```ts
import { BODY_IDS } from './catalog/bodies';
import { length } from './math';
import { createBodyList } from './ui/bodyList';
import { createInfoPanel } from './ui/infoPanel';
import { createLabels } from './ui/labels';
import { createScaleReadout } from './ui/scaleReadout';
import { createTimeBar } from './ui/timeBar';
import { createToggles } from './ui/toggles';
```

Replace the line `const showOrbits = true;` with:
```ts
const element = (id: string): HTMLElement => document.querySelector<HTMLElement>(`#${id}`)!;
const toggles = createToggles(element('toggles'));
const timeBar = createTimeBar(element('timebar'), clock);
const readout = createScaleReadout(element('scale'));
const infoPanel = createInfoPanel(element('info'));
const labels = createLabels(element('labels'));
const bodyList = createBodyList(element('bodies'), (id) => camera.flyTo(id));
let shownBody: BodyId | null = null;
```

Inside `loop`, change `showOrbits,` in the `lastInput` object to `showOrbits: toggles.orbits,`, and replace `scene.render(lastInput);` with:
```ts
  const info = scene.render(lastInput);

  const displayed = camera.displayId;
  if (displayed !== shownBody) {
    shownBody = displayed;
    infoPanel.setBody(displayed);
    bodyList.setActive(displayed);
  }
  const sunDistanceM = length(frame[displayed].position);
  infoPanel.update(sunDistanceM);
  readout.update({ pose, fovYRad: scene.fovYRad, viewportHeightPx: scene.viewportHeight, sunDistanceM });
  timeBar.update();
  labels.update(
    BODY_IDS.map((id) => {
      const r = info.get(id)!;
      const screen = scene.projectToScreen(r.rel);
      return {
        id, name: getBody(id).name, x: screen.x, y: screen.y, priority: getBody(id).radiusM,
        // Hide behind the camera, off-screen, or when the body itself already fills much of the view.
        visible: screen.inFront && r.screenDiameterPx < scene.viewportHeight * 0.5 &&
          screen.x > -50 && screen.x < window.innerWidth + 50 && screen.y > -20 && screen.y < window.innerHeight + 20,
      };
    }),
    toggles.labels,
  );
```
(Do not import `toRenderSpace` in `main.ts`; it is not needed there.)

- [ ] **Step 6: Typecheck, test, and look at it in a visible browser**

Run: `npm run typecheck && npx vitest run`
Expected: both clean.

Run (visible window):
```bash
node scripts/shot.mjs /tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad/hud-earth.png
node scripts/shot.mjs /tmp/claude-1000/-home-bobbywitcher/9d9d08d8-5989-4aa1-955a-8bf9886f4e0e/scratchpad/hud-out.png --wheel 7000
```
Read both PNGs and check: body list at top-left with Earth highlighted; info panel at right with Earth's facts and a live "Distance from Sun"; scale readout bottom-left with a scale bar; time bar bottom-centre with speed "1× real time" and a UTC date; labels appear for planets when zoomed out and do not overlap heavily; no console errors. Then, with the same visible browser via a short ad-hoc script or by extending `scripts/shot.mjs` args if needed, click a body-list button (for example Jupiter) and confirm the camera flies there and the info panel changes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add HUD: time bar, scale readout, info panel, labels, body list, toggles" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Smoke test, README, and final verification

**Files:**
- Create: `scripts/smoke.mjs`, `README.md`
- Modify: nothing else expected (fix defects found here in the file that owns them)

**Interfaces:**
- Consumes: `window.__solar` (Task 8), `launchVisible`, `startServer` (Task 8).
- Produces: `npm run smoke` (visible browser, exit code 0 on pass); README with run, test and attribution instructions.

- [ ] **Step 1: Write the smoke test** — `scripts/smoke.mjs`

```js
// Visible (headed) end-to-end check: renders, zooms out and in, flies to Neptune, no console errors.
// SMOKE_HOLD_MS keeps the window open at the end (default 4000) so the result can be seen.
import { launchVisible, startServer } from './lib/browser.mjs';

const HOLD_MS = Number(process.env.SMOKE_HOLD_MS ?? 4000);
let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) failed = true;
};

const { server, url } = await startServer();
const { browser, page, errors } = await launchVisible();
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__solar && window.__solar.frames > 5, null, { timeout: 30000 });
  check(true, 'app rendered frames');

  const lit = await page.evaluate(() => window.__solar.litPixels());
  check(lit > 500, `Earth is visible at start (${lit} lit pixels in the centre patch)`);

  await page.mouse.move(640, 360);
  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(25);
  }
  const far = await page.evaluate(() => window.__solar.altitudeM());
  check(far > 1e13, `zoomed out to the maximum (${far.toExponential(2)} m)`);

  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(25);
  }
  const near = await page.evaluate(() => window.__solar.altitudeM());
  check(near < 2e5, `zoomed back in to the minimum altitude (${near.toExponential(2)} m)`);
  const litNear = await page.evaluate(() => window.__solar.litPixels());
  check(litNear > 500, `Earth still renders at minimum altitude (${litNear} lit pixels)`);

  await page.evaluate(() => window.__solar.flyTo('neptune'));
  await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 15000 });
  check((await page.evaluate(() => window.__solar.focusId())) === 'neptune', 'flew to Neptune');
  const litNeptune = await page.evaluate(() => window.__solar.litPixels());
  check(litNeptune > 500, `Neptune is visible (${litNeptune} lit pixels)`);

  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await page.waitForTimeout(HOLD_MS);
} catch (error) {
  console.log(`FAIL  ${error}`);
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
console.log(failed ? 'SMOKE FAILED' : 'SMOKE PASSED');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it (a visible window opens)**

Run: `npm run smoke`
Expected: all lines `PASS` and `SMOKE PASSED`. If a check fails, diagnose with `scripts/shot.mjs` screenshots and fix the owning module; do not loosen the thresholds without understanding why. If `litPixels` is 0 for Earth, the camera is on the night side or the texture is missing (run `npm run textures`).

- [ ] **Step 3: Write `README.md`**

```markdown
# Solar System Explorer

A browser-based 3D solar system you can zoom through continuously, from just above a planet's surface out past Neptune, using real sizes, real distances and real planetary positions. Phase 1 of a larger project (see `docs/superpowers/specs/`).

## Run

    npm install
    npm run textures     # downloads the 2K planet textures (not committed)
    npm run dev          # http://localhost:5173

Scroll or pinch to zoom, drag to orbit, click a body in the list to fly there. The time bar controls speed, direction and date (UTC).

## Test

    npm test             # unit tests (Vitest)
    npm run typecheck
    npm run smoke        # end-to-end check in a visible Chromium window (needs a display)

## How the scale works

All positions are float64 metres in the heliocentric ecliptic J2000 frame. Every frame they are subtracted from the camera position in float64 and only then cast to float32 for the GPU, so the render camera is always at the origin and there is no jitter at any scale. A logarithmic depth buffer covers the near/far range.

## Credits

- Planet positions and orientations: [astronomy-engine](https://github.com/cosinekitty/astronomy) (VSOP87, IAU rotation model).
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0, based on NASA imagery and elevation data.
- Physical data: NASA Planetary Fact Sheet and Sun Fact Sheet.
```

- [ ] **Step 4: Final verification against the definition of done**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass; `dist/` is produced.

Then confirm each definition-of-done item with evidence (paste the evidence into the final report, do not just assert):
1. `npm run dev` serves the app; `npm test` passes (test counts from the output).
2. Smoke run shows zoom from the minimum altitude (about 127 km at Earth) to 1.2e13 m without console errors. Also run `SMOKE_HOLD_MS=20000 npm run smoke` and tell the user the window will stay open so they can drive it themselves and judge the zoom feel (jitter, clipping, pops), since that is a by-eye check.
3. Ephemeris tests pass (reference positions).
4. Screenshots show the Sun and 8 planets at real sizes; the time bar reverses and changes speed (check `clock` tests, and click Reverse in the visible browser).
5. All four HUD elements are present in the screenshots.
6. `grep -rn "MAX_CAMERA_DISTANCE_M" src` shows the maximum distance defined in exactly one place.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add visible smoke test and README" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review (done while writing this plan)

**Spec coverage:** architecture units `ephemeris`/`catalog`/`clock`/`camera`/`render`/`ui`/`format` map to Tasks 3, 2, 4, 6, 7-8, 9, 5. Precision strategy (float64, camera-relative, log depth): Tasks 7-8. Sub-pixel sprites: Task 8 `BodyView`. Orbit lines with 512+ samples and per-frame camera-relative rebuild: Task 8 `OrbitLine` (720 samples, with fade near the body). Lighting, rotation and tilt (IAU): Tasks 3 and 8. Camera limits and fly-to: Task 6. UI (time bar, scale readout, info panel, labels and orbit toggles, body list, wheel/drag/pinch): Tasks 8-9. Error handling (no WebGL, texture fallback): Task 8. Testing (unit tests, visible smoke test, manual zoom check): Tasks 1-10. Definition of done: Task 10 step 4. The spec's "100 m minimum altitude" was changed to 2% of radius in the spec itself before this plan was written.

**Placeholders:** none; every code step has full code. Body facts come from the NASA fact sheet (masses, tilts, temperatures, gravities re-checked against the live page on 2026-09-20; radii and rotation periods from the same fact sheet's standard values).

**Type consistency:** `Vec3`/`Mat3` (Task 1), `BodyId`/`BODY_IDS`/`getBody` (Task 2), `Frame`/`FrameEntry` (Task 3), `SimClock`/`SPEED_STEPS` (Task 4), `CameraPose`/`FocusSource`/`CameraController.displayId` (Task 6), `RenderInfo`/`FrameInput`/`SolarScene.projectToScreen` (Task 8) are used with identical names in Tasks 9-10.

**Verified before writing (2026-09-20):** the astronomy-engine API and unit conventions, the toolchain (vitest, tsc, three types work together on the pinned versions; Chromium 153 is installed), texture download URLs (need a browser user agent), and the orientation maths by running it. That run found that `RotationAxis` gives a wrong frame for Earth (pole nearly on the celestial pole), so Earth uses sidereal time instead, and that Uranus's IAU pole is 82 degrees from ecliptic north with retrograde spin, not 98. The test expectations in this plan use the measured values.

**Known risk to watch during execution:** texture longitude alignment (whether the Earth map is offset relative to the IAU prime meridian). The plan checks it visually in Task 8; if it is off, fix with a single constant rotation about the pole in `orientationToThree`, not by changing the ephemeris.
