// Capability: control-labelling — openspec/specs/control-labelling/spec.md
import { test, expect, type Page } from '../fixtures';

/**
 * What a control tells the user about itself, on the surfaces where the label
 * is all there is: an icon-only button in the toolbar, and the memory map's
 * glyph controls.
 *
 * Browser-only, and the reason is the whole point of the test: the accessible
 * name is *computed* - from aria-label, else the content, else the title, with
 * the glyph and the aria-hidden spans folded in by the same rules a screen
 * reader follows. Nothing but a real browser computes it, so a unit test can
 * assert the attributes are present and still not know what is announced.
 * The wording itself is guarded by lint (eslint-rules/no-vague-ui-labels.js).
 *
 * One cold load, one machine, staged assertions: the toolbar first, then the
 * memory map opened over the same page.
 */

/** The toolbar's icon-only controls, by the name each must announce. */
const TOOLBAR_CONTROLS = [
  'Save a screenshot',
  'Show the memory map',
  'Show the AI assistant',
  'Open settings',
  'Open documentation',
];

/** The memory map's glyph controls, which carry no text of their own. */
const MEMORY_MAP_CONTROLS = ['Close memory map', 'Zoom out', 'Zoom in'];

const toolbar = (page: Page) => page.locator('[class*="toolbarRight"]');

test('every icon-only control announces what it does', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();

  // The ZX81 is the default target and defines a memory map, so the toolbar
  // carries the full set of icon buttons on a cold load.
  for (const name of TOOLBAR_CONTROLS) {
    await expect(
      toolbar(page).getByRole('button', { name, exact: true }),
      `the toolbar control named "${name}"`,
    ).toBeVisible();
  }

  // Icon-only means the name comes from aria-label, never from the glyph: a
  // control whose label went missing would announce "▶" or nothing at all.
  const unnamed = await toolbar(page)
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons
        .filter((b) => (b.textContent ?? '').trim() === '')
        .filter((b) => !(b.getAttribute('aria-label') ?? '').trim())
        .map((b) => b.outerHTML.slice(0, 120)),
    );
  expect(unnamed, 'icon-only toolbar buttons with no accessible name').toEqual(
    [],
  );

  await toolbar(page)
    .getByRole('button', { name: 'Show the memory map', exact: true })
    .click();
  await expect(page.locator('[class*="memoryHost"]')).toBeVisible();

  for (const name of MEMORY_MAP_CONTROLS) {
    await expect(
      page.getByRole('button', { name, exact: true }),
      `the memory-map control named "${name}"`,
    ).toBeVisible();
  }

  // The slider is one control, so the tooltip a mouse user reads and the name
  // a screen reader announces have to be the same thing.
  const zoom = page.getByRole('slider', { name: 'Zoom level' });
  await expect(zoom).toHaveAttribute('title', 'Zoom level');
});
