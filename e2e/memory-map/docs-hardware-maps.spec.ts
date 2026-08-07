// Capability: memory-map — openspec/specs/memory-map/spec.md
import { test, expect, type Page } from '../fixtures';

/**
 * The memory layouts on a hardware reference page.
 *
 * Three browser-only facts, and nothing else this file needs to prove: the maps
 * are a React island inside a VitePress page, so nothing renders until it
 * mounts; each opens fitted to the box holding it, which is a height measured
 * from the DOM after React has drawn it; and each map's controls reach that map
 * and no other, which is a claim about three live islands on one page rather
 * than about any data. Which regions each machine has, and which machines get a
 * layout at all, are pinned in Vitest
 * (`src/dialects/memoryMap.test.ts`, `src/reference/hardware-memory-map.test.ts`).
 *
 * The Commodore page because it is the only one covering three machines: two
 * would not tell a per-map setting from a per-page one as clearly, and one
 * could not tell them apart at all.
 */

const PAGE = '/docs/reference/commodore/hardware';

const maps = (page: Page) => page.locator('.mm-single');
/** The scrolling column inside a map - the thing the fit is measured against. */
const column = (page: Page, i: number) =>
  maps(page).nth(i).locator('[class*="mapScroll"]');

/** How tall the drawn map is, and how much of it is on screen. */
const measure = (page: Page, i: number) =>
  column(page, i).evaluate((el) => ({
    drawn: Math.round(el.scrollHeight),
    visible: Math.round(el.clientHeight),
  }));

test('each machine’s layout is drawn, fitted, and read on its own', async ({
  page,
}) => {
  await page.goto(PAGE);

  // One per machine section, and each is the island rather than its
  // placeholder: waiting for a band is waiting for React to have mounted.
  await expect(maps(page)).toHaveCount(3, { timeout: 15_000 });
  for (let i = 0; i < 3; i++) {
    await expect(column(page, i).locator('button').first()).toBeVisible();
  }

  // Fitted: the whole 64K opens at the height of its box, so a reader meets the
  // machine entire before deciding what to zoom into. This is the whole reason
  // the height is measured from the DOM instead of being a constant.
  //
  // Approximately, and not by sloppiness: a lone map is drawn non-proportionally
  // (as the IDE's own panel is), so a region too small to read is clamped to a
  // legible height and the bands are gapped. The column therefore overruns its
  // box by whatever those clamps and gaps add, which differs per machine with
  // the number of regions it has. What is being asserted is that the map opens
  // whole rather than at some arbitrary depth into it.
  for (let i = 0; i < 3; i++) {
    const { drawn, visible } = await measure(page, i);
    expect(drawn).toBeLessThan(visible * 1.3);
  }

  // Zooming the C64's layout leaves its neighbours where the reader left them.
  const before = await Promise.all([0, 1, 2].map((i) => measure(page, i)));
  await maps(page).nth(0).getByRole('slider').fill('6');
  await expect
    .poll(async () => (await measure(page, 0)).drawn)
    .toBeGreaterThan(before[0]!.drawn);
  expect((await measure(page, 1)).drawn).toBe(before[1]!.drawn);
  expect((await measure(page, 2)).drawn).toBe(before[2]!.drawn);

  // Notation is per-map too, and each opens in its own machine's - decimal on
  // every Commodore, which is what their manuals and their POKEs use. The
  // VIC-20's map is zoomed in as well first: a band only carries its own
  // addresses once there is room to draw them, so a map left at its fitted zoom
  // has nothing to read the notation off.
  await maps(page).nth(1).getByRole('slider').fill('6');
  const addresses = (i: number) =>
    maps(page).nth(i).locator('[class*="bandAddr"]').first();
  await expect(addresses(0)).not.toContainText('&');
  await expect(addresses(1)).not.toContainText('&');

  await maps(page)
    .nth(0)
    .getByRole('button', { name: 'Hex', exact: true })
    .click();
  await expect(addresses(0)).toContainText('&');
  await expect(addresses(1)).not.toContainText('&');

  // And so is the selection: a region reads out in the map it belongs to, and
  // the others are still asking to be told what to show.
  await maps(page)
    .nth(1)
    .getByRole('button', { name: 'Show region details' })
    .click();
  await expect(maps(page).nth(1)).toContainText('Select a region');
  await column(page, 1).locator('button').first().click();
  await expect(maps(page).nth(1)).toContainText('Range');
  await expect(maps(page).nth(1)).toContainText('PEEK');
  await expect(maps(page).nth(0)).not.toContainText('Range');
});
