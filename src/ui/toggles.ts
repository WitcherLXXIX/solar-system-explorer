import { el } from './dom';

export function createToggles(root: HTMLElement): { readonly orbits: boolean; readonly labels: boolean } {
  const state = { orbits: true, labels: true };
  const add = (text: string, key: 'orbits' | 'labels'): void => {
    const label = el('label', 'toggle');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = true;
    box.addEventListener('change', () => {
      state[key] = box.checked;
    });
    label.append(box, el('span', '', text));
    root.append(label);
  };
  add('Orbits', 'orbits');
  add('Labels', 'labels');
  return state;
}
