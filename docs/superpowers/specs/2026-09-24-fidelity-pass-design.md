# Solar System Explorer, Phase 5: Fidelity Pass and Night Sky

Date: 2026-09-24
Status: design approved
Builds on: phases 1 through 4, all merged to `master`.

## Goal

Fix the real defects the project has been carrying since earlier phases, add real shadows between bodies, and add a real, accurate background night sky — without growing the app's scope, UI surface, or flyable-body count.

## Scope

**In scope:**
1. Fix the moon orbital-phase bug (several moons sit at the wrong point along an otherwise correct orbit).
2. Fix the planetary terminator seam (a hard, visibly wrong line at the day/night boundary on every planet).
3. Real shadows/eclipses between bodies (a moon's shadow on its planet, a planet's shadow on its moons).
4. Investigate and, if confirmed, fix the flat, washed-out view at a planet's minimum camera altitude.
5. 48 real named stars ("notable stars"), each labeled, none flyable, none in the body list.
6. ~5,000 real unlabeled background stars at the true naked-eye magnitude limit.

**Out of scope:** any new flyable body; a Milky Way band or deep-sky objects (nebulae, galaxies); real stellar proper motion for the background/notable stars (same "fixed over the app's date range" treatment as phase 4's 12 nearby stars); extending the camera's reachable range to real interstellar distances (see Architecture below — this is a deliberate, disclosed simplification, not an oversight).

## Data (already fetched, verified, and committed)

Source: HYG Database v4.4 (Hipparcos, Yale Bright Star and Gliese catalogs combined), CC BY-SA 4.0, fetched directly (not delegated to the unattended build) from `codeberg.org/astronexus/hyg`, 119,614 stars total. Processed and committed at `docs/data/`:
- `notable-stars-hyg.csv`: 48 real named stars, apparent magnitude ≤ 2.0 (Sirius, Canopus, Arcturus, Rigil Kentaurus, Vega, Capella, Rigel, Procyon, Achernar, Betelgeuse, Hadar, Altair, Acrux, Aldebaran, Spica, Antares, Pollux, Fomalhaut, Mimosa, Deneb, Toliman, Regulus, Adhara, Castor, Gacrux, Shaula, Bellatrix, Elnath, Miaplacidus, Alnilam, Alnair, Alnitak, Polaris, and 15 more). Columns: name, RA (hours), Dec (degrees), magnitude, distance (parsecs), spectral type, B-V colour index, constellation.
- `background-starfield-hyg.csv`: 5,022 real stars, apparent magnitude ≤ 6.0 (the traditional naked-eye limit), excluding the 48 notable stars and the Sun. Columns: RA, Dec, magnitude, colour index.
- `docs/data/README.md` documents provenance and columns.

## Architecture: how the sky stars differ from phase 4's 12 nearby stars

Phase 4's 12 nearby stars are within the camera's actual reachable range (out to 10.6 ly) and are positioned at their true distance, flyable, with real per-body altitude. The notable and background stars in this phase are NOT: several (Deneb, Rigel, Betelgeuse) are hundreds to over a thousand light-years away — far beyond any reachable camera distance, and extending the camera's scale knobs that far would be real scope growth for no practical benefit (nothing else is ever reachable out there, and the app's whole camera model is built around traveling between real, reachable bodies).

**Decision: render the notable and background stars as a fixed-distance sky layer, real direction, not real distance.** Each star's direction (unit vector from the solar system's origin, computed from its real RA/Dec the same way phase 4's nearby stars are) is real. Its rendered position is that direction times a large fixed radius placed just inside the far clip plane, not its true parsec distance. This is the same principle a planetarium dome or a game's skybox uses, and it is honestly disclosed: the UI and README say these stars are shown in their real direction but not their real distance, and are not reachable by the camera. Because the app's actual travel range (≤10.6 ly) is negligible next to these stars' real distances (tens to over a thousand light-years), the parallax lost by this simplification is far below one pixel — nothing is being faked in a way that would ever be visible even if it were modeled precisely.

## Rendering

