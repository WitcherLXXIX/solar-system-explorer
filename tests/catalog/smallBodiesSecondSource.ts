import type { BodyId } from '../../src/catalog/bodies';

/**
 * Independent radius (m) for the named small bodies, each with the page it was read from. Radius only: Horizons and NASA
 * periods differ from the SBDB period by more than 0.1% (about 0.2% for Pallas), so they are not used as a period check.
 */
export const SECOND_SOURCE: Partial<Record<BodyId, { radiusM?: number; orbitPeriodDays?: number; source: string }>> = {
  vesta: { radiusM: 261.385e3, source: 'JPL Horizons OBJ_DATA for 4 Vesta (ssd.jpl.nasa.gov/api/horizons.api), RAD, read 2026-09-23' },
  pallas: { radiusM: 256.5e3, source: 'JPL Horizons OBJ_DATA for 2 Pallas (ssd.jpl.nasa.gov/api/horizons.api), RAD, read 2026-09-23' },
  hygiea: { radiusM: 203.56e3, source: 'JPL Horizons OBJ_DATA for 10 Hygiea (ssd.jpl.nasa.gov/api/horizons.api), RAD, read 2026-09-23' },
  juno: { radiusM: 123.298e3, source: 'JPL Horizons OBJ_DATA for 3 Juno (ssd.jpl.nasa.gov/api/horizons.api), RAD, read 2026-09-23' },
};
/** Bodies for which no second source exists on an allowed domain (at most three, each with the reason). */
export const NO_SECOND_SOURCE: Partial<Record<BodyId, string>> = {};
