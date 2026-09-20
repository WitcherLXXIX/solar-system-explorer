import './style.css';
import { CameraController, sunwardYaw, DEFAULT_PITCH, type FocusSource } from './camera/cameraController';
import { SimClock } from './clock/clock';
import { frameDelta } from './clock/frameDelta';
import { BODY_IDS, getBody, type BodyId } from './catalog/bodies';
import { computeFrame, type Frame } from './ephemeris/frame';
import { SolarScene, type FrameInput } from './render/solarScene';
import { isWebGL2Available } from './render/webgl';
import { length } from './math';
import { DEG } from './units';
import { createBodyList } from './ui/bodyList';
import { createInfoPanel } from './ui/infoPanel';
import { attachInput } from './ui/input';
import { createLabels } from './ui/labels';
import { createScaleReadout } from './ui/scaleReadout';
import { createTimeBar } from './ui/timeBar';
import { isLabelOccluded, type ScreenBody } from './ui/labelLayout';
import { createToggles } from './ui/toggles';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const element = (id: string): HTMLElement => document.querySelector<HTMLElement>(`#${id}`)!;

if (!isWebGL2Available()) {
  const fallback = document.querySelector<HTMLElement>('#fallback')!;
  fallback.hidden = false;
  fallback.textContent = 'This app needs WebGL 2, which your browser or graphics driver does not provide.';
  canvas.style.display = 'none';
  // The HUD panels are empty without a scene; hide them instead of painting five empty boxes.
  element('hud').hidden = true;
  element('labels').hidden = true;
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
const toggles = createToggles(element('toggles'));
const timeBar = createTimeBar(element('timebar'), clock);
const readout = createScaleReadout(element('scale'));
const infoPanel = createInfoPanel(element('info'));
const labels = createLabels(element('labels'));
const bodyList = createBodyList(element('bodies'), (id) => camera.flyTo(id));
let shownBody: BodyId | null = null;
const FOCUSED_LABEL_HIDE_PX = 24;

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
  // Distance from the Sun is meaningless when the Sun itself is shown (it would read 0.00 m).
  const sunDistanceM = displayed === 'sun' ? null : length(frame[displayed].position);
  infoPanel.update(sunDistanceM);
  readout.update({ pose, fovYRad: scene.fovYRad, viewportHeightPx: scene.viewportHeight, sunDistanceM });
  timeBar.update();
  const onScreen: ScreenBody[] = BODY_IDS.map((id) => {
    const r = info.get(id)!;
    const screen = scene.projectToScreen(r.rel);
    return { id, x: screen.x, y: screen.y, inFront: screen.inFront, distanceM: r.distanceM, screenDiameterPx: r.screenDiameterPx };
  });
  labels.update(
    onScreen.map((b) => {
      // The label offset is about 10 px, so once the focused body's disc is wider than that its label would sit on
      // its centre; the info panel and scale readout already name it, so drop that one label.
      const coversOwnLabel = b.id === displayed && b.screenDiameterPx > FOCUSED_LABEL_HIDE_PX;
      return {
        id: b.id, name: getBody(b.id).name, x: b.x, y: b.y, priority: getBody(b.id).radiusM,
        // Hide behind the camera, off-screen, occluded, or when the body itself already fills much of the view.
        visible: b.inFront && !coversOwnLabel && !isLabelOccluded(b, onScreen) &&
          b.screenDiameterPx < scene.viewportHeight * 0.5 &&
          b.x > -50 && b.x < window.innerWidth + 50 && b.y > -20 && b.y < window.innerHeight + 20,
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
      setView(id: BodyId, altitudeM: number, yawOffsetDeg: number, pitchDeg: number): void;
      setTime(iso: string): void;
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
  setView: (id, altitudeM, yawOffsetDeg, pitchDeg) => {
    const base = id === 'sun' ? 0 : sunwardYaw(computeFrame(clock.date)[id].position);
    camera.snapTo(id, altitudeM, base + yawOffsetDeg * DEG, pitchDeg * DEG);
  },
  setTime: (iso) => {
    clock.setTimeMs(Date.parse(iso));
    clock.pause();
  },
};
