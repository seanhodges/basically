import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright end-to-end / visual-inspection config.
 *
 * Specs live under `e2e/` (kept out of `src/` so Vitest — which globs
 * `src/**\/*.test.ts` — never tries to run them). Playwright boots the Vite
 * dev server itself via `webServer`, so `npm run e2e` is all that's needed.
 *
 * Browser binaries are resolved from `PLAYWRIGHT_BROWSERS_PATH` when set
 * (the managed environment pre-installs them under `/opt/pw-browsers`);
 * otherwise install them once with `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
