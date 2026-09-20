import './style.css';
import { CameraController, sunwardYaw, DEFAULT_PITCH, type FocusSource } from './camera/cameraController';
import { SimClock } from './clock/clock';
import { getBody, type BodyId } from './catalog/bodies';
import { computeFrame, type Frame } from './ephemeris/frame';
import { SolarScene, type FrameInput } from './render/solarScene';
import { isWebGL2Available } from './render/webgl';
import { attachInput } from './ui/input';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;

if (!isWebGL2Available()) {
  const fallback = document.querySelector<HTMLElement>('#fallback')!;
  fallback.hidden = false;
  fallback.textContent = 'This app needs WebGL 2, which your browser or graphics driver does not provide.';
  canvas.hidden = true;
  throw new Error('WebGL 2 unavailable');
}

const clock = new SimClock(Date.now());
let frame: Frame = computeFrame(clock.date);

const source: FocusSource = {
  position: (id) => frame[id].position,
  radius: (id) => getBody(id).radiusM,
};

const camera = new CameraController(source, {
  focusId: 'earth',
  altitudeM: 3 * getBody('earth').radiusM,
  yaw: sunwardYaw(frame.earth.position),
  pitch: DEFAULT_PITCH,
});

const scene = new SolarScene(canvas, clock.date);
const showOrbits = true;

function resize(): void {
  scene.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

attachInput(canvas, {
  onZoom: (deltaLog) => camera.zoom(deltaLog),
  onOrbit: (dYaw, dPitch) => camera.orbit(dYaw, dPitch),
});

let frames = 0;
let lastInput: FrameInput | null = null;
let last = performance.now();

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  clock.tick(dt);
  frame = computeFrame(clock.date);
  const pose = camera.update(dt);
  lastInput = {
    frame, cameraPos: pose.position, focusPoint: pose.focusPoint,
    altitudeM: pose.altitudeM, date: clock.date, showOrbits,
  };
  scene.render(lastInput);
  frames++;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

declare global {
  interface Window {
    __solar?: {
      frames: number;
      litPixels(): number;
      altitudeM(): number;
      isFlying(): boolean;
      focusId(): BodyId;
      flyTo(id: BodyId): void;
    };
  }
}

window.__solar = {
  get frames() {
    return frames;
  },
  litPixels: () => scene.centreLitPixels(),
  altitudeM: () => (lastInput ? lastInput.altitudeM : 0),
  isFlying: () => camera.isFlying,
  focusId: () => camera.displayId,
  flyTo: (id) => camera.flyTo(id),
};
