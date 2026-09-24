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

Axial tilt and mean temperature are not published by SBDB and are null. Colours are plain fallbacks chosen for appearance, not
measurements.

## Dropped: four trans-Neptunian objects

Quaoar (50000), Orcus (90482), Sedna (90377) and Gonggong (225088) were planned but are NOT in the catalog. Their orbital elements
were fetched and verified twice, but no diameter or radius is published on SBDB, on Horizons, or on `science.nasa.gov`, and a radius
may not be guessed. The `tno` body kind and its tests remain in the code for a later addition.
