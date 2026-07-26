// Cross-cutting shell spec (no owning capability).
import { test, expect } from '../fixtures';
import { EDITOR, openApp } from '../helpers';

/**
 * Test plan §11 - Responsive layout sweep.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * 11.3/11.4 (phone-landscape rail + keyboard overlay) are covered by
 * e2e/landscape-layout.spec.ts (Chromium touch contexts). Real-device safe
 * areas (11.5) and browser zoom (11.6) are manual.
 */

test('11.1 desktop split view: divider drags and resizes the panes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const workspace = page.locator('[class*="workspace"]').first();
  const divider = page.locator('[class*="divider"]').first();
  await expect(divider).toBeVisible();

  const before = await workspace.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns,
  );
  const box = await divider.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 160, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  const after = await workspace.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns,
  );
  expect(after).not.toBe(before);
});

test('11.2 narrow viewport switches to the tabbed mobile layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await openApp(page);
  // Name the pane switcher: the editor's own content tab strip is a second,
  // always-present tablist.
  await expect(page.getByRole('tablist', { name: 'App panes' })).toBeVisible();
  // Tabs actually switch panes.
  await page.getByRole('tab', { name: 'Run' }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Editor' }).click();
  await expect(page.locator(EDITOR)).toBeVisible();
});

test('11.2 widening back restores the split layout', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await openApp(page);
  await expect(page.getByRole('tablist', { name: 'App panes' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('tablist', { name: 'App panes' })).toBeHidden();
  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
});
