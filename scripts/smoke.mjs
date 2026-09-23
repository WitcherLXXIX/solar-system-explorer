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
  check(far > 1e13, `zoomed out to the maximum (${far.toExponential(2)} m)`);

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

  // No clutter at the full-system view, and the frame rate with all 35 bodies.
  await view('2026-09-20T12:00:00Z', 'sun', 1e12, 0, 60);
  const systemLabels = await page.evaluate(() => window.__solar.labelsShown());
  check(!systemLabels.some((id) => MOON_IDS.includes(id)), `no moon labels at the full-system view (${systemLabels.join(', ')})`);
  const fpsSystem = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at the full-system view with all 35 bodies: ${fpsSystem.toFixed(1)} fps`);
  check(fpsSystem >= 15, `frame rate at the full-system view is usable (${fpsSystem.toFixed(1)} fps; target 30 or better)`);
  await view('2026-09-20T12:00:00Z', 'jupiter', 4e9, 30, 15);
  const fpsJupiter = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate in the Jupiter system with its moons, orbit lines and labels: ${fpsJupiter.toFixed(1)} fps`);
  check(fpsJupiter >= 15, `frame rate in the Jupiter system is usable (${fpsJupiter.toFixed(1)} fps; target 30 or better)`);

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
