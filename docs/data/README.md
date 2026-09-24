# Bundled star data

Source: HYG Database v4.4 (Hipparcos, Yale Bright Star and Gliese catalogs combined), astronexus/HYG, https://codeberg.org/astronexus/hyg, CC BY-SA 4.0. Fetched and processed 2026-09-24 (`data/hyg/CURRENT/hyg_v44.csv.gz`, 119,614 stars).

- `notable-stars-hyg.csv`: 48 real named stars with apparent magnitude ≤ 2.0 (the genuinely bright, commonly recognized stars: Sirius, Canopus, Rigel, Betelgeuse, Polaris, and so on). Columns: `proper` (common name), `ra_h` (right ascension, hours, J2000), `dec_deg` (declination, degrees, J2000), `mag` (apparent magnitude), `dist_pc` (distance, parsecs), `spect` (spectral type), `ci` (B-V colour index), `con` (constellation abbreviation).
- `background-starfield-hyg.csv`: 5,022 real stars with apparent magnitude ≤ 6.0 (the traditional naked-eye visibility limit), excluding the 48 notable stars above and the Sun. Columns: `ra_h`, `dec_deg`, `mag`, `ci` (colour index; missing values filled with 0.6, a typical G/K-star value, since a exact colour is not essential for an unlabeled background point).

Both are real astrometric data, not schematic or invented. RA/Dec are equatorial J2000 and convert to the app's ecliptic frame the same way the phase 4 nearby-star data does.
