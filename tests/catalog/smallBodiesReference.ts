/**
 * SBDB fields (read 2026-09-23) that the stored elements are NOT built from: perihelion distance q, time of perihelion tp and
 * the period. The tests compare them with the stored a, e, n and epoch, so a garbled digit in any of them fails.
 */
export const REFERENCE_ELEMENTS: Record<string, { epochJd: number; qAu: number; tpJd: number; periodDays: number; source: string }> = {
  vesta: { epochJd: 2461200.5, qAu: 2.148361914524259, tpJd: 2460901.587379842988, periodDays: 1325.389042911101, source: 'SBDB sstr=4' },
  pallas: { epochJd: 2461200.5, qAu: 2.130621471209779, tpJd: 2461695.03116438268, periodDays: 1683.504809564834, source: 'SBDB sstr=2' },
  hygiea: { epochJd: 2461200.5, qAu: 2.814735882015559, tpJd: 2461813.20082868179, periodDays: 2042.987283349627, source: 'SBDB sstr=10' },
  juno: { epochJd: 2461200.5, qAu: 1.98801754864507, tpJd: 2461631.297203163838, periodDays: 1594.434579527149, source: 'SBDB sstr=3' },
  halley: { epochJd: 2439875.5, qAu: 0.5748638313743413, tpJd: 2446469.973616146677, periodDays: 27728.04608790421, source: 'SBDB sstr=1P' },
  halebopp: { epochJd: 2459837.5, qAu: 0.890537663547794, tpJd: 2450537.134907143944, periodDays: 863279.5034870314, source: 'SBDB sstr=C/1995 O1' },
  c67p: { epochJd: 2457305.5, qAu: 1.243265640702404, tpJd: 2457247.588657812098, periodDays: 2353.076067903661, source: 'SBDB sstr=67P' },
  swifttuttle: { epochJd: 2450000.5, qAu: 0.959516155068868, tpJd: 2448968.499784556297, periodDays: 48681.19346262312, source: 'SBDB sstr=109P' },
};
