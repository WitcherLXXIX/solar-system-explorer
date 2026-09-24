# Small-body sources

Mirrors the pattern of `docs/texture-sources.md`: every stored fact is listed with where it was read. Elements are osculating and
propagated two-body from the SBDB epoch (no planetary perturbations, no precession). All values read 2026-09-23 from the
JPL Small-Body Database API (`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<string>&phys-par=1&full-prec=1`), each fetched twice and
compared digit for digit. Radius is half the SBDB `diameter`. Caveat: for Vesta, Pallas, Hygiea and Juno the second source (Horizons OBJ_DATA `RAD`) is derived from the same SBDB diameter (the values match digit for digit), so it is NOT an independent check and cannot catch a wrong SBDB diameter; only the comets' `science.nasa.gov` sizes are independent. Second sources check the radius only: Horizons and NASA periods
differ from the SBDB period by more than 0.1% (about 0.2% for Pallas), so they are not used as a period check. Mass is
`GM * 1e9 / G` where SBDB publishes a GM; otherwise mass and surface gravity are null.

| id | SBDB sstr | Epoch (JD TDB) | a (au) / e / i (deg) | Radius (source) | Second source (radius) | Unpublished |
|---|---|---|---|---|---|---|
| vesta | 4 | 2461200.5 | 2.361366 / 0.090204 / 7.1439 | 261.385 km (SBDB diameter 522.77 km, Park 2025) | Horizons OBJ_DATA RAD 261.385 km | none |
| pallas | 2 | 2461200.5 | 2.769559 / 0.230700 / 34.9328 | 256.5 km (SBDB diameter 513 km, Marsset 2020) | Horizons OBJ_DATA RAD 256.5 km | none |
| hygiea | 10 | 2461200.5 | 3.150974 / 0.106709 / 3.8295 | 203.56 km (SBDB diameter 407.12 km, IRAS) | Horizons OBJ_DATA RAD 203.56 km | none |
| juno | 3 | 2461200.5 | 2.670990 / 0.255700 / 12.9866 | 123.298 km (SBDB diameter 246.596 km, NEOWISE) | Horizons OBJ_DATA RAD 123.298 km | GM not published: mass and gravity null |
| halley | 1P | 2439875.5 | 17.928635 / 0.967936 / 162.1905 | 5.5 km (SBDB diameter 11.0 km, Lamy 2004; triaxial extent 14.9 x 8.2 not used) | science.nasa.gov 1p-halley: 11 km diameter | GM and spin null |
| halebopp | C/1995 O1 | 2459837.5 | 177.433384 / 0.994981 / 89.2876 | 30 km (SBDB diameter 60 km, Fernandez 2002) | science.nasa.gov c-1995-o1-hale-bopp: about 60 km diameter | GM and spin null |
| c67p | 67P | 2457305.5 | 3.462249 / 0.640908 / 7.0403 | 1.7 km (SBDB diameter 3.4 km) | none: NASA 67P page has no size, nssdc page unavailable | none (GM 662.2e-9 km^3/s^2, rot_per 12.76129 h) |
| swifttuttle | 109P | 2450000.5 | 26.092069 / 0.963226 / 113.4538 | 13 km (SBDB diameter 26 km, Lamy 2004) | science.nasa.gov 109p-swift-tuttle: 26 km across | GM and spin null |

Axial tilt and mean temperature are not published by SBDB and are null. Colours are plain fallbacks chosen for appearance, not
measurements.

Comet caveats: elements are osculating at the SBDB epoch (Halley's is 1968, Hale-Bopp's 2022), propagated two-body, so far from
that epoch the position drifts from reality. SBDB non-gravitational parameters (A1, A2, A3) are ignored. All four orbits are elliptical
(SBDB lists `a`). Comet nuclei radii are half the published nucleus diameter (spherical approximation).

## Dropped: four trans-Neptunian objects

Quaoar (50000), Orcus (90482), Sedna (90377) and Gonggong (225088) were planned but are NOT in the catalog. Their orbital elements
were fetched and verified twice, but no diameter or radius is published on SBDB, on Horizons, or on `science.nasa.gov`, and a radius
may not be guessed. The `tno` body kind remains in the code (unused) for a later addition.

## Schematic belts

The two belts are hand-shaped statistical fields, not catalogues: none of the numbers below is fitted to a real population, and the
points are not individual real objects. Every constant lives in `src/ephemeris/beltField.ts`.

- Main belt (`MAIN_BELT_SPEC`): 4000 points, semi-major axis between 2.1 and 3.3 AU, seed 20260923, eccentricity Rayleigh with scale 0.09
  capped at 0.3, perihelion at least 1.5 AU, inclination Rayleigh with scale 8 degrees capped at 30. Density (`mainBeltDensity`): 0.4 plus
  0.6 times a Gaussian centred at 2.75 AU with sigma 0.4, multiplied at each Kirkwood gap (3:1, 5:2, 7:3, 2:1 with Jupiter, computed from
  Kepler's third law) by 1 minus 0.9 times a Gaussian of sigma 0.02 AU.
- Kuiper belt (`KUIPER_BELT_SPEC`): 3000 points, semi-major axis between 30 and 50 AU, seed 19300218, eccentricity scale 0.07 capped at
  0.25, perihelion at least 30 AU, inclination scale 10 degrees capped at 35. Density (`kuiperBeltDensity`): 0.25 floor, plus 0.6 times a
  smoothstep classical belt (rising 38 to 41 AU, falling 47 to 50 AU), plus 0.5 times a Gaussian of sigma 0.6 AU at the plutino (3:2
  Neptune) resonance, capped at 1.
- Angles (node, periapsis, mean anomaly) are uniform.

## Accuracy

Measured 2026-09-24 against JPL Horizons heliocentric ecliptic J2000 vectors at the committed reference epochs
(`tests/ephemeris/smallBodies.test.ts`; two-body from the SBDB epoch, so error grows away from it). Worst angle in degrees and worst
relative distance error, with where it occurred:

| id | worst angle (deg) | worst distance ratio |
|---|---|---|
| vesta | 1.4395 (JD 2442413.5) | 3.711e-3 |
| pallas | 3.5682 (JD 2442413.5) | 1.793e-3 |
| hygiea | 3.1199 (JD 2457023.5) | 1.544e-2 |
| juno | 4.5719 (JD 2442413.5) | 9.165e-3 |
| halley | 0.2883 (JD 2451545.0) | 2.114e-2 |
| halebopp | 0.6554 (JD 2442413.5) | 8.617e-3 |
| c67p | 2.2237 (JD 2451545.0) | 6.922e-3 |
| swifttuttle | 0.2153 (JD 2442413.5) | 2.891e-3 |

Pairs worse than 5 degrees or 3% were dropped from the reference set as outside two-body validity, so the table above is the worst
case over the KEPT pairs only, not over all dates. Dropped pairs (task-7 report): pallas JD 2451545.0 (2000); hygiea 2442413.5, 2451545.0 and
2455197.5 (1975, 2000, 2010); c67p 2442413.5, 2461304.5, 2469807.5 and 2459215.5 (1975, 2026, 2050, 2021). The measured size of the
failures was not recorded except for 67P today (JD 2461304.5, 2026-09-21, the app's default date): 1.35 degrees and 6.1% in distance
(4.83 AU modelled, 4.56 AU Horizons), above the 3% ceiling (one fetch; `tests/ephemeris/c67pToday.test.ts`). The stored 67P elements
are SBDB's current ones (epoch 2457305.5, 2015). Comets ignore non-gravitational forces.
