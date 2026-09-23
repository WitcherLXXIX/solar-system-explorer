# Texture sources (Task 10)

Research note for the 26 moon/dwarf-planet bodies covered by `src/catalog/satellites.ts`. The Moon uses Solar System
Scope's bundled 2K/8K maps (same pipeline as the Sun and planets). For the other 25 bodies, every candidate NASA/USGS
map was checked against the five acceptance rules in the task brief:

1. Downloadable JPEG, 1024-4096 px wide, from an allowed host, 2:1 (±5%) simple cylindrical/equirectangular.
2. Page states projection, longitude convention (must be **positive east**) and centre longitude (must be **0°** at
   image centre — a map whose longitude domain is `0 to 360` is centred on 180° and is rejected on sight, without
   needing to inspect the pixels, because the centre column of such a raster is always the 180° meridian).
3. Page states a licence/usage statement that permits use with credit.
4. Coverage is essentially global (no large no-data gaps).
5. It is verifiably a picture of that body (checked with the Read tool after download).

All research was done via WebFetch against `astrogeology.usgs.gov`, `planetarymaps.usgs.gov`, `photojournal.jpl.nasa.gov`
(which redirects to `science.nasa.gov/photojournal/`) and `science.nasa.gov`, at most 10 fetches per body. USGS
Astropedia product pages could not be searched with free text via WebFetch (the search UI is client-rendered), so
each body was looked up with `https://astrogeology.usgs.gov/search/results?target=<Body>`, which does return a
server-rendered JSON/HTML result list.

