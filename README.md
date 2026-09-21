# Solar System Explorer

A browser-based 3D solar system you can zoom through continuously, from just above a planet's surface out past Neptune, using real sizes, real distances and real planetary positions. Phase 2a of a larger project (see `docs/superpowers/specs/`).

Planet fidelity in this phase: high-resolution surface maps (loaded only for nearby bodies), atmospheres, Saturn's rings with ring and planet shadows and faint rings for the other three giants, and Earth's night lights, cloud layer and ocean glint. You can descend to 0.2% of a planet's radius above its surface (about 13 km at Earth). Below about 3,800 km the 8K map is being magnified (it is about 4.9 km per texel at Earth's equator); at 1,000 km one texel already spans about 4 screen pixels; real terrain detail needs streamed tiles, which this app does not have.

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
- Physical data: NASA Planetary Fact Sheet and Sun Fact Sheet.
