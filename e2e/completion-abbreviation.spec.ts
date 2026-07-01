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
