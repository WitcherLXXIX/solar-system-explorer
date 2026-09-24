import type { BodyId } from '../catalog/bodies';

export interface LabelCandidate<K extends string = BodyId> {
  id: K;
  x: number;
  y: number;
  priority: number;
}

/** Greedy declutter: highest priority first, skip any label closer than `minSepPx` to one already placed. */
export function layoutLabels<K extends string>(items: readonly LabelCandidate<K>[], minSepPx: number): Set<K> {
  const placed: LabelCandidate<K>[] = [];
  for (const item of [...items].sort((a, b) => b.priority - a.priority)) {
    if (placed.every((p) => Math.hypot(p.x - item.x, p.y - item.y) >= minSepPx)) placed.push(item);
  }
  return new Set(placed.map((p) => p.id));
}

/** A body as seen on screen: CSS-pixel centre, whether it is in front of the camera, distance and apparent diameter. */
export interface ScreenBody {
  id: BodyId;
  x: number;
  y: number;
  inFront: boolean;
  distanceM: number;
  screenDiameterPx: number;
}

/**
 * True when a nearer, larger body's disc covers `target`'s centre, so its label would float over that body.
 * The occluder must be larger on screen than the target: a small planet passing in front of the Sun's centre
 * does not hide the Sun's label.
 */
export function isLabelOccluded(target: ScreenBody, all: readonly ScreenBody[]): boolean {
  return all.some(
    (o) =>
      o.id !== target.id && o.inFront && o.distanceM < target.distanceM &&
      o.screenDiameterPx > target.screenDiameterPx &&
      Math.hypot(o.x - target.x, o.y - target.y) < o.screenDiameterPx / 2,
  );
}
