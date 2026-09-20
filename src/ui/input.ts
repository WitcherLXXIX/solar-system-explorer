export const ZOOM_SENSITIVITY = 0.003; // natural-log units of altitude per wheel pixel
const ORBIT_SENSITIVITY = 0.005; // radians per dragged pixel

export function wheelToLogDelta(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return pixels * ZOOM_SENSITIVITY;
}

export interface InputHandlers {
  onZoom(deltaLog: number): void;
  onOrbit(dYaw: number, dPitch: number): void;
}

/** Wheel zooms; one-pointer drag orbits; two-pointer pinch zooms. */
export function attachInput(target: HTMLElement, handlers: InputHandlers): void {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;

  target.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      handlers.onZoom(wheelToLogDelta(e.deltaY, e.deltaMode));
    },
    { passive: false },
  );

  target.addEventListener('pointerdown', (e) => {
    // Only the primary mouse button orbits. Touch pointers also report button 0, and a second finger is
    // not "primary", so the gate applies to mouse-type pointers only and pinch keeps working.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone (InvalidPointerId); dragging still works without capture.
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinchDistance = currentPinch();
  });

  target.addEventListener('pointermove', (e) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, next);
    if (pointers.size === 1) {
      // Dragging right moves the camera left (yaw down); dragging down moves it up (pitch up).
      handlers.onOrbit(-(next.x - previous.x) * ORBIT_SENSITIVITY, (next.y - previous.y) * ORBIT_SENSITIVITY);
    } else if (pointers.size === 2) {
      const distance = currentPinch();
      if (pinchDistance > 0 && distance > 0) handlers.onZoom(-Math.log(distance / pinchDistance));
      pinchDistance = distance;
    }
  });

  const release = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    pinchDistance = 0;
  };
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);

  function currentPinch(): number {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
