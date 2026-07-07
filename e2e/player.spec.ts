import { test, expect } from './fixtures';
import { chromium } from '@playwright/test';
import { canvasPainted } from './plan/helpers';
import { SHARE_ID, SHARE_GLOB, shareGet, zx81Record } from './shareStub';

/**
 * Standalone player (src/player/PlayerApp.tsx), Stage 7 e2e.
 *
 * The player fetches its shared program from the share API; every case here
 * stubs that GET with `page.route` (the suite's first use of network
 * interception - `route.fulfill` bypasses CORS) so the tests are deterministic
 * and need no backend. A ZX81 record is used throughout because it is the
 * lightest emulator and its verb is `/load/`.
 */

const LANDSCAPE_MOBILE_QUERY =
  '(orientation: landscape) and (max-height: 600px) and (pointer: coarse)';
const WELCOME_SEEN_KEY = 'mbide.hasSeenWelcome';
const KEYBOARD_AUTOSHOW_KEY = 'mbide.keyboardAutoShow';

test('boots a shared program, auto-runs and paints the screen', async ({
  page,
}) => {
  test.setTimeout(120_000); // ROM boot + first frames can be slow in CI
  await page.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
  await page.goto(`/load/${SHARE_ID}`);

  // Reaching the running phase surfaces the restart Play button and the
  // program/machine labels in the top bar.
  await expect(page.getByRole('button', { name: '▶ Play' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Test Program')).toBeVisible();
  // exact: the machine-name label, not the "keys go to ZX81" status text.
  await expect(page.getByText('ZX81', { exact: true })).toBeVisible();

  // The machine actually painted (more than one flat colour on the canvas).
  await expect.poll(() => canvasPainted(page), { timeout: 30_000 }).toBe(true);
});

test('the Play button restarts the running program', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
  await page.goto(`/load/${SHARE_ID}`);

  const play = page.getByRole('button', { name: '▶ Play' });
  await expect(play).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => canvasPainted(page), { timeout: 30_000 }).toBe(true);

  // Run *is* restart in the player: clicking keeps it running and painting.
  await play.click();
  await expect(play).toBeVisible();
  await expect.poll(() => canvasPainted(page), { timeout: 30_000 }).toBe(true);
});

test('shows an error notice when the share is not found', async ({ page }) => {
  await page.route(
    SHARE_GLOB,
    shareGet({ status: 404, body: { error: 'not_found' } }),
  );
  await page.goto(`/load/${SHARE_ID}`);

  const notice = page.locator('[class*="notice"]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('no shared program');
  // not-found is not retryable: a "See the Code" escape hatch, no Retry.
  await expect(notice.locator('a[href="/"]')).toBeVisible();
  await expect(notice.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('shows the incompatible notice with a canonical link', async ({
  page,
}) => {
  // A Spectrum-only program opened through the ZX81 verb: the machines differ.
  await page.route(
    SHARE_GLOB,
    shareGet({
      body: zx81Record({
        dialectId: 'zxspectrum',
        compatibleDialects: ['zxspectrum'],
      }),
    }),
  );
  await page.goto(`/load/${SHARE_ID}`);

  const notice = page.locator('[class*="notice"]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("can't run");
  // The canonical link points at the program's home machine (zxspectrum → /gosub/).
  await expect(notice.locator(`a[href="/gosub/${SHARE_ID}"]`)).toBeVisible();
});

// The player uses a compact glyph-only rail in phone landscape. Like
// landscape-layout.spec.ts, this builds its own Chromium touch context (the
// matrix projects are all desktop) and runs once.
test.describe('phone landscape', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'builds its own Chromium touch context',
  );

  test('renders the compact player controls', async () => {
    test.setTimeout(120_000);
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    });
    await context.addInitScript((key) => {
      try {
        localStorage.setItem(key, 'true');
      } catch {
        /* opaque origin - nothing to seed */
      }
    }, WELCOME_SEEN_KEY);
    await context.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
    const page = await context.newPage();
    try {
      await page.goto(`http://localhost:5173/load/${SHARE_ID}`);

      const landscapeActive = await page.evaluate(
        (q) => window.matchMedia(q).matches,
        LANDSCAPE_MOBILE_QUERY,
      );
      expect(landscapeActive, 'LANDSCAPE_MOBILE_QUERY should match').toBe(true);

      // The restart control collapses to just the glyph in the landscape rail.
      await expect(
        page.getByRole('button', { name: '▶', exact: true }),
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await browser.close();
    }
  });

  test('never auto-shows the keyboard, even with auto-show enabled', async () => {
    test.setTimeout(120_000);
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    });
    await context.addInitScript(
      ({ welcome, autoShow }) => {
        try {
          localStorage.setItem(welcome, 'true');
          // Explicitly opt into keyboard auto-show: landscape must still suppress
          // it while the emulator is the surface.
          localStorage.setItem(autoShow, 'true');
        } catch {
          /* opaque origin - nothing to seed */
        }
      },
      { welcome: WELCOME_SEEN_KEY, autoShow: KEYBOARD_AUTOSHOW_KEY },
    );
    await context.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
    const page = await context.newPage();
    try {
      await page.goto(`http://localhost:5173/load/${SHARE_ID}`);
      await expect(
        page.getByRole('button', { name: '▶', exact: true }),
      ).toBeVisible({ timeout: 30_000 });

      // The flanking gamepad is the default surface; the keyboard stays hidden.
      await expect(page.locator('.game-controller')).toBeVisible();
      await expect(page.locator('.virtual-keyboard')).toHaveCount(0);

      // The rail ⌨ toggle still brings it up on demand (and hides the gamepad).
      // The button's accessible name is its glyph; the Show/Hide text is a title.
      await page.getByRole('button', { name: '⌨', exact: true }).click();
      await expect(page.locator('.virtual-keyboard')).toBeVisible();
      await expect(page.locator('.game-controller')).toHaveCount(0);
    } finally {
      await browser.close();
    }
  });
});
