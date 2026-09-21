# Solar System Explorer, Phase 2b: Moons and Dwarf Planets

Date: 2026-09-21
Status: design approved in conversation, awaiting written-spec review
Builds on: `2026-09-20-solar-system-core-design.md` (phase 1) and `2026-09-20-planet-fidelity-design.md` (phase 2a), both merged to `master`.

## Goal

Add the major moons and the dwarf planets as real, zoomable bodies with real orbits, so you can fly from a planet to its moons on the same unbroken scale: Earth to the Moon, Jupiter to Io, Saturn to Titan, the Sun to Pluto and Charon. Bodies use the phase 2a renderer unchanged.

## Scope

**26 bodies.** 21 moons: the Moon; Phobos, Deimos; Io, Europa, Ganymede, Callisto; Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus; Miranda, Ariel, Umbriel, Titania, Oberon; Triton; Charon. 5 dwarf planets: Pluto, Ceres, Eris, Haumea, Makemake.

Out of scope: eclipses and shadows on moons, ring shadows on moons, libration, irregular and small moons (Nereid, Hyperion and others), asteroids and comets (phase 3), mutual perturbations beyond mean-element precession, and special handling of orbit aliasing at the fastest time speeds (Phobos orbits in 7.6 h and strobes at 1 yr/s; documented in the README).

## Decisions

| Topic | Decision |
|---|---|
| Body count | About 27 requested; 26 as listed above (major moons and dwarf planets) |
| Architecture | Extend the existing catalog and renderer with parent/child bodies (approach A). No separate per-system layer. |
| Orbit data | Bundled mean orbital elements for what astronomy-engine does not cover; astronomy-engine for the Moon, Jupiter's four Galilean moons and Pluto |
| Imagery | Real NASA/USGS/mission global maps where they exist and are verified; plain honest colour with subtle shading where they do not; no artist-drawn maps presented as imagery |
| First task | The deferred GLSL/TS constant linkage cleanup from phase 2a |

## Facts established while designing (verified 2026-09-21)

- astronomy-engine supports the Moon (`GeoMoon`), Jupiter's four Galilean moons (`JupiterMoons`) and Pluto (`Body.Pluto`, heliocentric). It has nothing for any other moon, Charon, Ceres, Eris, Haumea or Makemake.
- Solar System Scope provides an 8K Moon map and only artist-drawn "fictional" maps for Ceres, Eris, Haumea and Makemake. It has no map for any other moon and none for Pluto. So real maps for the other bodies must come from NASA/USGS/mission archives.

## Data model, orbits and orientation

- `BodyData` gains `parent` (a planet; the Sun for dwarf planets) and a kind of `moon` or `dwarf`, and an `orbit` source: `astronomy-engine` (Moon, Galilean moons, Pluto) or bundled mean elements (semi-major axis, eccentricity, inclination, node, periapsis, mean longitude at epoch, and their rates, with the reference plane recorded).
- **Position:** a moon's heliocentric position is its parent's position plus a relative offset, summed in float64, so the phase 1 precision rules apply unchanged. The relative offset is a Keplerian solution with secular precession. Satellite elements are quoted against the planet's Laplace plane or equator, so they are rotated into the ecliptic using the planet's IAU pole. The per-frame computation orders parents before children.
- **Orientation:** every new body gets its IAU pole (right ascension, declination) and prime-meridian angle (W0 plus a linear rate) from bundled constants (linear terms only, no libration series); tidally locked moons rotate once per orbit. Earth keeps its sidereal-time special case; the Moon may use either astronomy-engine or the generic path, whichever the tests show is right.
- **Accuracy:** pinned by tests against a few JPL Horizons reference states: tight for astronomy-engine bodies, and a stated bound (target about 2 degrees of orbital phase for the major satellites within roughly 1950-2050) for element-based ones. Error grows away from the present; documented.

## Content and asset pipeline

