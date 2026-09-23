# Solar System Explorer, Phase 4: Deep Space

Date: 2026-09-23
Status: design approved
Builds on: `2026-09-20-solar-system-core-design.md` (phase 1), `2026-09-20-planet-fidelity-design.md` (phase 2a), `2026-09-21-moons-dwarfs-design.md` (phase 2b), and `2026-09-23-small-bodies-design.md` (phase 3). Phases 1-2b are merged to `master`; phase 3 is a separate, not-yet-merged branch `phase-3` at the time this spec was written.

## Goal

Extend the zoom out past the small bodies to the edge of the solar system's real influence and a handful of the nearest real stars: a schematic heliosphere boundary, a schematic Oort cloud, and 12 real nearby stars with real positions.

## Scope

**In scope:** the heliosphere as a schematic boundary shell (termination shock and heliopause); the Oort cloud as a schematic, sparse, spherical Kepler-orbiting particle field; 12 real nearby stars out to about 11.4 light-years, each flyable.

**Out of scope:** any star beyond about 11.4 ly; actual stellar physics (fusion, real angular size, exoplanets); the galactic plane or Milky Way backdrop; the interstellar medium beyond the heliosphere boundary; time-accurate stellar proper motion (these 12 stars are treated as fixed over the app's 1700-2300 date range; their own real motion is invisible at that precision and timescale).

## Sequencing and branching (important: differs from earlier phases)

Phase 4 touches the same core files phase 3 does (`solarScene.ts`, `cameraController.ts`, `cameraRelative.ts` — the render loop and scale knobs every body flows through). To avoid a real merge conflict between two independently-built branches, **phase 4 branches from the tip of the (still unmerged) `phase-3` branch, not from `master`.** Its own unattended build only begins real work once phase 3's build is confirmed complete (via phase 3's own completion marker); before that it safely does nothing, the same discipline as the spec-approval gate below. The result is one `phase-4` branch whose ancestry already includes all of phase 3's commits — reviewing and merging that one branch brings both phases in together, rather than two separate branches needing separate merges.

## Decisions

| Topic | Decision |
|---|---|
| Scale knobs | `MAX_CAMERA_DISTANCE_M`, `FAR_M` and the near-plane cap raised together to about 1e17 m (~10.6 ly), clearing the farthest included star (Proxima Centauri, 4.02e16 m) with room to spare |
| Heliosphere | Schematic shell at the real termination shock (~94 AU) and heliopause (~120 AU) boundaries, reusing the phase 2a atmosphere shell/scattering shader rather than a new one |
| Oort cloud | Reuses phase 3's CPU-propagated Kepler-point belt technique, extended to a sparse spherical (not flat) shell, ~2,000-100,000 AU, no individually named real objects (nothing out there has ever been directly observed) |
| Stars | 12 real stars with real RA/Dec/distance/spectral type, sourced and embedded below; static positions (no orbital motion needed at this timescale); brightness/size from spectral type, reusing the existing sprite model |
| Star data provenance | Fetched directly during this brainstorm (not delegated to the unattended build, which stays on its existing NASA/JPL-only domain allowlist) |

## Star data (source: Wikipedia, "List of nearest stars", https://en.wikipedia.org/wiki/List_of_nearest_stars, itself citing Gaia DR3/Hipparcos; fetched 2026-09-23)

| Name | RA | Dec | Distance (ly) | Spectral type |
|---|---|---|---|---|
| Proxima Centauri | 14h 29m 43.0s | −62° 40′ 46″ | 4.2465 | M5.5Ve |
| Alpha Centauri A | 14h 39m 36.5s | −60° 50′ 02″ | 4.3441 | G2V |
| Alpha Centauri B | 14h 39m 35.1s | −60° 50′ 14″ | 4.3441 | K1V |
| Barnard's Star | 17h 57m 48.5s | +04° 41′ 36″ | 5.9629 | M4.0Ve |
| Wolf 359 | 10h 56m 29.2s | +07° 00′ 53″ | 7.856 | M6.0V |
| Lalande 21185 | 11h 03m 20.2s | +35° 58′ 12″ | 8.3044 | M2.0V |
| Sirius A | 06h 45m 08.9s | −16° 42′ 58″ | 8.7094 | A1V |
| Sirius B | 06h 45m 08.9s | −16° 42′ 58″ | 8.7094 | DA2 |
| Ross 154 | 18h 49m 49.4s | −23° 50′ 10″ | 9.7063 | M3.5Ve |
| Epsilon Eridani | 03h 32m 55.8s | −09° 27′ 30″ | 10.4749 | K2V |
| Ross 128 | 11h 47m 44.4s | +00° 48′ 16″ | 11.0074 | M4.0Vn |
| 61 Cygni A | 21h 06m 53.9s | +38° 44′ 58″ | 11.4039 | K5.0V |

