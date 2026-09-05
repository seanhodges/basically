// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect, type Page } from '../fixtures';
import { openApp, selectDialect, setEditorSource } from '../helpers';

/**
 * The memory-layout section: both machines' maps, on one shared address scale.
 *
 * The shared scale is the whole claim the section makes, and it is a claim about
 * pixels - two columns of the same total height, so a position in one is the
 * same address in the other. Nothing but a browser can check that, which is why
 * the arithmetic assertions below live here rather than in a unit test.
 *
 * The pair is chosen through `?from=`/`?to=` rather than the picker (which
 * choose-machine.spec.ts covers) so these stay about the maps. ZX81 → C64 is a
 * good pair for it: 16K of RAM against 64K, a screen at $4000 against one at
 * $0400, and a different number of regions on each side - which is exactly what
 * would misalign two columns that were not drawn to one scale.
 */

const GUIDE = '/docs/reference/compare';
const PAIR = `${GUIDE}?from=zx81&to=commodore64`;

const section = (page: Page) => page.locator('#memory-layout');
const panes = (page: Page) => page.locator('.mm-pane:not([hidden])');
/** The band column inside each visible pane - the thing drawn to scale. */
const columns = (page: Page) =>
  page.locator('.mm-pane:not([hidden]) [class*="mapProportional"]');

async function openPair(page: Page, url = PAIR) {
  await page.goto(url);
  await expect(section(page)).toBeVisible({ timeout: 15_000 });
  await section(page).scrollIntoViewIfNeeded();
  // The maps are a React island; wait for it rather than for a fixed time.
  await expect(panes(page).first().locator('button').first()).toBeVisible();
}

test('both machines are drawn, on one shared address scale', async ({
  page,
}) => {
  await openPair(page);

  await expect(panes(page)).toHaveCount(2);
  await expect(section(page)).toContainText('ZX81');
  await expect(section(page)).toContainText('C64');

  // The claim: same total height, so the same address is at the same place in
  // both. The two machines divide that height into a different number of
  // regions, which is what makes the equality worth asserting.
  const heights = await columns(page).evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().height)),
  );
  expect(heights).toHaveLength(2);
  expect(Math.abs(heights[0]! - heights[1]!)).toBeLessThanOrEqual(1);

  const bandCounts = await panes(page).evaluateAll((els) =>
    els.map((e) => e.querySelectorAll('button').length),
  );
  expect(bandCounts[0]).not.toBe(bandCounts[1]);

  // And the section opens at the zoom that fills its panes: the map is the
  // height of the box holding it rather than a short column with dead space
  // under it. Measured against the scrolling column's own height, which is a
  // matter of layout and so can only be asserted in a browser.
  const fitted = await panes(page)
    .first()
    .locator('[class*="mapScroll"]')
    .evaluate((el) => ({
      column: Math.round(el.firstElementChild!.getBoundingClientRect().height),
      viewport: el.clientHeight,
    }));
  expect(Math.abs(fitted.column - fitted.viewport)).toBeLessThanOrEqual(1);
});

test('one set of controls drives both maps', async ({ page }) => {
  await openPair(page);

  const before = await columns(page).evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().height)),
  );

  // Zooming moves both columns together, and they stay equal to each other -
  // a pane with its own zoom could not be compared with its neighbour.
  await page.getByLabel('Zoom level').fill('6');
  const after = await columns(page).evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().height)),
  );
  expect(after[0]).toBeGreaterThan(before[0]!);
  expect(Math.abs(after[0]! - after[1]!)).toBeLessThanOrEqual(1);

  // And the notation toggle reaches both: at this zoom each band carries its
  // own start-end addresses. Asserted on the address elements rather than the
  // section's text - a band *label* can contain an ampersand of its own
  // ("BASIC program & variables").
  //
  // It opens in the *source* machine's own notation, which for the ZX81 is
  // decimal: the addresses a reader has seen in that machine's documentation
  // are the ones the map should greet them with.
  const addresses = page.locator('.mm-pane:not([hidden]) [class*="bandAddr"]');
  await expect(addresses.first()).toHaveText('0 – 8191');

  await page.getByRole('button', { name: 'Hex', exact: true }).click();
  await expect(addresses.first()).toContainText('&0000');
  // Both panes, not just the one that was clicked.
  const bothPanes = await addresses.evaluateAll((els) =>
    els.map((e) => e.textContent ?? ''),
  );
  expect(bothPanes.every((t) => t.includes('&'))).toBe(true);
});

test('a region reads out when it is selected', async ({ page }) => {
  await openPair(page);

  await page.getByRole('button', { name: 'Show region details' }).click();
  // Before anything is picked, the detail says what to do rather than nothing -
  // and lets the click through to the bands it is sitting on top of, which are
  // the only thing that can answer it.
  await expect(section(page)).toContainText('Select a region');

  await panes(page).first().locator('button').first().click();
  await expect(section(page)).toContainText('Range');
  await expect(section(page)).toContainText('Size');
});

