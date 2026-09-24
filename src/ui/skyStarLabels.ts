import { el } from './dom';
import { layoutLabels } from './labelLayout';

/** One notable star's label candidate this frame: index into NOTABLE_STARS, CSS-pixel position, in-front flag, brighter = higher priority. */
export interface SkyLabelItem {
  index: number;
  x: number;
  y: number;
  inFront: boolean;
  priority: number;
}

/** Below this fade opacity the labels are hidden outright. */
export const MIN_SKY_LABEL_OPACITY = 0.02;
const MIN_SEPARATION_PX = 22;
const SCREEN_MARGIN_PX = 50;

/** The indices of the labels to show: none when disabled or not yet faded in; else on-screen, in front, and decluttered. */
export function visibleSkyLabels(
  items: readonly SkyLabelItem[], opacity: number, enabled: boolean, viewport: { width: number; height: number },
): number[] {
  if (!enabled || opacity < MIN_SKY_LABEL_OPACITY) return [];
  const onScreen = items.filter(
    (i) => i.inFront && i.x > -SCREEN_MARGIN_PX && i.x < viewport.width + SCREEN_MARGIN_PX && i.y > -20 && i.y < viewport.height + 20,
  );
  const placed = layoutLabels(onScreen.map((i) => ({ id: String(i.index), x: i.x, y: i.y, priority: i.priority })), MIN_SEPARATION_PX);
  return onScreen.filter((i) => placed.has(String(i.index))).map((i) => i.index);
}

/** The notable-star labels, one DOM node per name, created once. Uses the same `label` class as body labels; textContent only. */
export function createSkyStarLabels(root: HTMLElement, names: readonly string[]): {
  update(items: readonly SkyLabelItem[], opacity: number, enabled: boolean, viewport: { width: number; height: number }): void;
  shown(): string[];
} {
  const nodes = names.map((name) => {
    const node = el('div', 'label', name);
    node.style.display = 'none';
    root.append(node);
    return node;
  });
  let lastShown: string[] = [];
  return {
    update(items, opacity, enabled, viewport) {
      const visible = new Set(visibleSkyLabels(items, opacity, enabled, viewport));
      lastShown = [];
      for (const item of items) {
        const node = nodes[item.index]!;
        if (visible.has(item.index)) {
          node.style.display = '';
          node.style.opacity = String(opacity);
          node.style.transform = `translate(${item.x + 8}px, ${item.y - 9}px)`;
          lastShown.push(names[item.index]!);
        } else {
          node.style.display = 'none';
        }
      }
    },
    shown: () => lastShown,
  };
}
