import './style.css';
import { CameraController, sunwardYaw, DEFAULT_PITCH, type FocusSource } from './camera/cameraController';
import { SimClock } from './clock/clock';
import { frameDelta } from './clock/frameDelta';
import { BODY_IDS, getBody, type BodyId } from './catalog/bodies';
import { computeFrame, type Frame } from './ephemeris/frame';
import { SolarScene, type FrameInput } from './render/solarScene';
import { isWebGL2Available } from './render/webgl';
import { length } from './math';
import { createBodyList } from './ui/bodyList';
import { createInfoPanel } from './ui/infoPanel';
import { attachInput } from './ui/input';
import { createLabels } from './ui/labels';
import { createScaleReadout } from './ui/scaleReadout';
import { createTimeBar } from './ui/timeBar';
import { createToggles } from './ui/toggles';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;

if (!isWebGL2Available()) {
  const fallback = document.querySelector<HTMLElement>('#fallback')!;
  fallback.hidden = false;
  fallback.textContent = 'This app needs WebGL 2, which your browser or graphics driver does not provide.';
  canvas.style.display = 'none';
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
const element = (id: string): HTMLElement => document.querySelector<HTMLElement>(`#${id}`)!;
const toggles = createToggles(element('toggles'));
const timeBar = createTimeBar(element('timebar'), clock);
const readout = createScaleReadout(element('scale'));
const infoPanel = createInfoPanel(element('info'));
const labels = createLabels(element('labels'));
const bodyList = createBodyList(element('bodies'), (id) => camera.flyTo(id));
let shownBody: BodyId | null = null;

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
let last: number | null = null;

function loop(now: number): void {
  const dt = frameDelta(now, last);
  last = now;
  clock.tick(dt);
  frame = computeFrame(clock.date);
  const pose = camera.update(dt);
  lastInput = {
    frame, cameraPos: pose.position, focusPoint: pose.focusPoint,
    altitudeM: pose.altitudeM, date: clock.date, showOrbits: toggles.orbits,
  };
  const info = scene.render(lastInput);

  const displayed = camera.displayId;
  if (displayed !== shownBody) {
    shownBody = displayed;
    infoPanel.setBody(displayed);
    bodyList.setActive(displayed);
  }
  const sunDistanceM = length(frame[displayed].position);
  infoPanel.update(sunDistanceM);
  readout.update({ pose, fovYRad: scene.fovYRad, viewportHeightPx: scene.viewportHeight, sunDistanceM });
  timeBar.update();
  const projected = BODY_IDS.map((id) => {
    const r = info.get(id)!;
    return { id, r, screen: scene.projectToScreen(r.rel) };
  });
  labels.update(
    projected.map(({ id, r, screen }) => {
      // A label is hidden when a nearer body's disc covers its anchor point (else it floats over that body).
      const occluded = projected.some((o) => o.id !== id && o.screen.inFront && o.r.distanceM < r.distanceM &&
        Math.hypot(o.screen.x - screen.x, o.screen.y - screen.y) < o.r.screenDiameterPx / 2);
      return {
        id, name: getBody(id).name, x: screen.x, y: screen.y, priority: getBody(id).radiusM,
        // Hide behind the camera, off-screen, occluded, or when the body itself already fills much of the view.
        visible: screen.inFront && !occluded && r.screenDiameterPx < scene.viewportHeight * 0.5 &&
          screen.x > -50 && screen.x < window.innerWidth + 50 && screen.y > -20 && screen.y < window.innerHeight + 20,
      };
    }),
    toggles.labels,
  );
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
