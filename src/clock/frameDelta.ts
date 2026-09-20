export const MAX_FRAME_DT_S = 0.1;

/**
 * Seconds since the previous animation frame, always in [0, MAX_FRAME_DT_S] and never NaN.
 * `last` is null on the first frame (dt = 0). Backwards or non-finite timestamps also give 0.
 */
export function frameDelta(nowMs: number, lastMs: number | null): number {
  if (lastMs === null) return 0;
  const dt = (nowMs - lastMs) / 1000;
  if (!Number.isFinite(dt)) return 0;
  return Math.max(0, Math.min(dt, MAX_FRAME_DT_S));
}
