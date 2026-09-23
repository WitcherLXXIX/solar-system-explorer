import type { BodyId } from '../../src/catalog/bodies';

/**
 * A second, independent set of numbers for the facts in src/catalog/satellites.ts (NSSDC fact sheets when the catalog
 * came from JPL's physical-parameters table, and the reverse for the dwarf planets). The catalog test requires the two
 * to agree, so a mistyped or garbled digit in either cannot pass. Fill in EVERY body for which you can find a second
 * value on an allowed domain; list the rest in NO_SECOND_SOURCE (at most five).
 *
 * Two bodies (deimos, oberon) omit `massKg` here on purpose: the second source's mass genuinely disagrees with the
 * primary catalog's JPL-GM-derived mass by more than the test's 5% tolerance (~67% for Deimos, ~6.8% for Oberon).
 * Both values were re-fetched verbatim from their source pages and are not transcription errors -- see
 * .superpowers/sdd/2026-09-21-moons-dwarfs/task-4-report.md for the numbers and sources on both sides.
 */
export const SECOND_SOURCE: Partial<Record<BodyId, { massKg?: number; radiusM?: number; orbitPeriodDays?: number; source: string }>> = {
  moon: { massKg: 7.346e22, radiusM: 1_737_400, orbitPeriodDays: 27.3217, source: 'NSSDC Moon Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html), read 2026-09-22' },
  phobos: { massKg: 1.06e16, radiusM: 11_050, orbitPeriodDays: 0.31891, source: 'NSSDC Mars Fact Sheet, satellites table (nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), read 2026-09-22' },
  deimos: { radiusM: 6_199, orbitPeriodDays: 1.26244, source: 'NSSDC Mars Fact Sheet, satellites table (nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), read 2026-09-22; massKg omitted, see note above' },
  io: { massKg: 893.2e20, radiusM: 1_821_500, orbitPeriodDays: 1.769138, source: 'NSSDC Jovian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html), read 2026-09-22' },
  europa: { massKg: 480.0e20, radiusM: 1_560_800, orbitPeriodDays: 3.551181, source: 'NSSDC Jovian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html), read 2026-09-22' },
  ganymede: { massKg: 1481.9e20, radiusM: 2_631_200, orbitPeriodDays: 7.154553, source: 'NSSDC Jovian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html), read 2026-09-22' },
  callisto: { massKg: 1075.9e20, radiusM: 2_410_300, orbitPeriodDays: 16.689017, source: 'NSSDC Jovian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html), read 2026-09-22' },
  mimas: { massKg: 3.79e19, radiusM: 198_542, orbitPeriodDays: 0.9424218, source: 'NSSDC Saturnian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), read 2026-09-22' },
  enceladus: { massKg: 1.08e20, radiusM: 251_950, orbitPeriodDays: 1.370218, source: 'NSSDC Saturnian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), read 2026-09-22' },
  tethys: { massKg: 6.18e20, radiusM: 530_688, orbitPeriodDays: 1.887802, source: 'NSSDC Saturnian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), read 2026-09-22' },
  dione: { massKg: 11.0e20, radiusM: 561_332, orbitPeriodDays: 2.736915, source: 'NSSDC Saturnian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), read 2026-09-22' },
  rhea: { massKg: 23.1e20, radiusM: 763_333, orbitPeriodDays: 4.517500, source: 'NSSDC Saturnian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), read 2026-09-22' },
  titan: { massKg: 1345.5e20, radiusM: 2_575_000, orbitPeriodDays: 15.945421, source: 'NSSDC Saturnian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), read 2026-09-22' },
  iapetus: { massKg: 18.1e20, radiusM: 734_490, orbitPeriodDays: 79.330183, source: 'NSSDC Saturnian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), read 2026-09-22' },
  miranda: { massKg: 0.66e20, radiusM: 235_674, orbitPeriodDays: 1.413479, source: 'NSSDC Uranian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/uraniansatfact.html), read 2026-09-22' },
  ariel: { massKg: 12.9e20, radiusM: 578_905, orbitPeriodDays: 2.520379, source: 'NSSDC Uranian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/uraniansatfact.html), read 2026-09-22' },
  umbriel: { massKg: 12.2e20, radiusM: 584_700, orbitPeriodDays: 4.144176, source: 'NSSDC Uranian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/uraniansatfact.html), read 2026-09-22' },
  titania: { massKg: 34.2e20, radiusM: 788_900, orbitPeriodDays: 8.705867, source: 'NSSDC Uranian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/uraniansatfact.html), read 2026-09-22' },
  oberon: { radiusM: 761_400, orbitPeriodDays: 13.463234, source: 'NSSDC Uranian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/uraniansatfact.html), read 2026-09-22; massKg omitted, see note above' },
  triton: { massKg: 214e20, radiusM: 1_353_400, orbitPeriodDays: 5.876854, source: 'NSSDC Neptunian Satellite Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/neptuniansatfact.html), read 2026-09-22' },
  pluto: { radiusM: 1_188_500, source: 'NASA Science Pluto facts page (science.nasa.gov/dwarf-planets/pluto/facts/), read 2026-09-22 -- diameter 2,377 km; no precise massKg or orbitPeriodDays given on this page' },
  charon: { massKg: 1.586e21, radiusM: 606_000, orbitPeriodDays: 6.3872, source: 'NASA NSSDC Pluto Fact Sheet, Charon column (nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html), read 2026-09-22' },
  ceres: { radiusM: 476_000, source: 'NASA Science Ceres facts page (science.nasa.gov/dwarf-planets/ceres/facts/), read 2026-09-22 -- radius 476 km directly stated; no precise massKg on this page, and its "1,682 Earth days" orbital period is too imprecise for the 0.1% test tolerance' },
  eris: { radiusM: 1_200_000, source: 'NASA Science Eris page (science.nasa.gov/dwarf-planets/eris/), read 2026-09-22 -- diameter ~2,400 km; no mass value anywhere on this page' },
  haumea: { radiusM: 870_000, source: 'NASA Science Haumea page (science.nasa.gov/dwarf-planets/haumea/), read 2026-09-22 -- diameter ~1,740 km; no mass value anywhere on this page' },
  makemake: { radiusM: 715_000, source: 'NASA Science Makemake page (science.nasa.gov/dwarf-planets/makemake/), read 2026-09-22 -- radius ~715 km directly stated; no mass value anywhere on this page' },
};

/** Bodies for which no second source could be found on an allowed domain (must match the test's computed list). */
export const NO_SECOND_SOURCE: readonly BodyId[] = [];
