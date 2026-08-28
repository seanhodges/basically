// Cross-cutting shell spec (no owning capability).
import { test, expect } from '../fixtures';
import { openApp, setEditorSource } from '../helpers';

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

  await page.getByRole('button', { name: 'Open documentation' }).click();
  await expect(drawer).toBeVisible();
  // Actual documentation rendered, not an empty shell. The drawer hosts the
  // docs site in an iframe, so reach through it with a frame locator.
  await expect(
    drawer.frameLocator('iframe').locator('h1, h2').first(),
  ).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole('button', { name: 'Close the documentation panel' })
    .click();
  await expect(drawer).toBeHidden();

  await page.keyboard.press('F1');
  await expect(drawer).toBeVisible();
  await page.keyboard.press('F1');
  await expect(drawer).toBeHidden();
});

test('a new context-help topic routes the docs frame without reloading it', async ({
  page,
}) => {
  await openApp(page);
  const drawer = page.getByRole('dialog', { name: 'Documentation' });
  const search = drawer
    .frameLocator('iframe')
    .getByLabel('Search keyword names');

  await setEditorSource(page, '10 PRINT "HI"\n20 PLOT 1,1');

  // Picking a keyword in the editor and taking the Reference row deep links to
  // it (`?q=`).
  await page.locator('.cm-content').getByText('PRINT').first().click();
  await page.getByRole('button', { name: /Look up PRINT/ }).click();
  await expect(drawer).toBeVisible();
  await expect(search).toHaveValue('PRINT', { timeout: 15_000 });

  // Stamp the docs document so a reload is detectable: re-pointing the iframe's
  // `src` (what the drawer used to do for every topic) would wipe this.
  const frame = page.frames().find((f) => f.url().includes('/docs/'));
  expect(frame).toBeTruthy();
  await frame!.evaluate(() => {
    (window as unknown as Record<string, unknown>).__docsFrameStamp = 'kept';
  });

  // A second keyword re-seeds the same page's search box in place, with the
  // drawer left open - the editor stays reachable beside it.
  await page.locator('.cm-content').getByText('PLOT').first().click();
  await page.getByRole('button', { name: /Look up PLOT/ }).click();
  await expect(drawer).toBeVisible();
  await expect(search).toHaveValue('PLOT');

  const stamp = await page
    .frames()
    .find((f) => f.url().includes('/docs/'))!
    .evaluate(
      () => (window as unknown as Record<string, unknown>).__docsFrameStamp,
    );
  expect(stamp).toBe('kept');
});
