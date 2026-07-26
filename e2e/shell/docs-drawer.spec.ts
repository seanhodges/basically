// Cross-cutting shell spec (no owning capability).
import { test, expect } from '../fixtures';
import { openApp } from '../helpers';

/**
 * Documentation.
 *
 * The standalone docs site builds and serves separately
 * (`npm run docs:dev`) - outside this suite's web server, so manual. The
 * in-app drawer is automated here.
 */

test('docs drawer opens from the toolbar and F1, with content', async ({
  page,
}) => {
  await openApp(page);
  const drawer = page.getByRole('dialog', { name: 'Documentation' });

  await page.getByRole('button', { name: /^Documentation/ }).click();
  await expect(drawer).toBeVisible();
  // Actual documentation rendered, not an empty shell. The drawer hosts the
  // docs site in an iframe, so reach through it with a frame locator.
  await expect(
    drawer.frameLocator('iframe').locator('h1, h2').first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Close documentation' }).click();
  await expect(drawer).toBeHidden();

  await page.keyboard.press('F1');
  await expect(drawer).toBeVisible();
  await page.keyboard.press('F1');
  await expect(drawer).toBeHidden();
});
