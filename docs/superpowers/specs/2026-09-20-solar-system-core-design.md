# Solar System Explorer, Phase 1: Core Engine

Date: 2026-09-20
Status: design approved in conversation, awaiting written-spec review

## Goal

A high-fidelity, interactive 3D solar system in the browser where the user zooms continuously and smoothly from just above a planet's surface out through the solar system, using real sizes, real distances and real planetary positions.

## Project decomposition

The full vision (surface to nearby stars, roughly 10 orders of magnitude) is split into four sub-projects, each with its own spec, plan and build. This document covers phase 1 only.

1. **Core engine (this spec):** unbroken-scale camera, Sun and 8 planets with real ephemeris, time control, HUD. Architecture is designed so phase 4 needs no rewrite.
2. **Fidelity pass:** high-resolution textures, atmospheres, rings, major moons, dwarf planets.
3. **Small bodies:** asteroid belt, Kuiper belt, comets as real particle populations.
4. **Deep space:** heliosphere, Oort cloud, nearby stars (Alpha Centauri and others), galactic backdrop.

## Decisions

| Topic | Decision |
|---|---|
| Platform | Web app: TypeScript, Vite, Three.js (WebGL), runs locally with a dev server |
| Navigation | Continuous zoom on one unbroken, real scale (no stylised distance compression) |
| Positions | Real ephemeris via the astronomy-engine library (VSOP87), scrubbable in time |
| Precision strategy | Float64 world state, camera-relative rendering, logarithmic depth buffer |
| Textures (phase 1) | Freely licensed 2K planet textures with attribution (NASA-derived or Solar System Scope, CC BY 4.0); upgraded in phase 2 |
| UI | Time controls, scale readout, body info panel, labels and orbit lines |
| Tests | Vitest for math and logic, one headless-browser smoke test, manual visual checks for zoom feel |

## Architecture

World frame: heliocentric ecliptic J2000, in metres, float64.

| Unit | Job | Depends on |
|---|---|---|
| `ephemeris` | `bodyState(id, date)` returns position and velocity in metres. Thin wrapper over astronomy-engine, no rendering code. | astronomy-engine |
| `catalog` | Typed static data per body: radius, mass, axial tilt, rotation period, colour, texture key, and the facts shown in the info panel (each with a source). | none |
| `clock` | Simulation time, rate (including negative), pause, jump to date. | none |
| `camera` | Focus target plus a log-scale distance from it. Scroll and pinch change the log distance so zoom feels even at every scale. Switching focus interpolates in log space and follows the body as it orbits. | `ephemeris`, `clock` |
| `render` | Three.js layer. Each frame takes the camera's float64 position, subtracts it from every body position, then casts to float32 for the GPU. Owns the log depth buffer, body meshes, orbit lines, and the switch to point sprites for sub-pixel bodies. | `camera`, `catalog` |
| `ui` | DOM overlay on the canvas: time bar, scale readout, info panel, label and orbit toggles, body list. | `clock`, `camera`, `catalog` |
| `format` | Distances (km, AU, light-minutes, light-years) and date formatting. | none |

Per-frame data flow: `clock` advances, `ephemeris` supplies float64 positions, `camera` updates, `render` draws camera-relative, `ui` reads state for its readouts.

## Rendering and scale

- **Precision:** zoom range is from 2% of the focused body's radius above its surface (about 127 km at Earth) out to about 10^17 m in the architecture (phase 1 content stops near Neptune). Float64 (native JS numbers) holds the state. Only camera-relative offsets reach the GPU, so nearby geometry never sees large numbers.
- **Depth:** Three.js logarithmic depth buffer. The camera near plane scales with distance to the focused surface so close-ups do not clip.
- **Bodies at every size:** a body is drawn as real geometry when it covers enough pixels, and as a point sprite when sub-pixel. Sprite brightness follows apparent size and illumination.
- **Orbit lines:** each orbit is sampled from the ephemeris over one period (about 512 points, kept in float64). Every frame the CPU subtracts the camera position and uploads float32 vertices.
- **Lighting:** the Sun is a point light and the only real light source, plus a faint ambient term. This gives correct phases.
- **Rotation and tilt:** each body spins at its catalogued sidereal rate about its tilted axis.
- **Camera limits:** minimum altitude is 2% of the focused body's radius, because a 128-segment sphere mesh and 2K textures look faceted and blurry any closer (changed from the original "just above the surface" during planning). Maximum distance is a single constant (1.2e13 m, 80 AU, slightly beyond Neptune), raised in phase 4.
- **Orientation:** body axes come from astronomy-engine's `RotationAxis` (IAU pole and prime-meridian angle), so tilt, spin rate and retrograde rotation are not hand-typed. The catalog's tilt and rotation period are for the info panel only.

## UI

- **Time bar (bottom):** play/pause, reverse, speed steps from 1x real time through minutes, days and years per second, a "now" button, a date picker.
- **Scale readout (bottom left):** scale bar and distance to the focused body, unit chosen automatically.
- **Info panel (right):** for the focused body: radius, mass, orbital period, day length, axial tilt, surface gravity, mean temperature, with sources.
- **Labels and orbits:** labels fade by apparent size and distance to avoid clutter. Orbit lines and labels each have a toggle.
- **Navigation:** scroll or pinch to zoom, drag to orbit the focus, a body list to jump to any planet. Selecting a body flies the camera there by interpolating log distance.

## Error handling

- WebGL unavailable: the page shows a clear message instead of a blank screen.
- Texture load failure: the body falls back to a flat colour and the app keeps running.

## Testing

- Unit tests: `ephemeris` against known reference positions on several dates, `clock`, `format`, and the camera-relative transform. The transform test places a body at 4.5e12 m with the camera 1 km away and checks the offset is exact to float32 limits.
- Smoke test: a headed, visible browser window (never headless; standing user preference) loads the page, zooms out and in, flies to Neptune, and fails on any console error or blank canvas.
- Manual: the zoom itself (continuity, jitter, clipping, pops) is checked by eye.

## Project layout

```
~/src/solar-system/
  src/ephemeris  catalog  clock  camera  render  ui  format
  tests/                      (Vitest, mirrors src/)
  docs/superpowers/specs/     (this file)
  docs/superpowers/plans/
```

## Definition of done

1. Runs locally with `npm run dev`, and the tests pass.
2. Continuous zoom from 2% of a planet's radius above its surface out past Neptune with no jitter, clipping or pops.
3. Positions match astronomy-engine reference values for several test dates.
4. Sun and 8 planets have real sizes, tilts, rotation and orbits, with time control forward and backward.
5. All four UI elements work.
6. No hard-coded limits block phase 4; the camera's maximum distance is a single constant.

## Out of scope for phase 1

Moons, dwarf planets, asteroid and Kuiper belts, comets, atmospheres, rings, stars, the Oort cloud, deployment and hosting.

## Open items for later phases

- Phase 2: choice of high-resolution texture source and its size budget.
- Phase 2: lower the minimum altitude below 2% of radius (needs high-resolution textures plus an analytic-sphere or level-of-detail renderer).
- Phase 4: how to represent nearby stars (catalogue source, and depth handling beyond 10^17 m).