- **Facts** (radius, mass, rotation period, tilt, gravity, mean temperature) from NASA's satellite fact sheets, each with a `source` string, like the planets. The info panel also shows the orbital period around the parent.
- **Elements:** JPL's published mean-element tables for the planetary satellites and JPL's small-body database for Ceres, Eris, Haumea and Makemake, bundled as one typed data file with source and epoch cited. Transcription errors are the main risk, so tests check consistency: the period implied by the semi-major axis and the parent's mass must match the known period, and Horizons reference positions bound the phase error.
- **Rotation constants:** the IAU working group's 2015 report, bundled the same way.
- **Imagery:** a research step first confirms each candidate map's URL, licence, resolution and projection (equirectangular only; public domain or clearly attributed; 2K maximum each, the Moon keeps its 8K). Likely sources: USGS Astrogeology and NASA mosaics for the Galilean moons, Cassini mosaics for Titan and the Saturn moons, Voyager for Triton and the Uranian moons (partial coverage), New Horizons for Pluto and Charon, Dawn for Ceres. Bodies with no usable map, or with coverage gaps, get plain colour with subtle shading, and the info panel says "no global map available". Each source is credited in the README. The download script keeps deriving its file list from the catalog.

## Rendering, camera and interface

- **Rendering** reuses phase 2a: each new body is a `BodyView` with the shared surface shader and the budgeted texture tiers. All new moon maps are 2K, so the hi-res budget logic is unchanged (the Moon's 8K joins Earth's; the smoke test's texture-count bound rises from 4 to 5). Titan and Pluto get atmosphere entries (orange and blue haze); no other new body has one.
- **Orbit lines:** moon orbits are sampled parent-relative in float64 and offset by the parent's position each frame; they fade by the existing distance-versus-orbit-radius rule, so they appear only near that planet.
- **Clutter control:** a moon's label shows only when the camera is near its parent relative to the moon's orbit radius, and ranks below planets in the existing declutter; a moon's sprite is skipped when it would overlap its parent's dot on screen.
- **Body list:** hierarchical (planets expand to their moons; dwarf planets at the top level). Selecting anything flies the camera there with the existing log-space flight.
- **Camera and precision:** everything in the camera controller is radius-relative, so tiny bodies work (Phobos is about 11 km across; 22 m minimum altitude). Relative offsets are float64 sums.

## Testing

- **Unit (Vitest):** Kepler solver, precession, and the Laplace-plane-to-ecliptic rotation; per-body period consistency; tidal locking (rotation period equals orbital period for locked moons); astronomy-engine bodies against astronomy-engine and element bodies against Horizons reference states within the stated bound; catalog invariants (parents exist, no cycles, complete element sets, all needed texture files listed); frame ordering (parents before children); pure rules with tests: the list-tree builder, the label and orbit-line fade rules, and the sprite-overlap rule.
- **Visible smoke (headed only, never headless):** fly Earth to the Moon; see Jupiter's four moons near Jupiter; see Titan's haze; descend to Phobos's minimum altitude; no console errors; a frame-rate readout with all 36 bodies.

## Definition of done

1. All 26 bodies are present with parents, real elements, facts and cited sources.
2. Positions match astronomy-engine for its bodies and stay within the stated bound against Horizons for element-based bodies.
3. The camera zooms continuously from a moon's surface (0.2% of its radius) out to the whole system and back, and flies between a planet and its moons.
4. Real maps are used where verified, honest fallbacks elsewhere, attribution is complete, and the info panel says when there is no global map.
5. Titan and Pluto have atmospheres; moon labels and orbit lines appear only near their parent; there is no clutter at the full-system view.
6. The body list is hierarchical.
7. All tests and the visible smoke pass; the frame rate with all bodies is reported (target 30 or better).
8. The deferred GLSL/TS constant linkage cleanup is done first (shader constants exported from the TypeScript reference modules and interpolated into the GLSL, so the two cannot drift).

## Project layout additions

```
src/catalog/orbits.ts        bundled mean elements and IAU rotation constants (cited)
src/ephemeris/kepler.ts      Kepler solver, precession, frame rotation (pure, tested)
src/ephemeris/moons.ts       parent-relative state for element-based bodies
src/ui/bodyTree.ts           pure hierarchical list builder (tested)
src/render/orbitFade.ts      pure orbit-line, label and sprite-overlap rules (tested)
docs/                        texture source research note
```

## Open items for later phases

- Phase 3: small bodies (asteroid and Kuiper belts, comets) will reuse the parent-relative and element machinery built here.
- Eclipses and ring shadows on moons; libration; irregular and small moons.
- Streamed tiles and terrain (deferred since phase 2a); the flat 12.7 km ocean view noted in the 2a backlog.
