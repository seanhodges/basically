import { test, expect, type Page } from './fixtures';

/**
 * BBC-style keyword abbreviation: while the autocomplete popup is open, typing a
 * period accepts the top suggestion instead of inserting the '.', so "PR."
 * completes to "PRINT". The period is consumed as the abbreviation marker.
 *
 * The popup only truly opens in a real browser (async completion + tooltip), so
 * this behaviour is exercised end-to-end here rather than in a headless unit.
 */

async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

/** Clear the editor to a single empty line so typed text lands verbatim. */
async function clearEditor(page: Page) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
}

test('typing "." accepts the top autocomplete suggestion', async ({ page }) => {
  await open(page);
  await clearEditor(page);

  // Type a keyword prefix; activateOnTyping opens the popup with PRINT on top.
  await page.keyboard.type('PR');
  const popup = page.locator('.cm-tooltip-autocomplete');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('PRINT');

  // The period accepts the top suggestion; it is the abbreviation marker, so it
  // is not itself inserted.
  await page.keyboard.type('.');

  const content = page.locator('.cm-content');
  await expect(content).toContainText('PRINT');
  await expect(content).not.toContainText('.');
  await expect(popup).toBeHidden();
});

test('"." with no popup open inserts a literal period', async ({ page }) => {
  await open(page);
  await clearEditor(page);

  // A bare period on an empty line: no completion is active, so it is inserted.
  await page.keyboard.type('.');
  await expect(page.locator('.cm-content')).toContainText('.');
});

/**
 * The same abbreviation must work from the in-IDE on-screen keyboard, which
 * inserts through `applyEditorAction` (a document dispatch) rather than a DOM
 * keydown — the physical-keyboard path never runs here. A mobile viewport puts
 * the editor tab in charge so the keyboard routes into CodeMirror; the keyboard's
 * pointer handler preventDefaults, so tapping keycaps keeps the editor focused
 * (which the completion popup requires).
 */

/** Locate an on-screen-keyboard keycap by its layout key id. */
function vkKey(page: Page, keyId: string) {
  return page.locator(`.virtual-keyboard [data-keyid="${keyId}"]`);
}

test('on-screen keyboard: "." accepts the top autocomplete suggestion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);

  // Show the keyboard, then focus + clear the editor so it stays the active
  // surface while we tap keycaps.
  await page.getByTitle('Show on-screen keyboard').click();
  await expect(page.locator('.virtual-keyboard')).toBeVisible();
  await clearEditor(page);

  // Tap P then R; activateOnTyping opens the popup with PRINT on top.
  await vkKey(page, 'KeyP').click();
  await vkKey(page, 'KeyR').click();
  const popup = page.locator('.cm-tooltip-autocomplete');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('PRINT');

  // Tap "." — it accepts the suggestion and is consumed, not inserted.
  await vkKey(page, 'Period').click();
  const content = page.locator('.cm-content');
  await expect(content).toContainText('PRINT');
  await expect(content).not.toContainText('.');
  await expect(popup).toBeHidden();
});

test('on-screen keyboard: "." with no popup open inserts a literal period', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);

  await page.getByTitle('Show on-screen keyboard').click();
  await expect(page.locator('.virtual-keyboard')).toBeVisible();
  await clearEditor(page);

  // No completion active, so the keycap falls through to a literal period.
  await vkKey(page, 'Period').click();
  await expect(page.locator('.cm-content')).toContainText('.');
});
