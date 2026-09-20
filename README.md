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

All positions are float64 metres in the heliocentric ecliptic J2000 frame. Every frame they are subtracted from the camera position in float64 and only then cast to float32 for the GPU, so the render camera is always at the origin and float32 jitter is avoided by construction. This was checked by eye from about 1.27e5 m above Earth's surface out to about 1.2e13 m (past Neptune), not with an automated precision test. A logarithmic depth buffer covers the near/far range.

## Credits

- Planet positions and orientations: [astronomy-engine](https://github.com/cosinekitty/astronomy) (VSOP87, IAU rotation model).
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0, based on NASA imagery and elevation data.
- Physical data: NASA Planetary Fact Sheet and Sun Fact Sheet.
