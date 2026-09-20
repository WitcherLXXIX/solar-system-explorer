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

  let maxHi = 0;
  let maxHiTextures = 0;
  let maxTextures = 0;
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun']) {
    await view('2026-09-20T12:00:00Z', id, 3e6 + (id === 'sun' ? 1e9 : 0), 0, 20);
    maxHi = Math.max(maxHi, (await page.evaluate(() => window.__solar.hiResBodies())).length);
    maxHiTextures = Math.max(maxHiTextures, await page.evaluate(() => window.__solar.hiTextureCount()));
    maxTextures = Math.max(maxTextures, await page.evaluate(() => window.__solar.textureCount()));
  }
  check(maxHi <= 2, `at most two bodies held 8K maps at once (max ${maxHi})`);
  // Earth holds three hi maps (day, night, clouds); one more body may add its colour map. A leak would exceed this.
  check(maxHiTextures <= 4, `resident hi-res textures stayed within budget (max ${maxHiTextures})`);
  check(maxTextures <= 45, `GPU texture count stayed bounded (max ${maxTextures})`);

  // The 0.2% floor: the camera at its minimum altitude over Earth still renders and keeps a usable frame rate.
  await view('2026-09-20T12:00:00Z', 'earth', 1, 0, 20);
  const floorAlt = await page.evaluate(() => window.__solar.altitudeM());
  check(floorAlt < 2e4, `minimum altitude is 0.2% of Earth's radius (${floorAlt.toFixed(0)} m)`);
  check((await page.evaluate(() => window.__solar.litPixels())) > 500, 'Earth still renders at the minimum altitude');
  const fps = await page.evaluate(() => window.__solar.fps(3000));
  console.log(`INFO  frame rate at Earth's minimum altitude: ${fps.toFixed(1)} fps`);
  check(fps >= 15, `frame rate at close range is usable (${fps.toFixed(1)} fps; target 30 or better)`);


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
