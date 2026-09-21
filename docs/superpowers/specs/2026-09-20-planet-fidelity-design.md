# Solar System Explorer, Phase 2a: Planet Fidelity

Date: 2026-09-20
Status: design approved in conversation, awaiting written-spec review
Builds on: `2026-09-20-solar-system-core-design.md` (phase 1, merged to `master`)

## Goal

Make the eight planets and the Sun look as real as the free data allows, and let the camera get much closer: 8K surface maps, atmospheres, Saturn's rings with real shadows, faint rings for the other giants, and Earth's night lights, clouds and ocean glint. Planets keep the same real sizes, positions and orientation as phase 1.

## Project position

Phase 2 was split during brainstorming. This spec covers **2a, planet fidelity** only. **2b, moons and dwarf planets**, gets its own spec (it needs a data source beyond astronomy-engine and a parent-child focus hierarchy) and reuses the renderer built here. Phases 3 (small bodies) and 4 (deep space) are unchanged.

## Decisions

| Topic | Decision |
|---|---|
| Close-up approach | Static 8K maps bundled locally (downloaded by script, works offline). No streamed tiles or terrain in 2a. |
| Minimum altitude | Drops from 2% to 0.2% of the focused body's radius (about 13 km at Earth). The floor is what the mesh detail and camera precision allow, not what the texture resolves: an 8K map is about 4.9 km per texel at Earth's equator, so the map is magnified below roughly 3,800 km altitude (about one texel per pixel at 720p and a 50 degree field of view); at 1,000 km one texel already spans about 4 screen pixels. Real terrain detail there needs streamed tiles, which is out of scope. |
| Renderer | Extend the phase 1 mesh renderer (approach A). Each body's surface renderer sits behind a small interface so a ray-cast or streamed-tile backend can replace it later without touching the camera, HUD or ephemeris. |
| Effects in scope | Atmospheres for every planet that has one; Saturn's rings with shadows; faint rings for Jupiter, Uranus and Neptune; Earth night lights, clouds and ocean glint. |
| Texture source | Solar System Scope, CC BY 4.0 (same as phase 1). |

## Texture availability (verified 2026-09-20)

Files named 8k_* exist for Mercury, Venus surface, Earth (day, night, clouds), Mars, Jupiter, Saturn (plus a ring alpha PNG), the Sun and the Moon. Measured after download: Earth (all three), Mars and Mercury are truly 8192 x 4096, but the Jupiter, Saturn and Sun files are only 4096 x 2048. The "hi" tier is therefore 8K for Earth, Mars and Mercury and 4K for Jupiter, Saturn and the Sun; the tier logic is identical. A 4K Venus cloud-top map exists. Uranus and Neptune have only 2K maps (nearly featureless in reality, so nothing is lost). Earth has no specular or normal map on this source, so the ocean mask is derived from the day map.

## Architecture

Phase 1's ephemeris, clock, camera controller and HUD are unchanged in structure. New work is in the render layer and the catalog.

| Unit | Job |
|---|---|
| `catalog` (extended) | Per body: texture files per tier (2K always; 8K where it exists; 4K for the Venus cloud map), optional night map, cloud map, `atmosphere` spec (Rayleigh colour, Mie strength and asymmetry, shell height and scale height as fractions of radius), `rings` spec (inner and outer radius in metres, an alpha map file or a procedural band list `{centerKm, widthKm, opacity}`), and `oceanGlint` (strength, shininess). |
| `render/lod` (pure) | `pickMeshDetail(screenPx, current)` and `wantsHiTexture(screenPx, currentlyHi)` with hysteresis. Unit-tested. |
| `render/textureManager` | Keeps every body's 2K map resident; loads 8K only for the bodies that most need it (budget of two), chosen by a pure, tested `chooseHiRes(candidates, budget)`; disposes the rest. Async, with fallback to the current tier on any load failure. |
| `render/surfaceMaterial` | One custom shader factory replacing the standard material. Lambert lighting from the Sun (same intensity model as phase 1, faint ambient) plus feature switches: night map, ring shadow, ocean glint. |
| `render/bodyView` (extended) | Coordinates one body's parts: surface mesh (two shared detail levels), sprite, and optional atmosphere, rings, cloud shell. Receives the sun direction and the camera offset in body radii each frame. |
| `render/atmosphere` | Shell mesh plus scattering shader; CPU reference maths in `render/atmosphereMath` (tested). |
| `render/rings` | Ring annulus mesh plus shader; CPU reference maths in `render/ringMath` and `render/ringProfile` (tested). |
| `render/earthMaterial` config | Earth-specific parameters expressed through `surfaceMaterial` switches and the cloud shell, not a separate hard-coded path. |

