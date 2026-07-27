import {
  defineConfig,
  devices,
  type ReporterDescription,
} from '@playwright/test';

/**
 * Playwright end-to-end / cross-browser config.
 *
 * Browser matrix: every test runs against Chromium (Chrome), Firefox, WebKit
 * (Safari's engine) and Microsoft Edge. The first three come from
 * `npx playwright install`; Edge is a branded channel that needs a one-time
 * `npx playwright install msedge` (or uses a system-installed Edge).
 * To run a subset: `npm run e2e -- --project=chromium --project=firefox`,
 * or one capability on Chromium only: `npm run e2e:chromium -- e2e/<capability>`.
 *
 * Browser binaries are resolved from `PLAYWRIGHT_BROWSERS_PATH` when set
 * (the managed environment pre-installs them under `/opt/pw-browsers`).
 */

const consoleReporter: ReporterDescription = process.env.CI
  ? ['github']
  : ['list'];

const CHROMIUM_PERMISSIONS = ['clipboard-read', 'clipboard-write'];

export default defineConfig({
  testDir: './e2e',
  // The screenshot-capture spec is a utility that writes image files
  // into docs/public/ rather than asserting behaviour, exclude here.
  testIgnore: '**/capture-docs-screenshots.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    consoleReporter,
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
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
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // The standalone-player specs stub the share API with page.route.
      // Point it at a dummy origin so the fetch is actually issued and then 
      // intercepted; no real network call is made.
      env: { ...process.env, VITE_SHARE_API_URL: 'https://api.example.test' },
    },
    {
      // The in-app docs drawer iframes /docs/, which the IDE dev server
      // proxies to this VitePress dev server (see vite.config.ts). Without it
      // the drawer-content assertions have nothing to show.
      command: 'npm run docs:dev -- --port 5174',
      url: 'http://localhost:5174/docs/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
