import { clamp } from '../math';

/** Simulated seconds per real second: real time, 1 min, 1 h, 1 day, 30 days, 1 year. */
export const SPEED_STEPS = [1, 60, 3600, 86_400, 2_592_000, 31_557_600] as const;

/** Well inside the date range astronomy-engine supports accurately. */
export const MIN_TIME_MS = Date.UTC(1700, 0, 1);
export const MAX_TIME_MS = Date.UTC(2300, 0, 1);

export class SimClock {
  private ms: number;
  private rateValue = 1;
  private playingValue = true;

  constructor(startMs: number) {
    this.ms = clamp(startMs, MIN_TIME_MS, MAX_TIME_MS);
  }

  get timeMs(): number {
    return this.ms;
  }
  get date(): Date {
    return new Date(this.ms);
  }
  get rate(): number {
    return this.rateValue;
  }
  get playing(): boolean {
    return this.playingValue;
  }

  tick(realDtS: number): void {
    if (!this.playingValue) return;
    const next = this.ms + this.rateValue * realDtS * 1000;
    if (next <= MIN_TIME_MS) {
      this.ms = MIN_TIME_MS;
      this.playingValue = false;
    } else if (next >= MAX_TIME_MS) {
      this.ms = MAX_TIME_MS;
      this.playingValue = false;
    } else {
      this.ms = next;
    }
  }

  play(): void {
    this.playingValue = true;
  }
  pause(): void {
    this.playingValue = false;
  }
  toggle(): void {
    this.playingValue = !this.playingValue;
  }
  setRate(rate: number): void {
    this.rateValue = rate;
  }
  reverse(): void {
    this.rateValue = -this.rateValue;
  }
  setTimeMs(ms: number): void {
    this.ms = clamp(ms, MIN_TIME_MS, MAX_TIME_MS);
  }
  resetToNow(nowMs: number): void {
    this.ms = clamp(nowMs, MIN_TIME_MS, MAX_TIME_MS);
    this.rateValue = 1;
    this.playingValue = true;
  }
}
