import { BODIES, type BodyId } from '../catalog/bodies';
import { el } from './dom';

export function createBodyList(root: HTMLElement, onSelect: (id: BodyId) => void): { setActive(id: BodyId): void } {
  const buttons = new Map<BodyId, HTMLButtonElement>();
  for (const body of BODIES) {
    const button = el('button', 'body-btn', body.name);
    button.addEventListener('click', () => onSelect(body.id));
    buttons.set(body.id, button);
    root.append(button);
  }
  return {
    setActive(id) {
      for (const [bodyId, button] of buttons) button.classList.toggle('active', bodyId === id);
    },
  };
}
