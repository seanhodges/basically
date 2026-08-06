// Capability: memory-map — openspec/specs/memory-map/spec.md
import { test, expect, chooseTargetMachine, type Page } from '../fixtures';

/**
 * Zooming in must reveal the machine's own subdivisions, and zooming back out
 * must restore exactly the bands the map opened with.
 *
 * One machine, because what a browser adds here is the zoom control itself: the
 * slider driving a re-layout, the band column rebuilding at the new level, and
 * the anchoring that puts the same address back under the middle of the view.
 * *Which* sub-regions each machine resolves into is a property of its map, and
 * `src/dialects/memoryMapDetail.test.ts` asserts that for the ZX80 and both
 * CPCs alongside the ZX81 below - four machines' worth of table, without four
 * app boots.
 *
 * The ZX81 for the same reason the unit test names it: "Printer buffer" exists
 * only as a sub-region of "System variables", so a map flattened back to its
 * coarse form fails here.
 */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

const memoryHost = (page: Page) => page.locator('[class*="memoryHost"]');
const bands = (page: Page) => page.locator('[class*="band"]');

/** Drag the zoom slider to the far end, well past the detail threshold. */
async function zoomIn(page: Page) {
  await page.getByLabel('Zoom level').fill('24');
}

async function zoomOut(page: Page) {
  await page.getByLabel('Zoom level').fill('1');
}

const COARSE = 'System variables';
const DETAIL = 'Printer buffer';

test('ZX81 memory map resolves into sub-regions when zoomed in', async ({
  page,
}) => {
  await open(page);
  await chooseTargetMachine(page, 'zx81');

  await page.locator('button[title^="Memory map"]').click();
  await expect(memoryHost(page)).toBeVisible();

  // Zoomed out: the grouping band is shown, its sub-regions are not.
  await expect(bands(page).filter({ hasText: COARSE }).first()).toBeVisible();
  await expect(bands(page).filter({ hasText: DETAIL })).toHaveCount(0);
  const coarseCount = await bands(page).count();

  // Zoomed in: the band opens into the regions it groups.
  await zoomIn(page);
  await expect(bands(page).filter({ hasText: DETAIL }).first()).toBeVisible();
  expect(await bands(page).count()).toBeGreaterThan(coarseCount);

  // Zooming back out is lossless: the same bands, and the detail hidden again.
  await zoomOut(page);
  await expect(bands(page).filter({ hasText: DETAIL })).toHaveCount(0);
  await expect(bands(page)).toHaveCount(coarseCount);
});
