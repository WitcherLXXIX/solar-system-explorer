import { AU_M, C_M_S, LIGHT_YEAR_M, YEAR_S } from '../units';

/** Three significant figures below 100, whole numbers with thousands separators from 100 up. */
function num(n: number): string {
  return n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toPrecision(3);
}

export function formatDistance(m: number): string {
  if (m < 1_000) return `${num(m)} m`;
  if (m < 1e10) return `${num(m / 1_000)} km`;
  if (m < 1.5e14) return `${num(m / AU_M)} AU`;
  return `${num(m / LIGHT_YEAR_M)} ly`;
}

export function formatLightTime(m: number): string {
  const s = m / C_M_S;
  if (s < 60) return `${num(s)} light-s`;
  if (s < 3_600) return `${num(s / 60)} light-min`;
  if (s < 86_400) return `${num(s / 3_600)} light-h`;
  if (s < YEAR_S) return `${num(s / 86_400)} light-days`;
  return `${num(s / YEAR_S)} light-yr`;
}

export function formatDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function formatPeriodDays(days: number): string {
  return days < 1000 ? `${num(days)} days` : `${num(days / 365.25)} years`;
}

export function formatHours(hours: number): string {
  const a = Math.abs(hours);
  const text = a < 48 ? `${num(a)} h` : `${num(a / 24)} days`;
  return hours < 0 ? `${text} (retrograde)` : text;
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

export function formatMass(kg: number): string {
  const [mantissa, exponent] = kg.toExponential(2).split('e') as [string, string];
  const power = [...String(Number(exponent))].map((c) => SUPERSCRIPT[c] ?? c).join('');
  return `${mantissa} × 10${power} kg`;
}

export function formatRadius(m: number): string {
  return `${num(m / 1000)} km`;
}

export function formatTemp(kelvin: number): string {
  return `${Math.round(kelvin)} K (${Math.round(kelvin - 273.15)} °C)`;
}

const SPEED_UNITS: ReadonlyArray<readonly [number, string]> = [
  [31_557_600, 'yr'], [2_592_000, 'month'], [86_400, 'day'], [3_600, 'h'], [60, 'min'],
];

export function formatSpeed(rate: number, playing: boolean): string {
  if (!playing) return 'paused';
  const a = Math.abs(rate);
  const sign = rate < 0 ? '−' : '';
  if (a < 60) return `${sign}${a}× real time`;
  const [seconds, unit] = SPEED_UNITS.find(([s]) => a >= s) ?? [60, 'min'];
  const v = a / seconds;
  return `${sign}${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}/s`;
}

/** Rounds `m` down to 1, 2 or 5 x 10^n, for scale bars. */
export function niceLength(m: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const f = m / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}
