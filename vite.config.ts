import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo at /solar-system-explorer/, not the domain root, so production
  // asset URLs need that prefix. Local dev and the test/smoke scripts are unaffected (they use '/').
  base: command === 'build' ? '/solar-system-explorer/' : '/',
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
