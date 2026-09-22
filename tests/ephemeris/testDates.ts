import { MakeTime } from 'astronomy-engine';
import { J2000_JD } from '../../src/units';

/**
 * The Date whose astronomy-engine Terrestrial Time is `jdTdb` (Horizons vector tables are in TDB, which agrees with TT
 * to about 2 ms). Astronomy-engine's own delta-T model is used, so the conversion is self-consistent with the code under test.
 */
export function dateFromTdbJd(jdTdb: number): Date {
  const targetTt = jdTdb - J2000_JD;
  let ms = Date.UTC(2000, 0, 1, 12) + targetTt * 86_400_000;
  for (let i = 0; i < 4; i++) ms -= (MakeTime(new Date(ms)).tt - targetTt) * 86_400_000;
  return new Date(ms);
}