- **Background starfield (5,022 stars):** one `THREE.Points` draw call, same low-cost mechanism as phase 3's belts and phase 4's Oort cloud. Per-point size/brightness from real apparent magnitude (brighter = larger/more opaque, continuously, not bucketed); colour from the real B-V colour index via a standard colour-index-to-RGB approximation (real, computed, not invented). No labels, no interactivity, no info panel, not in the body list.
- **Notable stars (48 stars):** the same point rendering as the background, plus a text label (the star's common name) that fades in with distance/altitude the same way planet and moon labels already do. Still not flyable, not in the body list, no info panel — a visual layer only, as requested.
- **Visibility toggle:** a new toggle, separate from the existing "Deep space" toggle (which controls the heliosphere and Oort cloud, both only relevant at vast zoom). The night sky is visible at any altitude, including close to a planet — like a real starry sky seen from the ground — so it needs its own on/off control, defaulted on.
- **Draw order and precision:** stars render behind every real body (their fixed radius sits near the far clip plane); positions and directions follow the same float64-then-cast-to-float32 discipline as everywhere else in the app.

## The bug-fix and shadow items

- **Moon orbital-phase bug:** revisit the six-plus moons (Dione, Rhea, Titan, Iapetus, Phobos, Deimos, and others per phase 2b's final disclosure) that sit at the wrong point along their orbit. Two earlier debugging rounds ruled out the frame convention and found real per-body data-precision limits for some; this pass gets a fresh angle, informed by everything already ruled out, documented in phase 2b's own report.
- **Terminator seam:** the hard Lambert lighting edge at every planet's day/night line, present since phase 2a, gets the soft-wrap fix already sketched in the deferred backlog.
- **Shadows/eclipses:** reuse the ring-shadow and atmosphere-shadow shader math already built (phase 2a/2b) to add body-on-body shadows — a moon's shadow crossing its planet, a planet's shadow falling on its moons. Scoped to real, currently-modeled bodies only (not the schematic belts, Oort cloud, or the new sky stars).
- **Minimum-altitude cloud wash:** investigate whether Earth's cloud shell (flagged but never confirmed in phase 2a's final review) is the cause of the flat, washed-out view at the camera's closest approach, and fix it if confirmed.

## Testing

- **Star data (unit):** the notable and background star lists match the committed CSVs exactly (transcription test, same pattern as phase 4's 12 stars); RA/Dec-to-direction conversion tested; colour-index-to-RGB conversion tested against known reference colours (a hot blue-white star, a Sun-like star, a cool red star).
- **Moon orbit fix (unit):** the specific moons previously flagged wrong are re-checked against the same Horizons reference states already bundled from phase 2b/3, with the new measured error recorded (whether fixed or still bounded, honestly).
- **Terminator and shadow shaders (unit):** reference maths for the soft-wrap lighting term and the new body-on-body shadow test, mirrored into GLSL per the established linkage discipline.
- **Visible smoke (headed only, never headless):** the night sky renders at both a close planetary view and the deep-space view; a notable star's label is visible and legible; toggling the new sky toggle hides it; at least one previously-wrong moon is visually closer to its real position at the current date; a visible shadow appears in a body-on-body eclipse case; no console errors; frame rate reported with everything loaded (target 30fps or better).

## Definition of done

1. The moon orbital-phase bug is fixed for as many of the flagged moons as a fresh, well-documented debugging pass can resolve; any that remain wrong are still honestly disclosed, as before.
2. The terminator seam is gone or clearly softened on every planet.
3. At least one real body-on-body shadow/eclipse case renders visibly and correctly.
4. The minimum-altitude cloud-wash issue is either fixed or its real cause is documented if it turns out not to be fixable within this phase's scope.
5. 48 notable stars render with labels; ~5,000 background stars render without labels; both are real data, honestly disclosed as direction-accurate but not distance-accurate.
6. A dedicated toggle controls the night sky independently of the existing "Deep space" toggle.
7. All tests and the visible smoke test pass, frame rate at or above target.

## Project layout additions

```
src/catalog/skyStars.ts          notable and background star data, transcribed from docs/data/*.csv, tested against it
src/render/skyStarPoints.ts      background starfield rendering (THREE.Points, magnitude/colour-index driven)
src/render/skyStarLabels.ts      notable-star label layer (reuses the existing label fade pattern)
src/render/colorIndex.ts         B-V colour index to RGB, tested against known reference colours
src/render/bodyShadows.ts        body-on-body shadow effect (shader + tested reference maths)
docs/superpowers/plans/          the implementation plan for this spec
```

## Open items for later

- A Milky Way band or deep-sky objects, if ever wanted, would follow the same "real direction, fixed sky-sphere distance" pattern established here.
- The moon orbital-phase bug may not be fully resolvable within this phase if it turns out to be a genuine source-data precision limit (as phase 2b's own debugging found for some bodies); if so, this phase's job is to get as far as real evidence allows and disclose the rest honestly, not to force a fix.
