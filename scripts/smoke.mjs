// Visible (headed) end-to-end check: renders, zooms out and in, flies to Neptune, no console errors.
// SMOKE_HOLD_MS keeps the window open at the end (default 4000) so the result can be seen.
import { launchVisible, startServer } from './lib/browser.mjs';

const HOLD_MS = Number(process.env.SMOKE_HOLD_MS ?? 4000);
let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) failed = true;
};

const { server, url } = await startServer();
const { browser, page, errors } = await launchVisible();
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__solar && window.__solar.frames > 5, null, { timeout: 30000 });
  check(true, 'app rendered frames');

  const lit = await page.evaluate(() => window.__solar.litPixels());
  check(lit > 500, `Earth is visible at start (${lit} lit pixels in the centre patch)`);

  await page.mouse.move(640, 360);
  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(25);
  }
  const far = await page.evaluate(() => window.__solar.altitudeM());
  check(far > 9.9e16, `zoomed out to the maximum (${far.toExponential(2)} m, about 10.6 ly)`);

  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(25);
  }
  const near = await page.evaluate(() => window.__solar.altitudeM());
  check(near < 2e4, `zoomed back in to the minimum altitude (${near.toExponential(2)} m)`);
  const litNear = await page.evaluate(() => window.__solar.litPixels());
  check(litNear > 500, `Earth still renders at minimum altitude (${litNear} lit pixels)`);

  await page.evaluate(() => window.__solar.flyTo('neptune'));
  await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 15000 });
  check((await page.evaluate(() => window.__solar.focusId())) === 'neptune', 'flew to Neptune');
  const litNeptune = await page.evaluate(() => window.__solar.litPixels());
  check(litNeptune > 500, `Neptune is visible (${litNeptune} lit pixels)`);

  // ---- phase 2a: effects, A/B against effects switched off (frozen time, visible window) ----
  const settle = () => page.waitForTimeout(900);
  const stats = () => page.evaluate(() => window.__solar.pixelStats());
  const view = async (time, id, altitudeM, yawOffsetDeg, pitchDeg) => {
    await page.evaluate(([t, i, a, y, p]) => { window.__solar.setTime(t); window.__solar.setView(i, a, y, p); },
      [time, id, altitudeM, yawOffsetDeg, pitchDeg]);
    await settle();
  };
  const ab = async (time, id, altitudeM, yaw, pitch) => {
    await view(time, id, altitudeM, yaw, pitch);
    await page.evaluate(() => window.__solar.setEffects(true));
    await settle();
    const on = await stats();
    await page.evaluate(() => window.__solar.setEffects(false));
    await settle();
    const off = await stats();
    await page.evaluate(() => window.__solar.setEffects(true));
    return { on, off };
  };

  const atmo = await ab('2026-09-20T12:00:00Z', 'earth', 1.5e7, 90, 10);
  check(atmo.on.blue - atmo.off.blue >= 13000,
    `Earth's atmosphere adds a blue limb (blue pixels ${atmo.off.blue} -> ${atmo.on.blue})`);

  const night = await ab('2026-09-20T22:00:00Z', 'earth', 2e7, 180, 10);
  check(night.on.warm - night.off.warm >= 230,
    `Earth's night side shows city lights (warm pixels ${night.off.warm} -> ${night.on.warm})`);

  const rings = await ab('2017-05-24T12:00:00Z', 'saturn', 4.5e8, 60, 20);
  check(rings.on.lit - rings.off.lit >= 20000,
    `Saturn's rings add pixels (lit pixels ${rings.off.lit} -> ${rings.on.lit})`);

  // 8K maps: Earth gets them up close, and never more than two bodies hold them at once.
  await view('2026-09-20T12:00:00Z', 'earth', 1e6, 0, 30);
  let earthHi = false;
  for (let i = 0; i < 30 && !earthHi; i++) {
    earthHi = (await page.evaluate(() => window.__solar.hiResBodies())).includes('earth');
    if (!earthHi) await page.waitForTimeout(200);
  }
  check(earthHi, 'Earth holds its 8K maps at close range');
  // Granted is not resident: wait until Earth's day, night and cloud 8K maps have actually loaded (a silent 8K failure fails here).
  let earthHiTextures = 0;
  for (let i = 0; i < 50 && earthHiTextures < 3; i++) {
    earthHiTextures = await page.evaluate(() => window.__solar.hiTextureCount());
    if (earthHiTextures < 3) await page.waitForTimeout(200);
  }
  check(earthHiTextures >= 3, `Earth's three 8K maps (day, night, clouds) are resident (${earthHiTextures} hi-res textures)`);

  let maxHi = 0;
  let maxHiTextures = 0;
  let maxTextures = 0;
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun', 'moon']) {
    await view('2026-09-20T12:00:00Z', id, 3e6 + (id === 'sun' ? 1e9 : 0), 0, 20);
    maxHi = Math.max(maxHi, (await page.evaluate(() => window.__solar.hiResBodies())).length);
    maxHiTextures = Math.max(maxHiTextures, await page.evaluate(() => window.__solar.hiTextureCount()));
    maxTextures = Math.max(maxTextures, await page.evaluate(() => window.__solar.textureCount()));
  }
  check(maxHi <= 2, `at most two bodies held 8K maps at once (max ${maxHi})`);
  // Earth holds three hi maps (day, night, clouds); one more body may add its colour map (Saturn adds its ring strip too,
  // but never while Earth still holds its maps in this one-body sweep). A leak would exceed this.
  // The Moon's 8K colour map is one more resident map; the budget still allows only two bodies at once, so five is the bound.
  check(maxHiTextures <= 5, `resident hi-res textures stayed within budget (max ${maxHiTextures})`);
  check(maxTextures <= 45, `GPU texture count stayed bounded (max ${maxTextures})`);

  // The 0.2% floor: the camera at its minimum altitude over Earth still renders and keeps a usable frame rate.
  await view('2026-09-20T12:00:00Z', 'earth', 1, 0, 20);
  const floorAlt = await page.evaluate(() => window.__solar.altitudeM());
  check(floorAlt < 2e4, `minimum altitude is 0.2% of Earth's radius (${floorAlt.toFixed(0)} m)`);
  check((await page.evaluate(() => window.__solar.litPixels())) > 500, 'Earth still renders at the minimum altitude');
  const fps = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at Earth's minimum altitude: ${fps.toFixed(1)} fps`);
  check(fps >= 15, `frame rate at close range is usable (${fps.toFixed(1)} fps; target 30 or better)`);


  // ---- phase 2b: moons and dwarf planets ----
  const MOON_IDS = [
    'moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea',
    'titan', 'iapetus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'charon',
  ];

  // The body list is a tree: seven bodies have moons (Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto).
  const chevrons = await page.$$eval('#bodies .chevron', (els) => els.length);
  check(chevrons === 7, `the body list has an expand button for each of the seven bodies with moons (${chevrons})`);
  await page.click('button[aria-label="Expand the moons of Jupiter"]');
  const rows = await page.$$eval('#bodies .body-btn', (els) => els.map((e) => e.textContent));
  check(['Io', 'Europa', 'Ganymede', 'Callisto'].every((n) => rows.includes(n)), 'expanding Jupiter lists its four Galilean moons');

  // Earth to the Moon on the same unbroken scale.
  await view('2026-09-20T12:00:00Z', 'earth', 3e7, 0, 20);
  await page.evaluate(() => window.__solar.flyTo('moon'));
  await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 15000 });
  check((await page.evaluate(() => window.__solar.focusId())) === 'moon', 'flew from Earth to the Moon');
  check((await page.evaluate(() => window.__solar.litPixels())) > 500, 'the Moon renders after the flight');

  // The Moon's 8K map loads when it fills the view.
  await view('2026-09-26T16:49:00Z', 'moon', 3e5, 0, 0);
  let moonHi = false;
  for (let i = 0; i < 30 && !moonHi; i++) {
    moonHi = (await page.evaluate(() => window.__solar.hiResBodies())).includes('moon');
    if (!moonHi) await page.waitForTimeout(200);
  }
  check(moonHi, 'the Moon holds its 8K map at close range');

  // Jupiter's four moons are visible and labelled from a few million km out.
  await view('2026-09-20T12:00:00Z', 'jupiter', 4e9, 30, 15);
  const jupiterLabels = await page.evaluate(() => window.__solar.labelsShown());
  check(['io', 'europa', 'ganymede', 'callisto'].every((id) => jupiterLabels.includes(id)),
    `all four Galilean moons are labelled near Jupiter (${jupiterLabels.join(', ')})`);

  // Titan's haze: A/B against effects off. First passing run measured a difference of 12809 warm pixels
  // (28241 -> 41050); this threshold is set to 6000, comfortably at most half that measured difference.
  const haze = await ab('2026-09-20T12:00:00Z', 'titan', 1.2e7, 90, 10);
  check(haze.on.warm - haze.off.warm >= 6000, `Titan's haze adds warm pixels (warm pixels ${haze.off.warm} -> ${haze.on.warm})`);

  // Phobos, 22 km across: the 0.2% floor is about 22 m.
  await view('2026-09-20T12:00:00Z', 'phobos', 1, 0, 20);
  const phobosAlt = await page.evaluate(() => window.__solar.altitudeM());
  check(phobosAlt < 30, `Phobos's minimum altitude is 0.2% of its radius (${phobosAlt.toFixed(1)} m)`);
  check((await page.evaluate(() => window.__solar.litPixels())) > 500, 'Phobos still renders at its minimum altitude');

  // No clutter at the full-system view, and the frame rate with all 55 bodies.
  await view('2026-09-20T12:00:00Z', 'sun', 1e12, 0, 60);
  const systemLabels = await page.evaluate(() => window.__solar.labelsShown());
  check(!systemLabels.some((id) => MOON_IDS.includes(id)), `no moon labels at the full-system view (${systemLabels.join(', ')})`);
  const fpsSystem = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at the full-system view with all 55 bodies:${fpsSystem.toFixed(1)} fps`);
  check(fpsSystem >= 15, `frame rate at the full-system view is usable (${fpsSystem.toFixed(1)} fps; target 30 or better)`);
  await view('2026-09-20T12:00:00Z', 'jupiter', 4e9, 30, 15);
  const fpsJupiter = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate in the Jupiter system with its moons, orbit lines and labels: ${fpsJupiter.toFixed(1)} fps`);
  check(fpsJupiter >= 15, `frame rate in the Jupiter system is usable (${fpsJupiter.toFixed(1)} fps; target 30 or better)`);

  // ---- phase 3: belts, named small bodies, comet tails ----
  const shot = async (name) => {
    if (process.env.SMOKE_SHOT_DIR) await page.screenshot({ path: `${process.env.SMOKE_SHOT_DIR}/${name}.png` });
  };
  const SMALL_IDS = ['vesta', 'pallas', 'hygiea', 'juno', 'halley', 'halebopp', 'c67p', 'swifttuttle'];

  const beltCounts = await page.evaluate(() => window.__solar.beltCounts());
  check(beltCounts.main >= 3000 && beltCounts.kuiper >= 2000, `both belts are populated (${beltCounts.main} and ${beltCounts.kuiper} points)`);

  // Belts on and off from above the ecliptic at asteroid-belt scale, then at Kuiper-belt scale. Measured 2026-09-24 (lit pixels
  // off -> on): asteroid belt 28914 -> 53813 (+24899), Kuiper belt 23268 -> 41196 (+17928); the 300 threshold is far below half of either.
  for (const [label, altitude, minDiff] of [['asteroid belt', 1.2e12, 300], ['Kuiper belt', 1.2e13, 300]]) {
    await view('2026-09-20T12:00:00Z', 'sun', altitude, 0, 70);
    await page.evaluate(() => window.__solar.setBelts(true));
    await settle();
    const on = await stats();
    check(await page.evaluate(() => window.__solar.beltsVisible()), `the belts are drawn at the ${label} view`);
    await shot(`phase3-${label.replace(' ', '-')}`);
    await page.evaluate(() => window.__solar.setBelts(false));
    await settle();
    const off = await stats();
    await page.evaluate(() => window.__solar.setBelts(true));
    check(on.lit - off.lit >= minDiff, `the ${label} adds pixels (lit pixels ${off.lit} -> ${on.lit})`);
  }

  // Close to a planet the belts are faded out (a few far dots would look like stars).
  await view('2026-09-20T12:00:00Z', 'earth', 3e7, 0, 20);
  await settle();
  check(!(await page.evaluate(() => window.__solar.beltsVisible())), 'the belts are hidden when the camera is close to Earth');

  // Named small bodies: list group, flight, render.
  await page.click('button[aria-label="Show the small bodies"]');
  const smallRows = await page.$$eval('#bodies .body-btn', (els) => els.map((e) => e.textContent));
  check(['Vesta', 'Halley', 'Swift-Tuttle', 'Hale-Bopp'].every((n) => smallRows.includes(n)), 'the Small bodies group lists the named objects');
  for (const id of ['vesta', 'halley', 'swifttuttle']) {
    await view('2026-09-20T12:00:00Z', 'sun', 3e12, 0, 60);
    await page.evaluate((target) => window.__solar.flyTo(target), id);
    await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 30000 });
    check((await page.evaluate(() => window.__solar.focusId())) === id, `flew to ${id}`);
    check((await page.evaluate(() => window.__solar.litPixels())) > 100, `${id} renders after the flight`);
  }
  // Every named body can be focused and produces finite output at its own minimum altitude.
  for (const id of SMALL_IDS) {
    await view('2026-09-20T12:00:00Z', id, 1, 0, 20);
    const alt = await page.evaluate(() => window.__solar.altitudeM());
    check(Number.isFinite(alt) && alt > 0 && alt < 1e5, `${id}: minimum altitude is small and finite (${alt.toFixed(1)} m)`);
  }

  // Comet tails: present near perihelion, absent far from the Sun, gone with effects off. Measured 2026-09-24: Halley 1986 lit
  // pixels 50228 -> 55736 (+5508) with the tail; the 150 threshold is under half of that.
  await view('1986-02-09T12:00:00Z', 'halley', 1e11, 90, 10);
  await settle();
  check((await page.evaluate(() => window.__solar.tailsVisible())).includes('halley'), 'Halley shows a tail near its 1986 perihelion');
  const tailOn = await stats();
  await shot('phase3-halley-1986');
  await page.evaluate(() => window.__solar.setEffects(false));
  await settle();
  const tailOff = await stats();
  await page.evaluate(() => window.__solar.setEffects(true));
  check(tailOn.lit - tailOff.lit >= 150, `Halley's tail adds pixels (lit pixels ${tailOff.lit} -> ${tailOn.lit})`);
  await view('2026-09-23T00:00:00Z', 'halley', 1e11, 90, 10);
  await settle();
  check(!(await page.evaluate(() => window.__solar.tailsVisible())).includes('halley'), 'Halley has no tail far from the Sun (2026)');
  await view('1997-04-01T12:00:00Z', 'halebopp', 1e11, 90, 10);
  await settle();
  check((await page.evaluate(() => window.__solar.tailsVisible())).includes('halebopp'), 'Hale-Bopp shows a tail near its 1997 perihelion');
  await shot('phase3-halebopp-1997');

  // Labels: no small-body labels at the full-system view.
  await view('2026-09-20T12:00:00Z', 'sun', 1e12, 0, 60);
  const labelsNow = await page.evaluate(() => window.__solar.labelsShown());
  check(!labelsNow.some((id) => SMALL_IDS.includes(id)), `no small-body labels at the full-system view (${labelsNow.join(', ')})`);

  // Frame rate with everything on: 55 bodies and orbit lines, both belts (7000 points), a comet tail.
  const fpsAll = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at the full-system view with 55 bodies and both belts: ${fpsAll.toFixed(1)} fps`);
  check(fpsAll >= 15, `frame rate with the full population is usable (${fpsAll.toFixed(1)} fps; target 30 or better)`);
  await view('1986-02-09T12:00:00Z', 'halley', 1e11, 90, 10);
  const fpsTail = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate near Halley with its tail: ${fpsTail.toFixed(1)} fps`);
  check(fpsTail >= 15, `frame rate near a comet with its tail is usable (${fpsTail.toFixed(1)} fps; target 30 or better)`);
  await shot('phase3-footer');

  // ---- phase 4: deep space ----
  const STAR_IDS = ['proxima', 'alphacena', 'alphacenb', 'barnard', 'wolf359', 'lalande21185', 'siriusa', 'siriusb', 'ross154', 'epseri', 'ross128', 'cygni61a'];

  // The stars are listed in their own group and every one can be flown to.
  await page.click('button[aria-label="Show the nearby stars"]');
  const starRows = await page.$$eval('#bodies .body-btn', (els) => els.map((e) => e.textContent));
  check(['Proxima Centauri', 'Sirius A', 'Sirius B', '61 Cygni A'].every((n) => starRows.includes(n)), 'the Nearby stars group lists the stars');
  for (const id of STAR_IDS) {
    await view('2026-09-20T12:00:00Z', 'sun', 1e12, 0, 60);
    await page.evaluate((target) => window.__solar.flyTo(target), id);
    await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 30000 });
    check((await page.evaluate(() => window.__solar.focusId())) === id, `flew to ${id}`);
    check((await page.evaluate(() => window.__solar.litPixels())) > 500, `${id} renders as a disc after the flight`);
    if (id === 'proxima') await shot('phase4-proxima');
  }
  // Every star can be focused and gives a small finite minimum altitude.
  for (const id of STAR_IDS) {
    await view('2026-09-20T12:00:00Z', id, 1, 0, 20);
    const alt = await page.evaluate(() => window.__solar.altitudeM());
    check(Number.isFinite(alt) && alt > 0 && alt < 1e7, `${id}: minimum altitude is small and finite (${alt.toFixed(1)} m)`);
  }

  // Maximum zoom from the Sun: the camera reaches about 10.6 ly, and several stars are visible with labels. The best of
  // eight look directions is used because which stars fall inside the 50 degree field depends on the direction.
  let bestStars = [];
  for (const [yaw, pitch] of [[0, 30], [90, 30], [180, 30], [270, 30], [0, -30], [90, -30], [180, -30], [270, -30]]) {
    await view('2026-09-20T12:00:00Z', 'sun', 1e17, yaw, pitch);
    const inView = await page.evaluate(() => window.__solar.starsInView());
    if (inView.length > bestStars.length) bestStars = inView;
  }
  const maxAlt = await page.evaluate(() => window.__solar.altitudeM());
  check(maxAlt > 9.9e16, `the camera reaches 1e17 m (${maxAlt.toExponential(2)} m)`);
  console.log(`INFO  most stars in view at maximum zoom: ${bestStars.join(', ')}`);
  check(bestStars.length >= 3, `several stars are visible at maximum zoom (${bestStars.length})`);
  await shot('phase4-max-zoom');

  // Alpha Centauri A and B are a close pair, not one point (about 21 AU apart).
  await view('2026-09-20T12:00:00Z', 'alphacena', 3e14, 0, 20);
  const a = await page.evaluate(() => window.__solar.screenOf('alphacena'));
  const b = await page.evaluate(() => window.__solar.screenOf('alphacenb'));
  const pairPx = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : -1;
  console.log(`INFO  Alpha Centauri A-B separation on screen from 3e14 m: ${pairPx.toFixed(1)} px`);
  check(a && b && a.inFront && b.inFront && pairPx > 4 && pairPx < 80, `Alpha Centauri A and B appear as a close pair (${pairPx.toFixed(1)} px apart)`);
  await shot('phase4-alpha-centauri');
  // Sirius A and B are separate points too (the schematic offset).
  await view('2026-09-20T12:00:00Z', 'siriusa', 3e14, 0, 20);
  const sa = await page.evaluate(() => window.__solar.screenOf('siriusa'));
  const sb = await page.evaluate(() => window.__solar.screenOf('siriusb'));
  const siriusPx = sa && sb ? Math.hypot(sa.x - sb.x, sa.y - sb.y) : -1;
  check(siriusPx > 3 && siriusPx < 80, `Sirius A and B are separate points (${siriusPx.toFixed(1)} px apart)`);

  // Star labels: none while close to a planet, present at system scale.
  await view('2026-09-20T12:00:00Z', 'earth', 3e7, 0, 20);
  check(!(await page.evaluate(() => window.__solar.labelsShown())).some((id) => STAR_IDS.includes(id)), 'no star labels close to Earth');

  // Heliosphere: drawn from outside, gone from inside, and it adds pixels. First passing run: record the measured lit pixels
  // (Deep space off -> on) here and set the threshold below half of that difference.
  await view('2026-09-20T12:00:00Z', 'sun', 1.2e14, 0, 60);
  await page.evaluate(() => window.__solar.setDeepSpace(true));
  await settle();
  check((await page.evaluate(() => window.__solar.deepSpaceState())).heliosphereVisible, 'the heliosphere is drawn at 800 AU');
  const helioOn = await stats();
  await shot('phase4-heliosphere');
  await page.evaluate(() => window.__solar.setDeepSpace(false));
  await settle();
  const helioOff = await stats();
  check(!(await page.evaluate(() => window.__solar.deepSpaceState())).heliosphereVisible, 'the Deep space toggle hides the heliosphere');
  await page.evaluate(() => window.__solar.setDeepSpace(true));
  // first passing run: lit pixels 7392 -> 51879 (+44487); threshold under half of that.
  check(helioOn.lit - helioOff.lit >= 20000, `the heliosphere adds pixels (lit pixels ${helioOff.lit} -> ${helioOn.lit})`);
  await view('2026-09-20T12:00:00Z', 'earth', 3e7, 0, 20);
  await settle();
  check(!(await page.evaluate(() => window.__solar.deepSpaceState())).heliosphereVisible, 'no heliosphere haze close to Earth (inside the bubble)');

  // Oort cloud: all points present, drawn far out, hidden at planet scale, adds pixels.
  const oort = await page.evaluate(() => window.__solar.deepSpaceState());
  check(oort.oortPoints >= 10000, `the Oort cloud is populated (${oort.oortPoints} points)`);
  await view('2026-09-20T12:00:00Z', 'sun', 1e16, 0, 60);
  await settle();
  check((await page.evaluate(() => window.__solar.deepSpaceState())).oortVisible, 'the Oort cloud is drawn at 1e16 m');
  const oortOn = await stats();
  await shot('phase4-oort');
  await page.evaluate(() => window.__solar.setDeepSpace(false));
  await settle();
  const oortOff = await stats();
  await page.evaluate(() => window.__solar.setDeepSpace(true));
  // first passing run: lit pixels 115 -> 43955 (+43840); threshold under half of that.
  check(oortOn.lit - oortOff.lit >= 20000, `the Oort cloud adds pixels (lit pixels ${oortOff.lit} -> ${oortOn.lit})`);
  await view('2026-09-20T12:00:00Z', 'sun', 1e12, 0, 60);
  await settle();
  check(!(await page.evaluate(() => window.__solar.deepSpaceState())).oortVisible, 'the Oort cloud is hidden at the planetary view');

  // Frame rate with everything loaded: 55 bodies, both belts, the full Oort cloud, the heliosphere.
  await view('2026-09-20T12:00:00Z', 'sun', 3e15, 0, 60);
  const fpsDeep = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at 3e15 m with 55 bodies, both belts, the full Oort cloud and the heliosphere: ${fpsDeep.toFixed(1)} fps`);
  check(fpsDeep >= 30, `frame rate with the full deep-space population meets the 30 fps target (${fpsDeep.toFixed(1)} fps)`);
  await shot('phase4-footer');

  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await page.waitForTimeout(HOLD_MS);
} catch (error) {
  console.log(`FAIL  ${error}`);
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
console.log(failed ? 'SMOKE FAILED' : 'SMOKE PASSED');
process.exit(failed ? 1 : 0);
