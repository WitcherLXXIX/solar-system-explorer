// Usage: node scripts/shot.mjs out.png [--fly <bodyId>] [--wheel <pixels>]
// Opens a visible browser, optionally flies/zooms, saves a screenshot, prints console errors.
import { launchVisible, startServer } from './lib/browser.mjs';

const args = process.argv.slice(2);
const out = args[0] ?? 'shot.png';
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const { server, url } = await startServer();
const { browser, page, errors } = await launchVisible();
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__solar && window.__solar.frames > 5, null, { timeout: 30000 });
  const fly = option('--fly');
  if (fly) {
    await page.evaluate((id) => window.__solar.flyTo(id), fly);
    await page.waitForFunction(() => !window.__solar.isFlying(), null, { timeout: 15000 });
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
} finally {
  await page.waitForTimeout(Number(process.env.SHOT_HOLD_MS ?? 1500));
  await browser.close();
  await server.close();
}
