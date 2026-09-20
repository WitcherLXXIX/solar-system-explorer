import type { BodyId } from '../catalog/bodies';

export interface LabelCandidate {
  id: BodyId;
  x: number;
  y: number;
  priority: number;
}

/** Greedy declutter: highest priority first, skip any label closer than `minSepPx` to one already placed. */
export function layoutLabels(items: readonly LabelCandidate[], minSepPx: number): Set<BodyId> {
  const placed: LabelCandidate[] = [];
  for (const item of [...items].sort((a, b) => b.priority - a.priority)) {
    if (placed.every((p) => Math.hypot(p.x - item.x, p.y - item.y) >= minSepPx)) placed.push(item);
  }
  return new Set(placed.map((p) => p.id));
}
