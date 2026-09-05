// Capability: sharing-player — openspec/specs/sharing-player/spec.md
import { test, expect } from '../fixtures';
import { canvasPainted } from '../helpers';
import { SHARE_ID, SHARE_GLOB, shareGet, zx81Record } from '../shareStub';

/**
 * Standalone player (src/player/PlayerApp.tsx).
 *
 * The player fetches its shared program from the share API; every case here
 * stubs that GET with `page.route` (the suite's first use of network
 * interception - `route.fulfill` bypasses CORS) so the tests are deterministic
 * and need no backend. A ZX81 record is used throughout because it is the
 * lightest emulator and its verb is `/load/`.
 */

const LANDSCAPE_MOBILE_QUERY =
  '(orientation: landscape) and (max-height: 600px) and (pointer: coarse)';
const KEYBOARD_AUTOSHOW_KEY = 'mbide.keyboardAutoShow';

test('boots a shared program, auto-runs, restarts and exports', async ({
  page,
}) => {
  // One boot for the whole running player. Booting the ROM and reaching the
  // first painted frame is what this file pays for; restart and the export
  // dialog are things done to a player that is already up, so they are staged
  // onto this one rather than each buying a machine of their own.
  test.setTimeout(90_000); // ROM boot + first frames can be slow in CI
  await page.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
  await page.goto(`/load/${SHARE_ID}`);

  // Reaching the running phase surfaces the restart Play button and the
  // program/machine labels in the top bar.
  const play = page.getByRole('button', { name: '▶ Play' });
  await expect(play).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Test Program')).toBeVisible();
  // exact: the machine-name label, not the "keys go to ZX81" status text.
  await expect(page.getByText('ZX81', { exact: true })).toBeVisible();

  // The machine actually painted (more than one flat colour on the canvas).
  await expect.poll(() => canvasPainted(page), { timeout: 30_000 }).toBe(true);

  // Run *is* restart in the player: clicking keeps it running and painting.
  await play.click();
  await expect(play).toBeVisible();
  await expect.poll(() => canvasPainted(page), { timeout: 30_000 }).toBe(true);

  // The floppy-disk button next to Play opens the same TransferDialog the IDE
  // uses, offering the active dialect's file/cassette/serial exports.
  await page.getByRole('button', { name: 'Export to real hardware' }).click();
  const dialog = page.getByRole('heading', { name: 'Run on real hardware' });
  await expect(dialog).toBeVisible();
  // ZX81 has cassette audio, so the tape controls are offered.
  await expect(
    page.getByRole('button', { name: '▶ Play through speakers' }),
  ).toBeVisible();

  // Closing dismisses it.
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);

  // The player offers the same screenshot action as the IDE toolbar, on the
  // same running-phase terms. It is the same handler, whose download round trip
  // e2e/program-execution/emulator-boot.spec.ts already proves, so being there
  // is all this needs to check.
  await expect(
    page.getByRole('button', { name: 'Save a screenshot' }),
  ).toBeVisible();
});

test('boots a shared program that carries a memory block', async ({ page }) => {
  test.setTimeout(90_000); // one ZX81 ROM boot, same budget as the journey above
  // A ZX81 record with a v2 blocks payload: the block is decoded by
  // fetchSharedProgram, installed by playerBoot, and written into RAM on the
  // auto-run. The program itself just paints and holds, so this asserts the
  // block payload flows end-to-end without breaking the boot/run.
  await page.route(
    SHARE_GLOB,
    shareGet({
      body: zx81Record({
        blocks: [
          {
            id: 'b1',
            name: 'code',
            address: 28672, // 0x7000, inside the ZX81 valid block range
            bytes: 'AQID', // base64 for [1, 2, 3]
            kind: 'code',
          },
        ],
      }),
    }),
  );
  await page.goto(`/load/${SHARE_ID}`);

  await expect(page.getByRole('button', { name: '▶ Play' })).toBeVisible({
    timeout: 30_000,
  });
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

// The player uses a compact glyph-only rail in phone landscape. The matrix
// projects are all desktop, so this describe overrides the context options to a
// short, wide, touch viewport rather than driving a browser of its own -
// `isMobile` is Chromium-only, hence the skip.
test.describe('phone landscape', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'isMobile is a Chromium-only context option',
  );

  test('renders the compact rail and never auto-shows the keyboard', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Explicitly opt into keyboard auto-show: landscape must still suppress it
    // while the emulator is the surface. (The welcome flag is already seeded by
    // the shared fixture.) The opted-in run is the strictly harder one, so the
    // compact rail is checked on it rather than on a boot of its own.
    await page.addInitScript((key) => {
      try {
        localStorage.setItem(key, 'true');
      } catch {
        /* opaque origin - nothing to seed */
      }
    }, KEYBOARD_AUTOSHOW_KEY);
    await page.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
    await page.goto(`/load/${SHARE_ID}`);

    const landscapeActive = await page.evaluate(
      (q) => window.matchMedia(q).matches,
      LANDSCAPE_MOBILE_QUERY,
    );
    expect(landscapeActive, 'LANDSCAPE_MOBILE_QUERY should match').toBe(true);

    // The restart control collapses to just the glyph in the landscape rail,
    // where its accessible name is all that still says what it does.
    await expect(
      page.getByRole('button', { name: 'Restart the program', exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    // Even with auto-show opted in, the landscape emulator surface never
    // pops the keyboard, and the opt-in gamepad starts hidden too (see
    // resolveInputOverlays: overlays only show on explicit intent here).
    await expect(page.getByTestId('input-overlay-toggle')).toBeVisible();
    await expect(page.locator('.virtual-keyboard')).toHaveCount(0);
    await expect(page.locator('.game-controller')).toHaveCount(0);

    // The rail input-overlay button cycles off → keyboard → gamepad.
    await page.getByTestId('input-overlay-toggle').click();
    await expect(page.locator('.virtual-keyboard')).toBeVisible();
    await expect(page.locator('.game-controller')).toHaveCount(0);

    await page.getByTestId('input-overlay-toggle').click();
    await expect(page.locator('.game-controller')).toBeVisible();
    await expect(page.locator('.virtual-keyboard')).toHaveCount(0);
  });
});
