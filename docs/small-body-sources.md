# Small-body sources

Mirrors the pattern of `docs/texture-sources.md`: every stored fact is listed with where it was read. Elements are osculating and
propagated two-body from the SBDB epoch (no planetary perturbations, no precession). All values read 2026-09-23 from the
JPL Small-Body Database API (`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<string>&phys-par=1&full-prec=1`), each fetched twice and
compared digit for digit. Radius is half the SBDB `diameter`. Second sources check the radius only: Horizons and NASA periods
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
may not be guessed. The `tno` body kind and its tests remain in the code for a later addition.
