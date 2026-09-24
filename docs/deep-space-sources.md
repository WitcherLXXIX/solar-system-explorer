# Deep space: sources and tuning constants

## 1. The twelve stars

Source: Wikipedia, "List of nearest stars" (https://en.wikipedia.org/wiki/List_of_nearest_stars), itself citing Gaia DR3 and Hipparcos; fetched 2026-09-23. Transcribed from `docs/superpowers/specs/2026-09-23-deep-space-design.md`; a test compares `src/catalog/stars.ts` against that table.

| Name | RA | Dec | Distance (ly) | Spectral type |
|---|---|---|---|---|
| Proxima Centauri | 14h 29m 43.0s | -62° 40′ 46″ | 4.2465 | M5.5Ve |
| Alpha Centauri A | 14h 39m 36.5s | -60° 50′ 02″ | 4.3441 | G2V |
| Alpha Centauri B | 14h 39m 35.1s | -60° 50′ 14″ | 4.3441 | K1V |
| Barnard's Star | 17h 57m 48.5s | +04° 41′ 36″ | 5.9629 | M4.0Ve |
| Wolf 359 | 10h 56m 29.2s | +07° 00′ 53″ | 7.856 | M6.0V |
| Lalande 21185 | 11h 03m 20.2s | +35° 58′ 12″ | 8.3044 | M2.0V |
| Sirius A | 06h 45m 08.9s | -16° 42′ 58″ | 8.7094 | A1V |
| Sirius B | 06h 45m 08.9s | -16° 42′ 58″ | 8.7094 | DA2 |
| Ross 154 | 18h 49m 49.4s | -23° 50′ 10″ | 9.7063 | M3.5Ve |
| Epsilon Eridani | 03h 32m 55.8s | -09° 27′ 30″ | 10.4749 | K2V |
| Ross 128 | 11h 47m 44.4s | +00° 48′ 16″ | 11.0074 | M4.0Vn |
| 61 Cygni A | 21h 06m 53.9s | +38° 44′ 58″ | 11.4039 | K5.0V |

## 2. Schematic tuning constants

Every value below is "schematic (appearance choice)", not measured.

| Constant | File | Value |
|---|---|---|
| `STAR_CLASS_STYLE` radius (solar radii) and colour | `src/catalog/stars.ts` | A 1.7 `#cad8ff`; G 1.1 `#fff1d6`; K 0.8 `#ffcf9e`; M 0.25 `#ff9d6b`; D 0.01 `#dfe8ff` |
| `STAR_SPRITE_STYLE` (dot px, opacity) | `src/render/starPoints.ts` | A 8, 1; G 7, 1; K 6.5, 0.92; M 5, 0.72; D 5.5, 0.8 |
| `schematicOffsetNorthArcsec` (Sirius B only) | `src/catalog/stars.ts` | 7.5 arcsec (about 20 AU) |
| `STAR_LABEL_MIN_ALTITUDE_M` | `src/render/orbitFade.ts` | 1e12 |
| `TERMINATION_SHOCK_AU`, `HELIOPAUSE_AU` | `src/render/heliosphereMath.ts` | 94, 120 |
| `SHELL_SIGMA_AU` | `src/render/heliosphereMath.ts` | 4 |
| `HELIO_TAU_PER_AU` | `src/render/heliosphereMath.ts` | 0.01 (looks strong; may want lowering) |
| `HELIO_COLOR_TS`, `HELIO_COLOR_HP` | `src/render/heliosphereMath.ts` | `#6aa8ff`, `#7fe8d0` |
| `HELIO_FADE_LOW_M`, `HELIO_FADE_HIGH_M`, `HELIO_MAX_OPACITY` | `src/render/heliosphereMath.ts` | 1.5e13, 1e14, 0.9 |
| `OORT_FADE_LOW_M`, `OORT_FADE_HIGH_M`, `OORT_MAX_OPACITY` | `src/ephemeris/oortField.ts` | 1e14, 1e15, 0.7 |
| `OORT_CLOUD_SPEC` | `src/ephemeris/oortField.ts` | count 15,000; seed 16,500,000; a 2,000 to 50,000 AU, density 1/a (log-uniform); eccentricity Rayleigh sigma 0.5, max 0.95; periapsis at least 200 AU; isotropic planes (inclination up to 180 degrees) |

## 3. Gaps

- No per-star radius was available from the allowed sources, so radii are per spectral class.
- The termination shock and heliopause distances (about 94 and 120 AU) are the spec's figures and were not re-fetched.
