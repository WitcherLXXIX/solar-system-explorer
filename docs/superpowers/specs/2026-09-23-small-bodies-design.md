# Solar System Explorer, Phase 3: Small Bodies

Date: 2026-09-23
Status: design approved in conversation, awaiting written-spec review
Builds on: `2026-09-20-solar-system-core-design.md` (phase 1), `2026-09-20-planet-fidelity-design.md` (phase 2a) and `2026-09-21-moons-dwarfs-design.md` (phase 2b), all merged to `master`.

## Goal

Add the asteroid belt and Kuiper belt as real-looking, real-time-orbiting populations, plus about 15 named real objects (major asteroids, large Kuiper objects, and comets with tails) you can fly to, exactly like the planets and moons before them.

## Scope

**In scope:** the main asteroid belt (~2.1-3.3 AU) and the Kuiper belt (~30-50 AU) as schematic particle fields; about 15 named real objects with real, cited orbits: Vesta, Pallas, Hygiea, Juno (asteroid belt); Quaoar, Orcus, Sedna, Gonggong (Kuiper belt, beyond the dwarf planets phase 2b already added); Halley, Hale-Bopp and 1-2 more comets, each with a physically-directed tail effect.

**Out of scope:** Trojan asteroids and other resonant populations; individual named Kuiper belt objects beyond the ~15; a true physical dust/ion-tail simulation; collisions or belt evolution over time; image maps for any body here (comets and minor asteroids get the honest plain-colour fallback from phase 2b's texture rules, since no usable free global map exists for them).

## Decisions

| Topic | Decision |
|---|---|
| Coverage | Asteroid belt, Kuiper belt and comets together in one spec/plan/build cycle (they share the same machinery) |
| Belt representation | Schematic particle field (thousands of points, statistically realistic, clearly labelled as schematic) plus named real objects on top |
| Named object count | About 15, matching phase 2b's scale of effort per body (source, cross-check, test, honest disclosure) |
| Belt density | A few thousand points per belt, GPU cost kept low via one `THREE.Points` draw call per belt regardless of count |
| Comet tails | Included from the start: a simple stretched, alpha-faded billboard, direction from the real Sun vector, length/brightness a stylised falloff with distance from the Sun |

## Data model and named objects

Each schematic belt point is assigned, once at startup, a full set of orbital elements (semi-major axis, eccentricity, inclination, phase) drawn from distributions matching the real belt's known shape: the main belt's 2.1-3.3 AU range with reduced density at the Kirkwood gaps, a broad inclination spread; the Kuiper belt's flatter 30-50 AU disc. These are explicitly schematic, never presented as individually real objects; the catalog and the app's own text say so, the same honesty rule phase 2b used for bodies with no verified map.

Named objects (the ~15) use the exact same pipeline as phase 2b's moons: real elements and facts fetched from the allowed JPL/NASA domains, cited, cross-checked against a second source where possible, verified by tests that do not depend on the data being right by luck (period consistency, Horizons reference states with the tolerance measured and disclosed, never assumed).

## Belt rendering architecture

The core technical decision is how thousands of orbiting points get drawn every frame without hurting performance.

- **Approach: CPU-propagated Kepler points, one `THREE.Points` draw call per belt.** At startup each point's random-but-realistic orbital elements are stored in flat typed arrays (no per-point objects). Every frame, a single tight loop propagates all points' positions using the same Kepler solver phase 2b already built and tested — the same physics as every other orbiting body, applied statistically instead of to one real object. Positions go through the same float64-subtract-then-cast-to-float32 discipline used everywhere else in the app, so there is no precision jitter at thousands of points. Rendering reuses the existing soft-dot sprite texture; two draw calls total (one per belt), independent of point count.
- **Rejected: GPU-side (vertex-shader) Kepler propagation.** Would scale further, but orbital math in GLSL is much harder to test and debug than the CPU path, and a flat CPU loop over a few thousand points is cheap enough to hit the frame-rate target. A future phase can revisit this if point counts grow by orders of magnitude (YAGNI for now).
- **Rejected: a static, non-orbiting field.** Every other body in this app moves with real simulated time, including under the time bar's fast-forward; a frozen belt would visibly break that the moment time speeds up.
- **Clutter and cost:** belt points use the existing sprite-only rendering (no full per-object effects pipeline), hide below a screen-size threshold like current sprites already do, and fade at extreme zoom the same way, so they never clutter the full-system view.

## Comets and tails

- **Orbits:** real, highly eccentric orbits fetched from JPL for Halley, Hale-Bopp and 1-2 more, using the same element/Kepler/Horizons-verification pipeline as phase 2b's moons.
- **Tail physics:** a comet's tail always points away from the Sun (solar wind and radiation pressure), not along its direction of travel — the direction is computed each frame from the real Sun-to-comet vector, the same vector every other shader already uses for lighting.
- **Tail rendering:** a simple stretched, alpha-faded billboard. Length and brightness follow a stylised falloff with distance from the Sun (stronger and longer near perihelion, negligible far out); this is a heuristic, not a physical dust/ion tail simulation, and is documented as such.
- **Shader discipline:** the log-depth and colour-space chunks in every custom shader (as established in phase 2a); sampling before any discard (the phase 2b ruling); the tail's direction/length/brightness maths mirrored into a tested TypeScript reference and interpolated into the GLSL, following phase 2b's Task 1 GLSL/TS linkage pattern, so the two cannot drift.
- **Visibility:** the tail renders only past a perihelion-distance threshold and hides at extreme zoom, like other effects.

## Testing

- **Belt distribution (unit):** the generated element set matches the target statistical shape (density profile across the Kirkwood gaps, inclination spread) within a stated tolerance; Kepler propagation of a schematic point matches a hand-computed reference position.
- **Named objects (unit):** period-consistency and Horizons-comparison tests, same approach and rigour as phase 2b's moons, with the measured tolerance disclosed.
- **Comet tail maths (unit):** the direction/length/brightness reference is pinned by tests and mirrored into the shader (GLSL/TS linkage).
- **Visible smoke (headed only, never headless):** both belts are visible and roughly belt-shaped from a wide view; a named asteroid and a comet are flyable; a comet shows a visible tail near perihelion and none far from the Sun; frame rate is reported with the full population loaded (target 30fps or better); no console errors.

## Definition of done

1. Both belts render as real-looking, real-time-orbiting schematic fields, clearly documented as schematic (not individually real per point).
2. About 15 named objects have real, cited, cross-checked orbits and facts, each flyable.
3. Comets show real orbits and a physically-directed tail effect.
4. Frame rate stays at or above target with the full population loaded.
5. All tests and the visible smoke test pass.

## Project layout additions

```
src/catalog/smallBodies.ts     the ~15 named objects' facts and element references
src/ephemeris/beltField.ts     statistical element generation + CPU Kepler propagation for a belt
src/render/beltPoints.ts       THREE.Points rendering for one belt (shared geometry/material)
src/render/cometTail.ts        comet tail effect (shader + tested reference maths)
src/render/cometTailMath.ts    pure reference maths for the tail (direction, length/brightness falloff)
tests/                         matching test files for the above
docs/                          small-body data source research note (mirrors docs/texture-sources.md's pattern)
```

## Open items for later phases

- Phase 4 (deep space): the heliosphere, Oort cloud and nearby stars remain unchanged by this phase; the same CPU-Kepler-point technique used here for belts could extend to a schematic Oort cloud field if that phase wants one.
- Trojan asteroids and other resonant populations, if ever added, would reuse this phase's belt-field machinery with a different element distribution.
- If a future phase needs an order-of-magnitude more points than a few thousand per belt, GPU-side Kepler propagation becomes worth revisiting (deliberately deferred here).
