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
  check(near < 2e5, `zoomed back in to the minimum altitude (${near.toExponential(2)} m)`);
  const litNear = await page.evaluate(() => window.__solar.litPixels());
  check(litNear > 500, `Earth still renders at minimum altitude (${litNear} lit pixels)`);

  await page.evaluate(() => window.__solar.flyTo('neptune'));
  await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 15000 });
  check((await page.evaluate(() => window.__solar.focusId())) === 'neptune', 'flew to Neptune');
  const litNeptune = await page.evaluate(() => window.__solar.litPixels());
  check(litNeptune > 500, `Neptune is visible (${litNeptune} lit pixels)`);

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
