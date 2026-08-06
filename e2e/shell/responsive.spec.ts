// Cross-cutting shell spec (no owning capability).
import { test, expect } from '../fixtures';
import { EDITOR, openApp } from '../helpers';

/**
 * Responsive layout sweep.
 *
 * The phone-landscape rail + keyboard overlay are covered by
 * e2e/shell/landscape-layout.spec.ts (Chromium touch contexts). Real-device
 * safe areas and browser zoom are manual.
 */

test('desktop split view: divider drags and resizes the panes', async ({
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

test('narrowing switches to the tabbed layout, and widening restores the split', async ({
  page,
}) => {
  // One app, taken across the breakpoint and back: the second half was booting
  // a second app only to arrive at the state the first half already reached.
  await page.setViewportSize({ width: 700, height: 1000 });
  await openApp(page);
  // Name the pane switcher: the editor's own content tab strip is a second,
  // always-present tablist.
  const panes = page.getByRole('tablist', { name: 'App panes' });
  await expect(panes).toBeVisible();
  // Tabs actually switch panes.
  await page.getByRole('tab', { name: 'Run' }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Editor' }).click();
  await expect(page.locator(EDITOR)).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(panes).toBeHidden();
  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
});
