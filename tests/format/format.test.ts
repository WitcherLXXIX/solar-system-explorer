import { describe, expect, it } from 'vitest';
import {
  formatDate, formatDistance, formatHours, formatLightTime, formatMass, formatPeriodDays,
  formatRadius, formatSpeed, formatTemp, niceLength,
} from '../../src/format/format';

describe('formatDistance', () => {
  it('picks metres, km, AU or light-years', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(12.3)).toBe('12.3 m');
    expect(formatDistance(1500)).toBe('1.50 km');
    expect(formatDistance(6_371_000)).toBe('6,371 km');
    expect(formatDistance(149_597_870_700)).toBe('1.00 AU');
    expect(formatDistance(4.5e12)).toBe('30.1 AU');
    expect(formatDistance(4.0e16)).toBe('4.23 ly');
  });
});

describe('formatLightTime', () => {
  it('picks seconds, minutes, hours, days or years', () => {
    expect(formatLightTime(3.844e8)).toBe('1.28 light-s');
    expect(formatLightTime(149_597_870_700)).toBe('8.32 light-min');
    expect(formatLightTime(4.5e12)).toBe('4.17 light-h');
    expect(formatLightTime(1.0e15)).toBe('38.6 light-days');
    expect(formatLightTime(4.0e16)).toBe('4.23 light-yr');
  });
});

describe('formatDate', () => {
  it('formats UTC to the minute', () => {
    expect(formatDate(Date.UTC(2026, 8, 20, 13, 5))).toBe('2026-09-20 13:05 UTC');
  });
});

describe('facts', () => {
  it('formats orbital periods', () => {
    expect(formatPeriodDays(87.97)).toBe('88.0 days');
    expect(formatPeriodDays(365.256)).toBe('365 days');
    expect(formatPeriodDays(4332.6)).toBe('11.9 years');
  });
  it('formats rotation periods, flagging retrograde', () => {
    expect(formatHours(23.9345)).toBe('23.9 h');
    expect(formatHours(1407.6)).toBe('58.6 days');
    expect(formatHours(-5832.5)).toBe('243 days (retrograde)');
  });
  it('formats mass, radius and temperature', () => {
    expect(formatMass(5.972e24)).toBe('5.97 × 10²⁴ kg');
    expect(formatMass(1.9885e30)).toBe('1.99 × 10³⁰ kg');
    expect(formatRadius(6_371_000)).toBe('6,371 km');
    expect(formatTemp(288.15)).toBe('288 K (15 °C)');
  });
});

describe('formatSpeed', () => {
  it('names the time-lapse rate', () => {
    expect(formatSpeed(1, true)).toBe('1× real time');
    expect(formatSpeed(60, true)).toBe('1 min/s');
    expect(formatSpeed(3600, true)).toBe('1 h/s');
    expect(formatSpeed(86_400, true)).toBe('1 day/s');
    expect(formatSpeed(2_592_000, true)).toBe('1 month/s');
    expect(formatSpeed(-31_557_600, true)).toBe('−1 yr/s');
    expect(formatSpeed(86_400, false)).toBe('paused');
  });
});

describe('niceLength', () => {
  it('rounds down to 1, 2 or 5 x 10^n', () => {
    expect(niceLength(730)).toBe(500);
    expect(niceLength(1.9e6)).toBe(1e6);
    expect(niceLength(2.0e6)).toBe(2e6);
    expect(niceLength(9.9e9)).toBe(5e9);
  });
});
