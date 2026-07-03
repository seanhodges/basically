import { test, expect } from '../fixtures';
import { openApp } from './helpers';

/**
 * Test plan §12 — Documentation.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * The standalone docs site (12.1, 12.3) builds and serves separately
 * (`npm run docs:dev`) — outside this suite's web server, so manual. The
 * in-app drawer (12.2) is automated here.
 */

test('12.2 docs drawer opens from the toolbar and F1, with content', async ({
  page,
}) => {
  await openApp(page);
  const drawer = page.getByRole('dialog', { name: 'Documentation' });

  await page.getByRole('button', { name: /^Documentation/ }).click();
  await expect(drawer).toBeVisible();
  // Actual documentation rendered, not an empty shell.
  await expect(drawer.locator('h1, h2').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close documentation' }).click();
  await expect(drawer).toBeHidden();

  await page.keyboard.press('F1');
  await expect(drawer).toBeVisible();
  await page.keyboard.press('F1');
  await expect(drawer).toBeHidden();
});
