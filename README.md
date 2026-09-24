# Solar System Explorer

A browser-based 3D solar system you can zoom through continuously, from just above a planet's surface out past Neptune, using real sizes, real distances and real planetary positions. Phases 1, 2a and 2b of a larger project (see `docs/superpowers/specs/`).

Planet fidelity in this phase: high-resolution surface maps (loaded only for nearby bodies), atmospheres, Saturn's rings with ring and planet shadows and faint rings for the other three giants, and Earth's night lights, cloud layer and ocean glint. You can descend to 0.2% of a planet's radius above its surface (about 13 km at Earth). Below about 3,800 km the 8K map is being magnified (it is about 4.9 km per texel at Earth's equator); at 1,000 km one texel already spans about 4 screen pixels; real terrain detail needs streamed tiles, which this app does not have.

## Moons and dwarf planets (phase 2b)

35 bodies in all: the Sun, the eight planets, 21 moons (the Moon; Phobos and Deimos; Io, Europa, Ganymede and Callisto; Mimas, Enceladus, Tethys, Dione, Rhea, Titan and Iapetus; Miranda, Ariel, Umbriel, Titania and Oberon; Triton; Charon) and 5 dwarf planets (Pluto, Ceres, Eris, Haumea and Makemake). Pick a planet's chevron in the body list to see its moons; clicking any of them flies there on the same unbroken scale, down to 0.2% of the moon's radius (about 22 m over Phobos). A moon's orbit line and label appear only when the camera is near its parent.

