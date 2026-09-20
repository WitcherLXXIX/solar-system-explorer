import { BODIES, type BodyId } from '../catalog/bodies';
import { el } from './dom';
import { layoutLabels } from './labelLayout';

export interface LabelItem {
  id: BodyId;
  name: string;
  x: number;
  y: number;
  visible: boolean;
  priority: number;
}

const MIN_SEPARATION_PX = 22;

export function createLabels(root: HTMLElement): { update(items: LabelItem[], enabled: boolean): void } {
  const nodes = new Map<BodyId, HTMLElement>();
  for (const body of BODIES) {
    const node = el('div', 'label', body.name);
    node.style.display = 'none';
    nodes.set(body.id, node);
    root.append(node);
  }
  return {
    update(items, enabled) {
      const shown = enabled ? layoutLabels(items.filter((i) => i.visible), MIN_SEPARATION_PX) : new Set<BodyId>();
      for (const item of items) {
        const node = nodes.get(item.id)!;
        if (shown.has(item.id)) {
          node.style.display = '';
          node.style.transform = `translate(${item.x + 10}px, ${item.y - 9}px)`;
        } else {
          node.style.display = 'none';
        }
      }
    },
  };
}