test('a machine with no described layout reports no layouts at all', async ({
  page,
}) => {
  // The TRS-80's memory layout is not described, so the section is absent for
  // any pair involving it - rather than shown with one side empty, which would
  // invite a reader to conclude something about a machine the IDE cannot
  // describe.
  await page.goto(`${GUIDE}?from=trs80&to=commodore64`);
  await expect(page.locator('.cmp-facts')).toBeVisible({ timeout: 15_000 });

  await expect(section(page)).toHaveCount(0);
  await expect(page.locator('.cmp-jump')).not.toContainText('Memory layout');
});

test('the addresses are read off the maps, not repeated as table rows', async ({
  page,
}) => {
  // The screen base and the program start used to be the last two rows of the
  // fact table. The maps draw them in place and to scale, so reporting them as
  // rows as well would give one difference twice.
  await openPair(page);
  await page.getByLabel('Show unchanged rows').check();

  const labels = page.locator('.cmp-facts tbody th');
  await expect(labels.filter({ hasText: 'Screen base' })).toHaveCount(0);
  await expect(labels.filter({ hasText: 'Program start' })).toHaveCount(0);
  await expect(labels.last()).toHaveText('Address notation');
});

test.describe('where there is no room for both', () => {
  test.use({ viewport: { width: 560, height: 900 } });

  test('the maps become tabs that hold their place', async ({ page }) => {
    await openPair(page);

    // Named for the machines, source first and shown first: which machine you
    // are looking at is the whole question a tab has to answer.
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText('ZX81');
    await expect(tabs.nth(1)).toHaveText('C64');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(panes(page)).toHaveCount(1);

    // Zoom in and scroll somewhere specific, then flip. Landing on the same
    // addresses is what makes this a comparison rather than two pictures.
    await page.getByLabel('Zoom level').fill('6');
    const scroller = panes(page).locator('[class*="mapScroll"]').first();
    await scroller.evaluate((el) => {
      el.scrollTop = 900;
    });

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Zoom level')).toHaveValue('6');
    await expect
      .poll(() =>
        panes(page)
          .locator('[class*="mapScroll"]')
          .first()
          .evaluate((el) => Math.round(el.scrollTop)),
      )
      .toBe(900);
  });

  test('the tabs are reachable by keyboard', async ({ page }) => {
    await openPair(page);

    const tabs = page.getByRole('tab');
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');

    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toBeFocused();
  });
});

test.describe('narrowed to the open program', () => {
  /**
   * A Commodore program whose accesses land somewhere quite different on a
   * ZX81: $0400 is the C64's screen and the ZX81's ROM, and $DC00 is the C64's
   * keyboard port where the ZX81 mirrors its own RAM.
   *
   * The `{clr}{white}` control codes are what make it a program the ZX81 cannot
   * run, so switching machine raises the "keep my code" confirmation - which is
   * the moment a port begins and the comparison is offered. Plain POKEs would
   * not: the ZX81 has POKE too, and the switch would go through silently.
   */
  const PROGRAM = [
    '10 PRINT "{clr}{white}HI"',
    '20 POKE 53280,0',
    '30 POKE 1024,81',
    '40 IF PEEK(56320)=0 THEN GOTO 40',
  ].join('\n');

  test('the program’s accesses are marked on both machines', async ({
    page,
  }) => {
    await openApp(page);
    await selectDialect(page, 'commodore64');
    await setEditorSource(page, PROGRAM);
    await selectDialect(page, 'zx81', 'keep my code');

    const drawer = page.getByRole('dialog', { name: 'Documentation' });
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    const frame = page.frameLocator('iframe[title="Documentation"]');

    const layout = frame.locator('#memory-layout');
    await expect(layout).toBeVisible({ timeout: 15_000 });

    // The comparison opens from the machine the program is written for, so the
    // writes are the C64's - marked on the C64's map where the program put them
    // and on the ZX81's where they would land.
    const marked = frame.locator(
      '.mm-pane:not([hidden]) [class*="pokeMarker"]',
    );
    await expect(marked.first()).toBeVisible();
    expect(await marked.count()).toBeGreaterThanOrEqual(2);
    await expect(layout).toContainText('writes to');

    // And the conclusion the marks leave to the eye is stated: $0400 is the
    // C64's screen and the ZX81's ROM, so that POKE does nothing at all there.
    // Read here rather than in a unit test because it is the whole point of
    // the section for a reader meeting the maps one narrow tab at a time -
    // the verdicts have to reach them without the picture.
    const landings = layout.locator('.cmp-landings').first();
    await expect(landings).toContainText('Where these writes land');
    await expect(landings).toContainText('1024');
    await expect(landings).toContainText('Screen memory on C64');
    await expect(landings).toContainText('read-only');

    // The reads reach the reader by the same route and are marked in their own
    // colour, so the two are told apart on the picture as well as in the list.
    const read = frame.locator('.mm-pane:not([hidden]) [class*="readMarker"]');
    await expect(read.first()).toBeVisible();
    const reads = layout.locator('.cmp-landings').nth(1);
    await expect(reads).toContainText('Where these reads land');
    await expect(reads).toContainText('56320');
    await expect(reads).toContainText('CIA 1 on C64');
  });
});