Per-frame data flow is unchanged: `clock`, `ephemeris` (float64), `camera`, `SolarScene.render` (camera-relative), then per body `BodyView.update(entry, cameraPos, ctx)` where `ctx` carries the sun direction, camera offset in body radii (float64 on the CPU) and viewport data.

## Surface detail and the closer camera

- **Mesh detail:** two shared sphere geometries. Near: about 512 x 384 segments; far: 128 x 96 (phase 1). Near is used when the disc is at least 150 px across (switch back below 120 px). This cuts horizon sag at Earth from about 1.9 km to about 0.1 km.
- **Texture tiers:** 2K resident for every body. 8K is requested when the disc reaches 600 px across (released below 450 px), subject to the budget of two bodies; when the budget is full, the bodies with the largest apparent size keep 8K. If the GPU's max texture size is below 8192, the hi tier is disabled and bodies stay at 2K (there are no 4K files for most maps). Earth's night and cloud maps follow the same rule: 2K resident, 8K in the hi tier, so lights and clouds do not pop in when Earth crosses the threshold.
- **Camera:** `MIN_ALTITUDE_FRACTION` changes from 0.02 to 0.002. The near plane already follows at 5% of altitude (about 640 m at the new Earth minimum); float32 error at that range is about 0.5 m. `MAX_CAMERA_DISTANCE_M`, `FAR_M` and the near-plane cap stay as they are (phase 4 raises them together).
- **Venus:** its base map is the 4K cloud-top map, because the surface is invisible under its haze.
- **Downloads:** `npm run textures` fetches the 8K set (roughly 100-200 MB, git-ignored), keeps the JPEG/PNG magic-byte and size checks, and skips files already present. Its file list is derived from the catalog (the script imports the TypeScript catalog directly), so the list cannot drift from what the renderer asks for.
- **GPU memory:** an 8K colour map is about 180 MB on the GPU with mipmaps, so the budget of two bodies is a named constant (`HI_RES_BUDGET`); with Earth holding three 8K maps the worst case is a little over 700 MB. Greyscale (single-channel) upload for the cloud map is a known way to cut this and is left for later.

## Atmospheres