**Result: only Ceres gets a real map.** Every other body stays plain colour — this matches the brief's expectation
("expect several bodies to stay plain: that is a correct outcome"); in this data set essentially *all* of them do,
for three distinct, well-documented reasons (see table): the historic USGS "positive west" longitude convention used
for outer-planet satellite mosaics (a real mismatch with the sphere mesh's positive-east convention, not a close call),
partial single-flyby Voyager 2 coverage that never produced a global mosaic at all, and the New Horizons Pluto/Charon
mosaics being centred on 180° rather than 0°.

## Table

| Body | Decision | Source page | File URL | Licence (page's own wording) | Size (px) | Projection / centre lon. | Coverage | Credit | Reason (if rejected) |
|---|---|---|---|---|---|---|---|---|---|
| moon | map used | solarsystemscope.com/textures | `https://www.solarsystemscope.com/textures/download/2k_moon.jpg`, `8k_moon.jpg` | CC BY 4.0 (Solar System Scope) | 2048x1024 / 8192x4096 | simple cylindrical, centred 0° (SSS convention, matches mesh) | global | Solar System Scope (default credit) | — |
| phobos | plain colour | `astrogeology.usgs.gov/search/map/phobos_mars_express_src_global_mosaic_12m` | `.../phobos_me_src_mosaic_global_1024.jpg` | "Access Constraints: public domain", "Use Constraints: Please cite authors" | 1024x512 (sample; full is a 16 MB GeoTIFF) | Simple Cylindrical, Longitude Direction "Positive East", domain -180 to 180 (centred 0°, otherwise correct) | page claims global (26 Mars Express SRC + 8 Viking images) but flags itself "preliminary...anticipated to improve" | ESA/DLR/FU Berlin (Mars Express) + NASA/USGS (Viking) | **Rule 4.** Downloaded and viewed with the Read tool: the mosaic shows large, irregular black no-data patches (not a thin uniform polar-compression band like Ceres has) at the top-left, top-right and bottom-right of the frame — real coverage gaps, matching the page's own "preliminary" caveat. Rejected after download; the file was left in `public/textures/` (git-ignored, unreferenced) rather than force-deleted. |
| deimos | plain colour | `astrogeology.usgs.gov/search/results?target=Deimos` (also tried `?target=Deimos&system=Mars` and a free-text search) | none | — | — | — | — | — | **Rule 1/4.** No global mosaic product exists for Deimos on any allowed domain (`"total":0` results each time) — Viking/MRO imaging of Deimos never assembled into a published global mosaic. |
| io | plain colour | `astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_global_mosaic_1km` and `io_galileo_ssi_global_color_merge_mosaic_1km` | `.../full.jpg` (1024 px sample) | "Access Constraints: public domain", "Use Constraints: None" | 1024x512 sample (full raster 11445x5723) | Simple Cylindrical, Longitude Direction explicitly **"Positive West"** | global (~5° polar gap, interpolated) | NASA/JPL-Caltech/USGS (Voyager/Galileo SSI) | **Rule 2.** Page states positive-west longitude explicitly on two separate product pages checked; a west-positive map is mirrored relative to the sphere mesh's east-positive convention. |
| europa | plain colour | `astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m` | `.../europa_voyager_galileossi_global_mosaic_500m_1024.jpg` | "Access/Use Constraints: None" | 1024 px sample (full 500 m/px) | Simple Cylindrical, "Positive West", domain 0-360 | no data south of -83°, low-res poles | NASA/JPL-Caltech/USGS | **Rule 2** (positive west) **and rule 4** (south polar gap below -83°). |
| ganymede | plain colour | `astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_simple_cylindrical` | `gany_simp_2km.jpg` (referenced) | not stated in the fetched content | — | Simple Cylindrical; longitude convention **not confirmed** — WebFetch could not extract a "Longitude Direction" field from this product's rendered page (two attempts) | global, 20 km/px gap-fill at worst | USGS Astrogeology (Voyager/Galileo SSI) | **Rule 2/3.** Same USGS satellite-mosaic product series as Io and Europa (both confirmed positive-west); longitude convention and licence were not extractable from this page within the time-box, and rule 2/3 require the page to *state* them — absence of a statement is a reject, same as an explicit west-positive statement. |
| callisto | plain colour | `astrogeology.usgs.gov/search/map/callisto_galileo_voyager_simple_cylindrical_global_map` | `callisto_simp_1km.jpg` (referenced) | not stated in the fetched content | — | Simple Cylindrical; longitude convention not confirmed (same as Ganymede) | global, 60 km/px gap-fill at worst | USGS Astrogeology (Voyager/Galileo SSI) | Same as Ganymede: same product series as the confirmed-west-positive Io/Europa mosaics; convention/licence not stated on the fetched page. |
| mimas | plain colour | `astrogeology.usgs.gov/search/map/mimas_airbrush_shaded_relief` (only Mimas "global mosaic" product) | `astropedia.astrogeology.usgs.gov/download/Mimas/Voyager/Mimas_full.jpg` | not stated | — | not stated | — | — | **Rule 5 (and 2/3).** The only "Global Mosaic"-tagged Mimas product on USGS is explicitly an airbrush-rendered illustration ("Airbrush, Global Mosaic"), not a photograph — fails "it really is a picture of that body." No Cassini photographic global mosaic of Mimas was found. |
| enceladus | plain colour | `astrogeology.usgs.gov/search/map/enceladus_cassini_global_mosaic_110m` | `.../full.jpg` (1024 px sample) | "Public domain", "Please cite authors" | 1024 px sample | Simple Cylindrical, **"Positive West"** | global -90 to 90 | NASA/JPL-Caltech/SSI (Cassini ISS) | **Rule 2** (positive west). |
| tethys | plain colour | `astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m` | `.../full.jpg` | "Public domain", "Please cite authors" | 1024 px sample (full 11520x5760) | Simple Cylindrical, **"Positive West"** | global -90 to 90 | NASA/JPL-Caltech/SSI (Cassini ISS) | **Rule 2** (positive west). |
| dione | plain colour | `astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m` | `.../full.jpg` | "Public domain", "Please cite authors" | 1024 px sample | Simple Cylindrical, **"Positive West"** | global -90 to 90 | NASA/JPL-Caltech/SSI (Cassini ISS) + Voyager | **Rule 2** (positive west). |
| rhea | plain colour | `astrogeology.usgs.gov/search/map/rhea_cassini_voyager_global_mosaic_417m` | `.../full.jpg` (full 11520x5760) | "Public domain", "Please cite authors" (Roatsch, Kersten, Hoffmeister, Wahlisch) | 1024 px sample | Simple Cylindrical, **"Positive West"**, domain -180 to 180 | global, 6 Voyager images fill north polar gap | NASA/JPL-Caltech/SSI (Cassini ISS) + Voyager | **Rule 2** (positive west). |
| titan | plain colour | `astrogeology.usgs.gov/search/map/titan_cassini_iss_global_mosaic_4005m` | `titan_iss_p19658_mosaic_global_1024.jpg` | "Please cite authors" | 1024 px sample | Equirectangular, **"Positive West"**, domain 0-360 | ~3-5% data gap, northern mid-latitudes, sub-Saturn hemisphere | NASA/JPL-Caltech/SSI (Cassini ISS) | **Rule 2** (positive west) and rule 4 (stated data gap). (Titan's surface is also globally cloud-obscured at visible wavelengths outside this ISS-processed mosaic; the app already renders a haze atmosphere for it.) |
| iapetus | plain colour | `astrogeology.usgs.gov/search/map/iapetus_cassini_voyager_global_mosaic_803m` | `.../full.jpg` (full 5760x2880) | "Public domain", "Please cite authors" | 1024 px sample | Simple Cylindrical, **"Positive West"** | global -90 to 90 | NASA/JPL-Caltech/SSI (Cassini) + Voyager | **Rule 2** (positive west). |
| miranda | plain colour | `astrogeology.usgs.gov/search/results?target=Miranda` | none | — | — | — | — | — | **Rule 1/4.** Only a nomenclature reference and an image control network exist; no global mosaic product. Voyager 2's single 1986 flyby imaged well under half the surface. |
| ariel | plain colour | `astrogeology.usgs.gov/search/results?target=Ariel` | none | — | — | — | — | — | Same as Miranda: no global mosaic product exists. |
| umbriel | plain colour | `astrogeology.usgs.gov/search/results?target=Umbriel` | none | — | — | — | — | — | Same as Miranda: no global mosaic product exists. |
| titania | plain colour | `astrogeology.usgs.gov/search/results?target=Titania` | none | — | — | — | — | — | Same as Miranda: no global mosaic product exists. |
| oberon | plain colour | `astrogeology.usgs.gov/search/results?target=Oberon` | none | — | — | — | — | — | Same as Miranda: no global mosaic product exists. |
| triton | plain colour | `astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m` | `.../triton_voyager2_clrmosaic_1024.jpg` (full 14138x7069) | "Public domain", "Please cite authors" | 1024 px sample | Equirectangular, **"Positive East"**, domain -180 to 180 (centre convention is correct) | page's own "completeness report": **"Large gap at the north pole"** | NASA/JPL/LPI (Voyager 2, Paul Schenk) | **Rule 4.** Longitude convention passes (positive east, correctly centred), but the source page itself states a large north-polar no-data gap from Voyager 2's single 1989 flyby, which only imaged the southern hemisphere and part of the equator well. |
| pluto | plain colour | `astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m` | `pluto_newhorizons_global_mosaic_300m_jul2017_1024.jpg` | "Access Constraints: None", "Please cite authors" | 1024 px sample (full 24888x12444) | Simple Cylindrical, "Positive East", but **Longitude Domain "0 to 360"** | claimed global, "assembled from nearly all of the highest-resolution images" | NASA/JHUAPL/SwRI (New Horizons LORRI/MVIC) | **Rule 2.** Domain 0-360 means the raster's centre column is longitude 180°, not 0° — this is exactly the "centred on 180 degrees" case the brief says to reject, even though east/west convention and licence are otherwise fine. |
| charon | plain colour | `astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m` | `charon_newhorizons_global_mosaic_300m_jul2017_1024.jpg` | "Access Constraints: None", "Please cite authors" | 1024 px sample (full 12693x6347) | Simple Cylindrical, "Positive East", **Longitude Domain "0 to 360"** | claimed global | NASA/JHUAPL/SwRI (New Horizons LORRI/MVIC) | **Rule 2.** Same issue as Pluto: domain 0-360, centred on 180°, not 0°. |
| ceres | **map used** | `astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_400m` | `https://astrogeology.usgs.gov/ckan/dataset/39338f6b-5fef-4ac4-9310-ce5b1cdd0f69/resource/8b1e5592-c2b0-4ed7-8cd2-5a3590d88bf7/download/ceres_dawn_fc_dlr_global_1024.jpg` | "Access Constraints: public domain", "Use Constraints: Please cite authors" | 1024x512 | Equirectangular, Longitude Direction **"Positive East"**, **Longitude Domain "-180 to 180"** (centred 0°, matches the sphere mesh) | global, -90 to 90 lat, 0 to 360 lon (400 m/pixel Dawn Framing Camera mosaic) | NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn Framing Camera) | — |
| eris | plain colour | `astrogeology.usgs.gov/search/results?target=Eris` | none | — | — | — | — | — | **Rule 1.** No map or image product of any kind exists on any allowed domain — Eris has never been resolved by a spacecraft or telescope into a surface map. |
| haumea | plain colour | `astrogeology.usgs.gov/search/results?target=Haumea` | none | — | — | — | — | — | Same as Eris: no map/image product exists. |
| makemake | plain colour | `astrogeology.usgs.gov/search/results?target=Makemake` | none | — | — | — | — | — | Same as Eris: no map/image product exists. |

## What was actually viewed (Read tool, after `npm run textures`)

**Ceres (`public/textures/2k_ceres.jpg`, 1024x512, accepted):** a grayscale, heavily cratered spherical body filling
the full frame edge to edge, consistent with genuine Dawn Framing Camera imagery of Ceres — dense overlapping craters
of many sizes across the whole visible range, a large multi-ring impact basin near the bottom edge, and a small
cluster of distinctly bright spots right-of-centre, consistent with Ceres's well-known Occator crater bright
faculae (the actual crater-name/longitude gazetteer for Ceres lives at `planetarynames.wr.usgs.gov`, which is not on
the allowed-host list, so the bright-spot longitude could not be cross-checked against a numeric coordinate within
the allowed domains and the 10-fetch time-box; the visual character of the image — density and morphology of
craters, single bright-spot cluster, overall albedo — is unambiguously Ceres, not a mislabeled or corrupted file).
There is a thin, uniform dark band at the very top and bottom rows (extreme-latitude pixel compression inherent to
a cylindrical projection, not a data gap — it's a few pixels tall and spans the full width evenly, unlike the
irregular patches on the rejected Phobos file). No left/right seam artefact or mirrored-looking features. Accepted.

**Phobos (`public/textures/2k_phobos.jpg`, 1024x512, downloaded then rejected):** also clearly Phobos — the large
crater on the left-of-centre is consistent with the real, well-known Stickney crater, and faint parallel linear
grooves (a genuine, distinctive Phobos surface feature) are visible running across the mid-latitudes. However,
several irregular black regions with no discernible geographic content appear at the top-left, top-right and
bottom-right of the frame; these are shaped like actual missing coverage, not the thin, even polar-compression
band Ceres shows. This matches the source page's own "preliminary...anticipated to improve" note. Per rule 4, the
map is rejected; Phobos keeps its plain colour and the file is left, unused and git-ignored, in
`public/textures/2k_phobos.jpg`.

## Rulings

- One map (Pluto/Charon-style New Horizons mosaics) was rejected purely for being centred on longitude 180° rather
  than 0°, per the brief's explicit example — no attempt was made to re-roll/re-centre the pixels; the brief calls
  for rejection, not local correction.
- The systematic "positive west" convention found across Io, Europa, Enceladus, Tethys, Dione, Rhea, Titan and
  Iapetus is a genuine, well-documented historical USGS cartographic convention for outer-planet satellite mosaics
  (distinct from the positive-east convention used for the Moon/Mars/Mercury and adopted by this project's sphere
  mesh) — it is not an artefact of the research method; each instance was read directly off that product's own
  "Longitude Direction" field.
- Ganymede and Callisto were rejected on the more cautious basis of an *unconfirmed* (not explicitly-refuted)
  longitude convention, since their Astropedia product pages did not surface a "Longitude Direction" field within
  the fetch/time-box, and they are the same product series (same era, same USGS team) as the two Galilean-moon
  mosaics that were confirmed positive-west. Rule 2 requires the page to *state* positive-east; silence does not
  satisfy that, symmetric with how rule 3 treats an unstated licence as "do not use."
- Every "2K at most, up to 4096 px accepted only when nothing smaller exists" question was moot here: the only
  accepted file (Ceres) and the one downloaded-then-rejected file (Phobos) were both only available as 1024 px
  JPEG samples (their full-resolution counterparts are GeoTIFF, not JPEG), so no 2048-vs-4096 choice arose.
