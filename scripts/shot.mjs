// Usage: node scripts/shot.mjs out.png [--fly <bodyId>] [--time ISO] [--view id,altitudeM,yawOffsetDeg,pitchDeg] [--wheel <pixels>] [--effects off]
// Opens a visible browser, optionally flies/zooms, saves a screenshot, prints console errors.
import { launchVisible, startServer } from './lib/browser.mjs';

const args = process.argv.slice(2);
const out = args[0] ?? 'shot.png';
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const { server, url } = await startServer();
let browser;
try {
  const launched = await launchVisible();
  browser = launched.browser;
  const { page, errors } = launched;
  await page.goto(url);
  await page.waitForFunction(() => window.__solar && window.__solar.frames > 5, null, { timeout: 30000 });
  const fly = option('--fly');
  if (fly) {
    await page.evaluate((id) => window.__solar.flyTo(id), fly);
    await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 15000 });
  }
  const time = option('--time');
  if (time) await page.evaluate((iso) => window.__solar.setTime(iso), time);
  const view = option('--view');
  if (view) {
    const [id, altitudeM, yawOffsetDeg, pitchDeg] = view.split(',');
    await page.evaluate(
      ([i, a, y, p]) => window.__solar.setView(i, Number(a), Number(y), Number(p)),
      [id, altitudeM, yawOffsetDeg, pitchDeg],
    );
  }
  const wheel = option('--wheel');
  if (wheel) {
    await page.mouse.move(640, 360);
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, Number(wheel) / 20);
      await page.waitForTimeout(30);
    }
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
  console.log(`saved ${out}; console errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await page.waitForTimeout(Number(process.env.SHOT_HOLD_MS ?? 1500));
} finally {
  await browser?.close();
  await server.close();
}
