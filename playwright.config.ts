import {
  defineConfig,
  devices,
  type ReporterDescription,
} from '@playwright/test';

/**
 * Playwright end-to-end / cross-browser config.
 *
 * Specs live under `e2e/` (kept out of `src/` so Vitest — which globs
 * `src/**\/*.test.ts` — never tries to run them). The specs under `e2e/plan/`
 * automate the numbered items of `docs/contributing/cross-browser-test-plan.md`
 * and carry the plan IDs in their test titles.
 *
 * Browser matrix: every test runs against Chromium (Chrome), Firefox, WebKit
 * (Safari's engine) and Microsoft Edge. The first three come from
 * `npx playwright install`; Edge is a branded channel that needs a one-time
 * `npx playwright install msedge` (or uses a system-installed Edge).
 * To run a subset: `npm run e2e -- --project=chromium --project=firefox`.
 *
 * Reporting: a single consolidated HTML report is written to
 * `playwright-report/` covering the whole matrix — one row per test with a
 * result per browser project, and failure details (error message, trace,
 * screenshot) attached to the failing entry. Open it with `npm run e2e:report`.
 *
 * Browser binaries are resolved from `PLAYWRIGHT_BROWSERS_PATH` when set
 * (the managed environment pre-installs them under `/opt/pw-browsers`).
 */

// Console reporter alongside the HTML file: annotations on CI, a list locally.
const consoleReporter: ReporterDescription = process.env.CI
  ? ['github']
  : ['list'];

/** Chromium-only context extras: clipboard permissions so the Edit-menu
 *  copy/paste tests can exercise the async Clipboard API path. Firefox and
 *  WebKit don't accept these permission names (their tests exercise the
 *  fallback paths instead). */
const CHROMIUM_PERMISSIONS = ['clipboard-read', 'clipboard-write'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    consoleReporter,
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: CHROMIUM_PERMISSIONS,
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        permissions: CHROMIUM_PERMISSIONS,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