RA/Dec (equatorial J2000) convert to the app's ecliptic world frame using the same obliquity rotation already used throughout the ephemeris code (the existing EQJ-to-ecliptic transform). Sirius A/B and Alpha Centauri A/B render as two separate points at their real (small, approximate at this distance) angular separation, not merged into one.

## Heliosphere and Oort cloud

**Heliosphere:** a faint, translucent double shell (termination shock, heliopause), reusing the phase 2a atmosphere shader's shell/scattering approach rather than inventing a new one. Clearly labelled in the UI and docs as a schematic boundary — nothing solid is actually there.

**Oort cloud:** phase 3's CPU-propagated Kepler-point technique (flat typed arrays of randomly-assigned but statistically realistic orbital elements, propagated each frame by the same tested Kepler solver, one `THREE.Points` draw call), extended outward and made spherical rather than flat, spanning roughly 2,000-100,000 AU. Explicitly schematic; the catalog and docs say so.

## Rendering

- Star sprites reuse the existing sprite-only distant-body rendering (size/brightness from spectral type rather than distance, since these are always far enough to never resolve as a disc).
- The heliosphere shell follows the same render-order and precision discipline as every other shell effect (log-depth and colour-space shader chunks; float64 camera-relative positions before any float32 cast).
- The Oort cloud follows phase 3's belt-point precision and clutter rules (hidden below a screen-size threshold, faded at extreme zoom).

## Testing

- **Heliosphere/Oort cloud maths (unit):** the shell scattering reference (mirrors phase 2a's atmosphere math approach) and the Oort cloud's statistical distribution plus Kepler propagation, tested the same way as phase 3's belts.
- **Star positions (unit):** the RA/Dec-to-ecliptic conversion tested against the embedded real values above; a test that the 12 stored stars match this table exactly (catches transcription errors; there is no orbital "tolerance" to measure since these are fixed catalog positions).
- **Visible smoke (headed only, never headless):** at maximum zoom, the heliosphere shell and several stars are visible with correct relative distances; Alpha Centauri's two stars appear as a close pair; no console errors; frame rate reported with the Oort cloud's full point count loaded (target 30fps or better).

## Definition of done

1. The scale knobs are raised together; the camera reaches past Proxima Centauri.
2. The heliosphere shell renders at the termination shock and heliopause, clearly schematic.
3. The Oort cloud renders as a sparse, spherical, Kepler-orbiting field, clearly schematic, with no invented named objects.
4. All 12 real stars render at their real positions and relative brightness/colour, each flyable.
5. Frame rate stays at or above target with the full population loaded.
6. All tests and the visible smoke test pass.
7. Phase 4 branches from phase 3's tip; the combined branch (containing both phases) is what gets reviewed and merged.

## Project layout additions

```
src/catalog/stars.ts            the 12 nearby stars, embedded real data, cited source
src/ephemeris/starPosition.ts   RA/Dec + distance to ecliptic Cartesian (pure, tested)
src/ephemeris/oortField.ts      Oort cloud statistical distribution + CPU Kepler propagation (extends phase 3's beltField.ts pattern)
src/render/heliosphere.ts       heliosphere shell effect (shader + tested reference maths, mirrors phase 2a's atmosphere.ts pattern)
src/render/starPoints.ts        star sprite rendering
tests/                          matching test files for the above
```

## Open items for later phases

- Nothing beyond phase 4 is currently planned; this closes out the originally scoped four-phase roadmap (core engine, planet fidelity, moons/dwarf planets + small bodies, deep space).
- If a later pass wants more stars, more of the RECONS/Gaia catalog is fetchable the same way this phase's 12 were: sourced directly and supervised, not delegated to an unattended job's expanded domain list.
