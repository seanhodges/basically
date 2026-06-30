import { expect, chromium } from '@playwright/test';
import { test } from './fixtures';

/**
 * Phone-landscape layout (a short, wide, touch viewport — `LANDSCAPE_MOBILE_QUERY`
 * in src/app/useMediaQuery.ts). Two regressions are guarded here:
 *
 *  1. The toolbar collapses to a 56px left rail and must stay that width — in the
 *     flex-row shell the workspace's intrinsic min-content once squeezed the rail
 *     to 0 (no `flex-shrink: 0` on the rail / no `min-width: 0` on the workspace).
 *  2. The on-screen keyboard must sit centred in the workspace (gutters either
 *     side), not stretched flush against the rail — the centring rule used to be
 *     keyed on `min-width: 769px`, which a sideways phone can fall either side of.
 *
 * A landscape touch context is built per-case (the default project is desktop, no
 * touch) at widths above and below the old 769px breakpoint.
 */
const WELCOME_SEEN_KEY = 'mbide.hasSeenWelcome';

const LANDSCAPE_QUERY =
  '(orientation: landscape) and (max-height: 600px) and (pointer: coarse)';

for (const vp of [
  { name: 'wide (844x390)', width: 844, height: 390 },
  { name: 'narrow (740x360)', width: 740, height: 360 },
]) {
  test(`phone landscape: left rail + centred keyboard — ${vp.name}`, async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true,
      isMobile: true,
    });
    await context.addInitScript((key) => {
      try {
        localStorage.setItem(key, 'true');
      } catch {
        /* opaque origin — nothing to seed */
      }
    }, WELCOME_SEEN_KEY);
    const page = await context.newPage();
    try {
      await page.goto('http://localhost:5173');

      // The landscape-mobile layout must be active for this viewport.
      const landscapeActive = await page.evaluate(
        (q) => window.matchMedia(q).matches,
        LANDSCAPE_QUERY,
      );
      expect(landscapeActive, 'LANDSCAPE_MOBILE_QUERY should match').toBe(true);

      // (1) The left rail is visible at its 56px width and runs the full height —
      // not collapsed to ~0 by the workspace beside it.
      const rail = page.locator('[class*="toolbar"]').first();
      const railBox = await rail.boundingBox();
      expect(railBox, 'rail should have a layout box').not.toBeNull();
      expect(railBox!.width).toBeGreaterThan(40);
      expect(railBox!.width).toBeLessThan(80);
      expect(railBox!.height).toBeGreaterThan(vp.height * 0.8);

      // (2) Open the on-screen keyboard from the Run tab and check it is centred
      // in the workspace rather than stretched flush against the rail.
      await page.getByRole('tab', { name: 'Run' }).click();
      await page.locator('button[title="Show on-screen keyboard"]').click();

      const kb = page.locator('.virtual-keyboard.vk-landscape');
      await expect(kb).toBeVisible();
      const kbBox = await kb.boundingBox();
      const ws = page.locator('[class*="workspace"]').first();
      const wsBox = await ws.boundingBox();
      expect(kbBox).not.toBeNull();
      expect(wsBox).not.toBeNull();
      const kbCenter = kbBox!.x + kbBox!.width / 2;
      const wsCenter = wsBox!.x + wsBox!.width / 2;
      expect(Math.abs(kbCenter - wsCenter)).toBeLessThan(48);
      // The keyboard hugs its aspect-correct content, leaving gutters — so it is
      // clearly narrower than the workspace, not full-bleed.
      expect(kbBox!.width).toBeLessThan(wsBox!.width - 48);

      // Key caps are a usable touch size (the row-of-keys width is what matters;
      // height is bounded by the short landscape band).
      const keyBox = await kb.locator('.vk-key').first().boundingBox();
      expect(keyBox).not.toBeNull();
      expect(keyBox!.width).toBeGreaterThanOrEqual(34);
    } finally {
      await browser.close();
    }
  });
}
