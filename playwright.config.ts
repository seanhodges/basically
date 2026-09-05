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
  // One CI retry, not two: the suite runs on a single 30-minute-capped runner,
  // where a second retry of a slow spec costs more than it buys.
  retries: process.env.CI ? 1 : 0,
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
  // One server over the built artifact, not two dev servers over source.
  //
  // The suite used to run against `vite dev` plus a VitePress dev server behind
  // the app's /docs proxy, which meant every test paid for the unbundled module
  // graph - React, CodeMirror and the emulator cores as separate requests - on a
  // cold context. `dist/` is laid out exactly as the deployed artifact is, docs
  // and all, so one static server replaces both and the proxy with them.
  //
  // The build runs here rather than as a separate step so `npm run e2e` is still
  // one command; the timeout covers it, which is why it is not the default 60s.
  // Generous with it because CI's runner has half the cores this was measured on
  // and the e2e job is a blocking gate - a build that is merely slow must not
  // read as a failure.
  //
  // `reuseExistingServer` now means reusing whatever is already on 5173, which
  // serves a build rather than live source: a server left running by hand can
  // therefore be stale. Playwright tears down the one it starts itself, so this
  // only bites someone who started their own.
  webServer: {
    command: 'npm run e2e:build && npm run e2e:serve',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    // The standalone-player specs stub the share API with page.route. Point it
    // at a dummy origin so the fetch is actually issued and then intercepted; no
    // real network call is made. Read at build time now rather than by a dev
    // server, since Vite folds it into the bundle.
    env: { ...process.env, VITE_SHARE_API_URL: 'https://api.example.test' },
  },
});
