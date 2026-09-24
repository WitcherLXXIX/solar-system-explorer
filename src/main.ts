import './style.css';
import { CameraController, sunwardYaw, DEFAULT_PITCH, type FocusSource } from './camera/cameraController';
import { SimClock } from './clock/clock';
import { frameDelta } from './clock/frameDelta';
import { BODY_IDS, getBody, isSmallBodyKind, type BodyId } from './catalog/bodies';
import { computeFrame, type Frame } from './ephemeris/frame';
import { labelPriority, moonLabelVisible, smallBodyLabelVisible, starLabelVisible } from './render/orbitFade';
import { SolarScene, type FrameInput, type RenderInfo } from './render/solarScene';
import { isWebGL2Available } from './render/webgl';
import { length, sub } from './math';
import { DEG } from './units';
import { createBodyList } from './ui/bodyList';
import { createInfoPanel } from './ui/infoPanel';
import { attachInput } from './ui/input';
import { createLabels } from './ui/labels';
import { createScaleReadout } from './ui/scaleReadout';
import { createTimeBar } from './ui/timeBar';
import { isLabelOccluded, type ScreenBody } from './ui/labelLayout';
import { createToggles } from './ui/toggles';
import { deepSpaceCaption } from './ui/bodyText';

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
const captionEl = element('caption');
const labels = createLabels(element('labels'));
const bodyList = createBodyList(element('bodies'), (id) => camera.flyTo(id));
let shownBody: BodyId | null = null;
const FOCUSED_LABEL_HIDE_PX = 24;

/** A moon's label shows only while the camera is near its parent, measured in the moon's orbit radii (current distance from the parent). */
function moonLabelAllowed(id: BodyId, info: Map<BodyId, RenderInfo>): boolean {
  const body = getBody(id);
  if (body.kind !== 'moon' || body.parent === null) return true;
  const orbitRadiusM = length(sub(frame[id].position, frame[body.parent].position));
  return moonLabelVisible(info.get(body.parent)!.distanceM, orbitRadiusM);
}

/** A named small body's label shows only while the camera is within 5 AU of it, so the full-system view stays uncluttered. */
function smallBodyLabelAllowed(id: BodyId, info: Map<BodyId, RenderInfo>): boolean {
  return !isSmallBodyKind(getBody(id).kind) || smallBodyLabelVisible(info.get(id)!.distanceM);
}

/** A nearby star's label shows only from planet-system altitude up, or when that star is the focus, so close-up views are not littered with names. */
function starLabelAllowed(id: BodyId, altitudeM: number, displayed: BodyId): boolean {
  return getBody(id).kind !== 'nearstar' || starLabelVisible(altitudeM, id === displayed);
}

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
let screens = new Map<BodyId, { x: number; y: number; inFront: boolean }>();
let starsShown: BodyId[] = [];

function loop(now: number): void {
  const dt = frameDelta(now, last);
  last = now;
  clock.tick(dt);
  frame = computeFrame(clock.date);
  const pose = camera.update(dt);
  lastInput = {
    frame, cameraPos: pose.position, focusPoint: pose.focusPoint,
    altitudeM: pose.altitudeM, date: clock.date, showOrbits: toggles.orbits, showBelts: toggles.belts, showDeepSpace: toggles.deepSpace,
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
  captionEl.textContent = deepSpaceCaption(pose.altitudeM, toggles.deepSpace);
  const onScreen: ScreenBody[] = BODY_IDS.map((id) => {
    const r = info.get(id)!;
    const screen = scene.projectToScreen(r.rel);
    return { id, x: screen.x, y: screen.y, inFront: screen.inFront, distanceM: r.distanceM, screenDiameterPx: r.screenDiameterPx };
  });
  screens = new Map(onScreen.map((b) => [b.id, { x: b.x, y: b.y, inFront: b.inFront }]));
  starsShown = onScreen
    .filter((b) => getBody(b.id).kind === 'nearstar' && b.inFront && b.x >= 0 && b.x <= window.innerWidth && b.y >= 0 && b.y <= window.innerHeight)
    .map((b) => b.id);
  labels.update(
    onScreen.map((b) => {
      // The label offset is about 10 px, so once the focused body's disc is wider than that its label would sit on
      // its centre; the info panel and scale readout already name it, so drop that one label.
      const coversOwnLabel = b.id === displayed && b.screenDiameterPx > FOCUSED_LABEL_HIDE_PX;
      return {
        id: b.id, name: getBody(b.id).name, x: b.x, y: b.y,
        // Moons rank below every planet and dwarf planet in the declutter.
        priority: labelPriority(getBody(b.id).kind, getBody(b.id).radiusM),
        // Hide behind the camera, off-screen, occluded, when the body itself already fills much of the view,
        // or (moons) when the camera is far from the parent.
        visible: b.inFront && !coversOwnLabel && moonLabelAllowed(b.id, info) && smallBodyLabelAllowed(b.id, info) && starLabelAllowed(b.id, pose.altitudeM, displayed) && !isLabelOccluded(b, onScreen) &&
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
      meanLuma(): number;
      altitudeM(): number;
      isFlying(): boolean;
      focusId(): BodyId;
      flyTo(id: BodyId): void;
      setView(id: BodyId, altitudeM: number, yawOffsetDeg: number, pitchDeg: number): void;
      setTime(iso: string): void;
      setEffects(on: boolean): void;
      hiResBodies(): string[];
      labelsShown(): string[];
      textureCount(): number;
      hiTextureCount(): number;
      pixelStats(): { lit: number; warm: number; blue: number };
      fps(ms: number): Promise<number>;
      beltCounts(): { main: number; kuiper: number };
      setBelts(on: boolean): void;
      beltsVisible(): boolean;
      tailsVisible(): string[];
      setDeepSpace(on: boolean): void;
      deepSpaceState(): { oortPoints: number; oortVisible: boolean; heliosphereVisible: boolean };
      starsInView(): BodyId[];
      screenOf(id: BodyId): { x: number; y: number; inFront: boolean } | null;
    };
  }
}

window.__solar = {
  get frames() {
    return frames;
  },
  litPixels: () => scene.centreLitPixels(),
  meanLuma: () => scene.centreMeanLuma(),
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
  setEffects: (on) => scene.setEffectsEnabled(on),
  hiResBodies: () => scene.hiResBodies(),
  labelsShown: () => labels.shown(),
  textureCount: () => scene.textureCount(),
  hiTextureCount: () => scene.hiTextureCount(),
  pixelStats: () => scene.pixelStats(),
  beltCounts: () => scene.beltPointCounts(),
  setBelts: (on) => toggles.set('belts', on),
  beltsVisible: () => scene.beltsVisible(),
  tailsVisible: () => scene.cometTailsVisible(),
  setDeepSpace: (on) => toggles.set('deepSpace', on),
  deepSpaceState: () => ({ oortPoints: scene.oortPointCount(), oortVisible: scene.oortVisible(), heliosphereVisible: scene.heliosphereVisible() }),
  starsInView: () => starsShown,
  screenOf: (id) => screens.get(id) ?? null,
  fps: async (ms) => {
    const startFrames = frames;
    const startTime = performance.now();
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
    return (frames - startFrames) / ((performance.now() - startTime) / 1000);
  },
};