**Orbits.** The Moon, Jupiter's four Galilean moons and Pluto come from astronomy-engine. The other 16 moons use JPL's planetary satellite mean elements (a Keplerian orbit with secular precession of the node and periapsis, measured in each planet's Laplace plane and rotated into the J2000 ecliptic); Ceres, Eris, Haumea and Makemake use JPL Small-Body Database osculating elements (two-body motion from the element epoch). A moon's position is its parent's position plus its offset, summed in float64.

**Measured accuracy** (angle between our parent-relative position and JPL Horizons, at 1975-01-01, 2000-01-01, 2026-09-21 and 2050-01-01; `npx vitest run tests/ephemeris/moons.test.ts --silent=false` prints the table): astronomy-engine bodies (the Moon, the four Galilean moons, Pluto): at most 0.0252 degrees (Io, 2050). Element-based moons: Ariel, Umbriel, Titania and Oberon are within 0.3 degrees, Miranda within 2.6 and Enceladus within 6.3 at all four dates. **Six moons are wrong at every date, including today, by a roughly constant amount (a base-angle mismatch in their tabulated elements that I could not explain): Tethys (about 60 degrees), Dione (about 151), Rhea (about 157), Titan (about 157), Iapetus (about 140), and Mimas (26 to 50 degrees, varying).** Phobos, Deimos and Triton are right at J2000 and drift away from it (worst 166, 155 and 27 degrees at 2050 or 1975). So the moons in Saturn's system other than Enceladus show a plausible but wrong point on a correctly shaped orbit; the worst case anywhere is 165.6 degrees (Phobos, 2050) among the moons that drift and 157.4 (Rhea, 2000) among the constant-offset ones. Dwarf planets (Ceres, Eris, Haumea, Makemake): at most 3.51 degrees (Ceres, 1975; osculating elements at one epoch grow stale away from it). 13 bodies have a recorded `PHASE_BOUND_DEG` above the default 2 degrees: Europa (3.2, a validation check against astronomy-engine, not Horizons), Phobos, Deimos, Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus, Miranda, Triton and Ceres (each measured value and its cause is commented in `tests/ephemeris/moons.test.ts` and `src/catalog/orbits.ts`). An earlier version of these notes blamed source precision for the Uranian moons; that was wrong. Their table gives the sidereal period, and the precession was being counted twice, which is now fixed.

**Orientation.** The Moon and Pluto use astronomy-engine's IAU model; bodies with bundled IAU constants use their linear terms (pole and prime-meridian rate, no libration) — none currently, because no allowed source gave a prime-meridian W0 constant for any moon or dwarf planet, so `ROTATIONS` in `src/catalog/orbits.ts` is empty (a rotation pole alone, found only for Ceres, is not enough); other moons are treated as tidally locked (prime meridian toward the parent, pole along the orbit normal): Phobos, Deimos, Io, Europa, Ganymede, Callisto, Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, Triton and Charon; a dwarf planet without a known pole spins about the ecliptic north pole at its catalog period: Ceres, Eris, Haumea and Makemake.

**Maps.** Real global maps are used only where a source page verified projection, longitude convention, coverage and licence (`docs/texture-sources.md` has the full research table, including every rejection). Every other body is drawn in a plain colour with Lambert shading and the info panel says "No global map available: plain colour shown." Solar System Scope's Ceres, Eris, Haumea and Makemake maps are artist-drawn ("fictional") and deliberately not used.

**Known limits.** No eclipses or shadows on moons, no libration, no irregular or small moons (Nereid, Hyperion and others), no mutual perturbations beyond mean-element precession. At the fastest time speeds orbits alias: Phobos circles Mars in 7.6 hours (about 1,150 times a year), so at one year per second it strobes; that is expected, not a bug.

## Phase 3: small bodies

Added: two schematic belts (4000 main-belt points, 3000 Kuiper-belt points, toggled by "Belts"), 8 named small bodies (the asteroids Vesta, Pallas, Hygiea and Juno; the comets Halley, Hale-Bopp, 67P/Churyumov-Gerasimenko and Swift-Tuttle, listed in a collapsible "Small bodies" group), and comet tails. That makes 43 bodies. Quaoar, Orcus, Sedna and Gonggong were planned but dropped because no radius could be sourced (see `docs/small-body-sources.md`).

**The belts are schematic.** They are hand-shaped statistical fields (a hump with Kirkwood gaps; a classical belt with a plutino bump), NOT individual real objects; every tuning constant is listed in `docs/small-body-sources.md`. They fade out when the camera is close to a body.

**Accuracy.** Named bodies are two-body Keplerian from the JPL Small-Body Database epoch: no planetary perturbations, and comets ignore non-gravitational forces (outgassing). Measured against JPL Horizons at the committed epochs, the worst heliocentric direction error is 0.22 to 4.6 degrees (Swift-Tuttle 0.22, Halley 0.29, Hale-Bopp 0.66, Vesta 1.44, C67P 2.22, Hygiea 3.12, Pallas 3.57, Juno 4.57) and the worst distance error 0.2% to 2.1% (full table in `docs/small-body-sources.md`).

**Comet tails** are a stylised effect: a stretched billboard pointing away from the Sun, longest near the Sun and absent far from it. It is not a physical dust or ion simulation.

**Frame rate** (measured by `npm run smoke` in a visible Chromium window on the development machine, 2026-09-24): 119.7 fps at the full-system view with 43 bodies and both belts, 120.0 fps near Halley with its tail (the display refresh rate is the cap).

**Hooks** for tests: `window.__solar.beltCounts()`, `setBelts(on)`, `beltsVisible()`, `tailsVisible()`, alongside the existing `flyTo`, `focusId`, `setTime`, `setView`, `setEffects`, `pixelStats`, `litPixels`, `fps` and `labelsShown`.

**Credits.** JPL Small-Body Database and Horizons (`ssd-api.jpl.nasa.gov`); NASA/NSSDC and `science.nasa.gov` pages for radii cross-checks.

**Deferred.** Trojans and resonant populations as separate objects, more named Kuiper objects, a physical dust or ion tail, collisions or belt evolution, image maps for small bodies, parabolic or hyperbolic orbits, non-gravitational comet forces, planetary perturbations of the named objects, GPU-side Kepler propagation, an Oort cloud.

## Run

    npm install
    npm run textures     # downloads the 2K/8K texture set, about 55 MB (not committed)
    npm run dev          # http://localhost:5173

Scroll or pinch to zoom, drag to orbit, click a body in the list to fly there. The time bar controls speed, direction and date (UTC).

### Textures and GPU memory

The set mixes resolutions because that is what exists: 8K (8192x4096) for Earth (day, night and clouds), Mars and Mercury; 4K (4096x2048) for the Sun, Jupiter and Saturn, whose files are named `8k_*` but are only 4096x2048; and 2K for Uranus and Neptune, because no higher-resolution maps exist for them. Venus's base map is a 4K cloud-top image. The high-resolution tier is loaded only for nearby bodies, and `HI_RES_BUDGET` (in `src/render/lod.ts`) limits it to two bodies at once so GPU memory stays bounded (Earth alone holds three large maps).

## Test

    npm test             # unit tests (Vitest)
    npm run typecheck
    npm run smoke        # end-to-end check in a visible Chromium window (needs a display)

## How the scale works

All positions are float64 metres in the heliocentric ecliptic J2000 frame. Every frame they are subtracted from the camera position in float64 and only then cast to float32 for the GPU, so the render camera is always at the origin and float32 jitter is avoided by construction. This was checked by eye from about 1.27e4 m above Earth's surface out to about 1.2e13 m (past Neptune), not with an automated precision test. A logarithmic depth buffer covers the near/far range.

## Credits

- Planet positions and orientations: [astronomy-engine](https://github.com/cosinekitty/astronomy) (VSOP87, IAU rotation model).
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0, based on NASA imagery and elevation data.
- Physical data: NASA Planetary Fact Sheet and Sun Fact Sheet; NASA NSSDC satellite fact sheets; JPL Planetary Satellite Physical Parameters (`ssd.jpl.nasa.gov/sats/phys_par`).
- Moon and dwarf-planet orbits: JPL Planetary Satellite Mean Elements (`ssd.jpl.nasa.gov/sats/elem`) and the JPL Small-Body Database; accuracy checked against JPL Horizons.
- Moon and dwarf-planet rotation: the IAU Working Group on Cartographic Coordinates and Rotational Elements (2015 report, Archinal et al. 2018); none of its constants are currently used, because `ROTATIONS` in `src/catalog/orbits.ts` is empty (see Orientation above).
- Moon and dwarf-planet maps: the Moon from Solar System Scope (CC BY 4.0); every other map credited here as it is added: Ceres from NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn Framing Camera global mosaic, 400 m/pixel, public domain, "please cite authors") (bodies with no map are drawn in a plain colour).
