// Capability: memory-map — openspec/specs/memory-map/spec.md
import { test, expect, chooseTargetMachine, type Page } from '../fixtures';

/**
 * Zooming in must reveal the machine's own subdivisions, and zooming back out
 * must restore exactly the bands the map opened with.
 *
 * These four machines used to describe their whole 64K in five regions, so
 * zooming in showed nothing new. Each `detail` label below exists only as a
 * sub-region: if a map is flattened back to its coarse form the assertion fails.
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

for (const { id, label, coarse, detail } of [
  {
    id: 'zx81',
    label: 'ZX81',
    coarse: 'System variables',
    detail: 'Printer buffer',
  },
  {
    id: 'zx80',
    label: 'ZX80',
    coarse: 'System variables',
    detail: 'Program and display pointers',
  },
  {
    id: 'cpc464',
    label: 'CPC 464',
    coarse: 'System (high)',
    detail: 'Main firmware jumpblock',
  },
  {
    id: 'cpc6128',
    label: 'CPC 6128',
    coarse: 'System (high)',
    detail: 'Main firmware jumpblock',
  },
]) {
  test(`${label} memory map resolves into sub-regions when zoomed in`, async ({
    page,
  }) => {
    await open(page);
    await chooseTargetMachine(page, id);

    await page.locator('button[title^="Memory map"]').click();
    await expect(memoryHost(page)).toBeVisible();

    // Zoomed out: the grouping band is shown, its sub-regions are not.
    await expect(bands(page).filter({ hasText: coarse }).first()).toBeVisible();
    await expect(bands(page).filter({ hasText: detail })).toHaveCount(0);
    const coarseCount = await bands(page).count();

    // Zoomed in: the band opens into the regions it groups.
    await zoomIn(page);
    await expect(bands(page).filter({ hasText: detail }).first()).toBeVisible();
    expect(await bands(page).count()).toBeGreaterThan(coarseCount);

    // Zooming back out is lossless: the same bands, and the detail hidden again.
    await zoomOut(page);
    await expect(bands(page).filter({ hasText: detail })).toHaveCount(0);
    await expect(bands(page)).toHaveCount(coarseCount);
  });
}
