import { describe, expect, it } from 'vitest';
import { MAX_TIME_MS, MIN_TIME_MS, SPEED_STEPS, SimClock } from '../../src/clock/clock';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);

describe('SimClock', () => {
  it('starts playing at real time', () => {
    const c = new SimClock(T0);
    expect(c.playing).toBe(true);
    expect(c.rate).toBe(1);
    expect(c.timeMs).toBe(T0);
    expect(c.date.getTime()).toBe(T0);
  });
  it('advances by rate x real seconds', () => {
    const c = new SimClock(T0);
    c.setRate(86_400);
    c.tick(0.5);
    expect(c.timeMs).toBe(T0 + 43_200_000);
  });
  it('runs backwards with a negative rate and reverse()', () => {
    const c = new SimClock(T0);
    c.setRate(3600);
    c.reverse();
    expect(c.rate).toBe(-3600);
    c.tick(1);
    expect(c.timeMs).toBe(T0 - 3_600_000);
  });
  it('does not advance while paused', () => {
    const c = new SimClock(T0);
    c.pause();
    c.tick(10);
    expect(c.timeMs).toBe(T0);
    c.toggle();
    expect(c.playing).toBe(true);
  });
  it('clamps to the supported range and pauses at the edge', () => {
    const c = new SimClock(MAX_TIME_MS - 1000);
    c.setRate(SPEED_STEPS[5]);
    c.tick(1);
    expect(c.timeMs).toBe(MAX_TIME_MS);
    expect(c.playing).toBe(false);
    const d = new SimClock(MIN_TIME_MS + 1000);
    d.setRate(-SPEED_STEPS[5]);
    d.tick(1);
    expect(d.timeMs).toBe(MIN_TIME_MS);
    expect(d.playing).toBe(false);
  });
  it('clamps setTimeMs and constructor input', () => {
    const c = new SimClock(0);
    c.setTimeMs(Number.MAX_SAFE_INTEGER);
    expect(c.timeMs).toBe(MAX_TIME_MS);
    expect(new SimClock(Date.UTC(1500, 0, 1)).timeMs).toBe(MIN_TIME_MS);
  });
  it('resets to now at real time and resumes', () => {
    const c = new SimClock(T0);
    c.setRate(86_400);
    c.pause();
    c.resetToNow(T0 + 5000);
    expect(c.timeMs).toBe(T0 + 5000);
    expect(c.rate).toBe(1);
    expect(c.playing).toBe(true);
  });
});
