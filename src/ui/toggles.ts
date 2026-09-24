import { BELT_NOTE } from './bodyText';
import { el } from './dom';

export type ToggleKey = 'orbits' | 'labels' | 'belts';

export interface Toggles {
  readonly orbits: boolean;
  readonly labels: boolean;
  readonly belts: boolean;
  /** Sets a toggle and its checkbox (the smoke test uses this). */
  set(key: ToggleKey, on: boolean): void;
}

export function createToggles(root: HTMLElement): Toggles {
  const state = { orbits: true, labels: true, belts: true };
  const boxes = new Map<ToggleKey, HTMLInputElement>();
  const add = (text: string, key: ToggleKey, title?: string): void => {
    const label = el('label', 'toggle');
    if (title) label.title = title;
    const box = el('input');
    box.type = 'checkbox';
    box.checked = true;
    box.addEventListener('change', () => {
      state[key] = box.checked;
    });
    boxes.set(key, box);
    label.append(box, el('span', '', text));
    root.append(label);
  };
  add('Orbits', 'orbits');
  add('Labels', 'labels');
  add('Belts', 'belts', BELT_NOTE);
  return {
    get orbits() { return state.orbits; },
    get labels() { return state.labels; },
    get belts() { return state.belts; },
    set(key, on) {
      state[key] = on;
      const box = boxes.get(key);
      if (box) box.checked = on;
    },
  };
}
