import { SPEED_STEPS, MAX_TIME_MS, MIN_TIME_MS, type SimClock } from '../clock/clock';
import { formatSpeed } from '../format/format';
import { el } from './dom';

export function createTimeBar(root: HTMLElement, clock: SimClock): { update(): void } {
  let step = 0;
  const direction = () => (clock.rate < 0 ? -1 : 1);

  const reverse = el('button', 'btn', 'Reverse');
  const playPause = el('button', 'btn', 'Pause');
  const slower = el('button', 'btn', 'Slower');
  const faster = el('button', 'btn', 'Faster');
  const now = el('button', 'btn', 'Now');
  const speed = el('span', 'speed');
  const date = el('input', 'date');
  date.type = 'datetime-local';
  date.min = new Date(MIN_TIME_MS).toISOString().slice(0, 16);
  date.max = new Date(MAX_TIME_MS).toISOString().slice(0, 16);
  date.setAttribute('aria-label', 'Simulation date and time (UTC)');
  const zone = el('span', 'zone', 'UTC');

  const setStep = (next: number): void => {
    step = Math.min(SPEED_STEPS.length - 1, Math.max(0, next));
    clock.setRate(direction() * SPEED_STEPS[step]!);
  };

  reverse.addEventListener('click', () => clock.reverse());
  playPause.addEventListener('click', () => clock.toggle());
  slower.addEventListener('click', () => setStep(step - 1));
  faster.addEventListener('click', () => setStep(step + 1));
  now.addEventListener('click', () => {
    clock.resetToNow(Date.now());
    step = 0;
  });
  date.addEventListener('change', () => {
    const ms = Date.parse(`${date.value}:00Z`);
    if (!Number.isNaN(ms)) clock.setTimeMs(ms);
  });

  root.append(reverse, playPause, slower, speed, faster, now, date, zone);

  return {
    update() {
      playPause.textContent = clock.playing ? 'Pause' : 'Play';
      speed.textContent = formatSpeed(clock.rate, clock.playing);
      if (document.activeElement !== date) date.value = new Date(clock.timeMs).toISOString().slice(0, 16);
    },
  };
}
