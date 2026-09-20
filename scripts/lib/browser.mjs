import { chromium } from 'playwright-core';
import { createServer } from 'vite';

/** Starts the Vite dev server on a fixed port. */
export async function startServer(port = 5199) {
  const server = await createServer({ server: { port, strictPort: true }, logLevel: 'warn' });
  await server.listen();
  return { server, url: `http://localhost:${port}/` };
}

/**
 * Launches a VISIBLE (headed) Chromium window. Never headless: the user wants to see every browser test.
 * Refuses to run without a display instead of falling back to headless.
 */
export async function launchVisible() {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.error('No display available. Browser tests must run in a visible window; stopping.');
    process.exit(2);
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
    headless: false,
    args: ['--window-size=1320,860', '--window-position=80,40'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return { browser, page, errors };
}