- **Shape:** a shell sphere at radius R x (1 + h), drawn with front faces when the camera is outside the shell and back faces when inside it (checked each frame). Premultiplied blending (adds in-scattered light and dims what is behind it), no depth write.
- **Shading:** per pixel, intersect the view ray with the planet and the shell analytically, take 12 samples along the ray for single scattering (Rayleigh, wavelength-dependent, plus Mie with a Henyey-Greenstein phase), with exponentially falling density; 4 samples toward the Sun for the light path, which gives twilight reddening and a dark night side.
- **Per body:** Earth thin and blue; Mars thin and dusty; Venus thick and pale yellow (hides the surface); Jupiter, Saturn, Uranus, Neptune wide, soft, muted glows (pale gold, pale gold, cyan-green, deep blue). Mercury and the Sun have none.
- **Precision:** the camera's offset from the body centre in body radii is computed in float64 on the CPU and passed as a uniform; the view direction comes from the vertex position (already camera-relative).
- **Cost control:** the shell is hidden when the body is under 20 px across. Output goes through the standard colour-space conversion so it matches the surface.
- **Testing:** the ray-sphere intersection and optical-depth integral have a tested TypeScript reference; the shader is checked in the visible smoke test (blue-dominant pixels at Earth's limb, dark night side).

## Rings

- **One ring shader, two sources.** A flat annulus in the body's equatorial plane, oriented from the same IAU frame as the planet, reading a 1D opacity profile by radius:
  - **Saturn:** the 8K ring alpha map, a strip whose x axis runs radially (the 2K version is 2048 x 125 RGBA with identical rows). Radii: inner 66,900 km (D ring), outer 140,220 km (F ring). Checked against the real texture: its alpha profile puts the Cassini Division at 71% of the strip width and the bright B ring at 34-70%, which matches those radii (an inner radius of 74,500 km would not).
  - **Jupiter, Uranus, Neptune:** a 2048-sample profile generated from a band list in the catalog. Jupiter: halo 92,000-122,500 km (0.02), main 122,500-129,000 (0.08), gossamer 129,000-182,000 (0.01) and 129,000-226,000 (0.005). Uranus: nine narrow rings 6, 5, 4, alpha, beta, eta, gamma, delta, lambda at centres 41,837; 42,234; 42,570; 44,718; 45,661; 47,176; 47,627; 48,300; 50,024 km with widths of 1.6 to 8.2 km and opacity 0.3, plus epsilon at 51,149 km (about 58 km wide, opacity 0.5). Neptune: Galle 41,900 km (2,000 wide, 0.02; ring span 40,000-64,000 km), Le Verrier 53,200 (113 wide, 0.05), Lassell/Arago 53,200-57,200 (0.01), Adams 62,933 (35 wide, 0.05). These are faint and thin, so they are mostly invisible until you are close, which matches reality. Overlapping bands take the maximum opacity.
- **Lighting:** lit on the Sun side; from the far side only the light transmitted through the ring shows (dark against the lit planet, glowing against shadowed sky).
- **Shadows:** the planet shadows the ring (analytic ray-sphere test toward the Sun, soft edge from the Sun's angular size). The ring shadows the planet: for each surface point, trace toward the Sun, find where it crosses the ring plane, and dim by the opacity at that radius. This uses the ring shadow switch in `surfaceMaterial`.
- **Draw order:** planet, then rings (depth-tested, no depth write), then atmosphere shell. Rings hide when the body is drawn as a sprite.
- **Testing:** tested TypeScript references for ray-sphere, ray-plane crossing and radial lookup, plus the band-to-profile builder (overlap, edges, clamping). Cassini alignment and appearance are checked in the visible browser.

## Earth extras

- **Day and night:** the shader blends the day map into the 8K night-lights map across a soft terminator (a smooth step on the Sun's cosine from -0.08 to 0.12). Earth's orientation already comes from sidereal time, so city lights fall on the correct side for the date on the time bar.
- **Clouds:** the 8K cloud map on a second shell 0.15% of radius above the surface (about 9.6 km), same Lambert lighting, opacity from the map, dimming the city lights beneath. Clouds stay fixed to the surface (the map is one real snapshot; drifting it would be invented weather).
- **Ocean glint:** a water mask derived in the shader from the day map (strongly blue, not bright, so ice and clouds are excluded), then a Blinn-Phong highlight from the Sun-camera half vector; clouds suppress it.
- **Height check:** the cloud shell altitude must be below the minimum camera altitude (9.6 km versus 12.7 km at Earth); a test asserts it.
- **Fallbacks:** a missing night or cloud file turns that feature off; the planet still renders.

## Error handling

- Missing 8K file: the body stays at the lower tier, silently.
- GPU max texture size under 8192: top tier capped at 4K.
- Shader compile failure: log one console error (which fails the smoke test) and disable only that effect.
- Everything from phase 1 (WebGL 2 check, flat-colour fallback for a missing texture) is kept.

## Testing

- **Unit (Vitest):** `lod` pickers and hysteresis; `chooseHiRes` budget logic; `atmosphereMath`, `ringMath`, `ringProfile` references; catalog invariants (ring inner < outer, atmosphere height positive, cloud shell below the minimum altitude, every texture file name present in the download list); the camera's new minimum altitude constant and clamp.
- **Visible smoke (headed, never headless), extended:** a debug hook to set the view (focus, yaw, pitch, altitude), then checks for: a lit patch on Earth's night side (city lights), blue-dominant limb pixels at Earth, ring pixels at Saturn, a bound on the number of GPU textures alive, a frame-rate readout, and no console errors.
- **By eye:** before/after screenshots that Mercury and Mars (no new effects besides Mars's thin atmosphere) still look like phase 1 lighting; horizon smoothness at the new minimum altitude; Cassini Division alignment.

## Definition of done

1. `npm run textures` downloads the 8K set and every listed map loads.
2. The camera descends to 0.2% of radius (about 13 km at Earth) and zooms back to Neptune with no faceted horizon and no console errors.
3. At most two bodies hold 8K maps at once.
4. Atmospheres show on Earth, Venus, Mars and the four giants, and not on Mercury or the Sun.
5. Saturn's rings show the Cassini Division at the right radius and cast and receive shadows; Jupiter, Uranus and Neptune have their faint rings.
6. Earth shows night lights, clouds and ocean glint.
7. Planets without new effects look like phase 1.
8. All tests and the visible smoke test pass; the measured frame rate at Earth close-up is reported (target 30 fps or better).

## Out of scope for 2a

Moons and dwarf planets (2b); streamed tiles or terrain elevation; the Sun's corona; cloud shadows on the ground; atmospheric refraction; eclipses; cloud drift; Venus surface radar view; ring particle detail; the faint moons' and ring-arc physics beyond the band list.

## Project layout additions

```
src/render/lod.ts  textureManager.ts  surfaceMaterial.ts
src/render/atmosphere.ts  atmosphereMath.ts
src/render/rings.ts  ringMath.ts  ringProfile.ts
tests/render/  (matching test files)
scripts/fetch-textures.mjs   (extended file list)
```

## Open items for later phases

- 2b: data source and focus hierarchy for moons and dwarf planets; the Moon's 8K map is already available and unused.
- Streamed tiles and terrain elevation for Earth, Mars and the Moon (would replace the surface renderer behind the interface introduced here).
- Phase 4: the scale knobs (`MAX_CAMERA_DISTANCE_M`, `FAR_M`, near-plane cap, `SPRITE_THRESHOLD_PX`) rise together.
