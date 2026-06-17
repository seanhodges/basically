import { test, expect, type Page } from '@playwright/test';

/**
 * Visual / behavioural checks for the Edit ▸ Outline… navigation feature:
 *
 *  1. "Outline…" sits directly below "Find/Replace" in the Edit menu, so the
 *     navigation actions are grouped together.
 *  2. Jumping to an outline entry scrolls the editor so the target BASIC line
 *     lands at the *top* of the editor viewport (not merely scrolled barely
 *     into view at the bottom edge).
 *
 * These also double as a smoke harness for future manual inspections — run
 * with `npm run e2e:headed` to watch, or open the screenshots written below.
 */

/** Accept the "Discard unsaved changes?" confirm so doc swaps go through. */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

/** Load the multi-screen "Maze" sample via File ▸ Samples. */
async function loadMazeSample(page: Page) {
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: 'Maze' }).click();
  await expect(page.locator('.cm-content')).toContainText('480 RUN');
}

/**
 * Replace the editor contents with `source` by selecting all and inserting the
 * text in one go (CodeMirror's auto line-numbering only fires on real Enter
 * keystrokes, so an inserted multi-line block lands verbatim).
 */
async function setEditorSource(page: Page, source: string) {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

test('Outline sits directly below Find/Replace in the Edit menu', async ({
  page,
}) => {
  await open(page);
  await loadMazeSample(page);
  await page.getByRole('button', { name: 'Edit ▾' }).click();
  await expect(page.getByRole('button', { name: 'Outline…' })).toBeVisible();

  // Read the visible menu buttons in DOM order and assert adjacency directly.
  const allLabels = await page.getByRole('button').allInnerTexts();
  const findIdx = allLabels.indexOf('Find/Replace');
  const outlineIdx = allLabels.indexOf('Outline…');
  expect(findIdx).toBeGreaterThanOrEqual(0);
  expect(outlineIdx).toBe(findIdx + 1);

  await page.screenshot({ path: 'e2e/__screenshots__/edit-menu.png' });
});

test('jumping to an outline entry scrolls the target line to the top', async ({
  page,
}) => {
  await open(page);

  // A program tall enough that a mid-document line has a full viewport of lines
  // below it — so a correct "scroll to top" can actually park line 300 at the
  // very top (not be capped by the document end, as a short program would be).
  const lines: string[] = [];
  for (let n = 10; n <= 800; n += 10) {
    if (n === 300) lines.push('300 PRINT "TARGET LINE"');
    else if (n === 800) lines.push('800 GOTO 300');
    else lines.push(`${n} PRINT ${n}`);
  }
  await setEditorSource(page, lines.join('\n'));
  await expect(page.locator('.cm-content')).toContainText('800 GOTO 300');

  await page.getByRole('button', { name: 'Edit ▾' }).click();
  await page.getByRole('button', { name: 'Outline…' }).click();

  const dialog = page.getByRole('heading', { name: 'Program outline' });
  await expect(dialog).toBeVisible();
  // Click the GOTO target for line 300 (its line-number badge is exactly "300").
  await page
    .getByRole('button')
    .filter({ has: page.getByText('300', { exact: true }) })
    .first()
    .click();

  // After the jump the dialog closes and the editor is scrolled.
  await expect(dialog).toBeHidden();

  const scroller = page.locator('.cm-scroller');
  const targetLine = page.locator('.cm-line', { hasText: '300 PRINT "TARGET' });
  await expect(targetLine).toBeVisible();

  const scrollerBox = await scroller.boundingBox();
  const lineBox = await targetLine.boundingBox();
  expect(scrollerBox).not.toBeNull();
  expect(lineBox).not.toBeNull();

  // The target line's top should be within ~1.5 line-heights of the scroller's
  // top edge — i.e. parked at the top, not floating in the middle/bottom.
  const offsetFromTop = lineBox!.y - scrollerBox!.y;
  expect(offsetFromTop).toBeGreaterThanOrEqual(0);
  expect(offsetFromTop).toBeLessThan(36);

  await page.screenshot({ path: 'e2e/__screenshots__/outline-jump.png' });
});
