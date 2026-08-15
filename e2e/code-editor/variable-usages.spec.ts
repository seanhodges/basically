// Capability: code-editor — openspec/specs/code-editor/spec.md
import { test, expect, type Page } from '../fixtures';

/**
 * One journey for the click-to-see-usages feature. Which occurrences count is
 * settled by unit tests (`src/editor/variableUsages.test.ts`), including every
 * machine's own rules; what only a browser can prove is here, and it is why
 * this test exists at all:
 *
 *  - a real pointer press lands on the name and the menu positions itself under
 *    it (posAtCoords and CodeMirror's placement against laid-out text);
 *  - the marks actually paint over the right glyphs;
 *  - stepping moves the caret and brings the usage into view;
 *  - dismissing takes the marks away again;
 *  - find/replace and the usages bar compete for one real panel slot at the foot
 *    of the editor, and only one of them ever holds it;
 *  - the menu offers the row the picked token can answer - Usages on a name,
 *    Reference on a keyword - which needs a real pointer landing on real glyphs.
 *
 * The default machine is the first registered one, so this runs on whatever
 * that is - the program uses a multi-letter numeric name and plain PRINT, which
 * every dialect reads the same way.
 */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

async function setEditorSource(page: Page, source: string) {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

test('clicking a variable offers its usages, which highlight and step', async ({
  page,
}) => {
  await open(page);

  // SUM is used four times: twice on line 20. The mentions inside the string
  // and the comment are not usages, and the tally below is what proves it.
  await setEditorSource(
    page,
    [
      '10 LET SUM=0',
      '20 LET SUM=SUM+1',
      '30 PRINT SUM',
      '40 PRINT "SUM"',
      '50 REM SUM AGAIN',
    ].join('\n'),
  );
  await expect(page.locator('.cm-content')).toContainText('50 REM SUM AGAIN');

  // Click the name on line 10. Clicking the glyphs themselves (not a computed
  // offset) is the part a unit test cannot stand in for.
  const firstUse = page
    .locator('.cm-line')
    .filter({ hasText: '10 LET SUM=0' })
    .getByText('SUM', { exact: true });
  await firstUse.click();

  const offer = page.getByRole('button', { name: /Show where SUM is used/ });
  await expect(offer).toBeVisible();

  // The menu opens below the name, where a completion would appear. Only a real
  // layout can settle this; the 1px slack absorbs sub-pixel line-box rounding.
  const nameBox = (await firstUse.boundingBox())!;
  const menuBox = (await page.locator('.cm-clickMenu').boundingBox())!;
  expect(menuBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);

  await offer.click();

  // Four marks, and the panel agrees - so neither the string nor the comment
  // was counted.
  const marks = page.locator('.cm-variableUsage');
  await expect(marks).toHaveCount(4);
  const panel = page.locator('.cm-variableUsagesPanel');
  await expect(panel).toContainText('SUM · 4 usages (1/4)');

  // Every mark covers the name itself, not the text around it.
  expect(await marks.allInnerTexts()).toEqual(['SUM', 'SUM', 'SUM', 'SUM']);

  // Stepping moves the caret to the next usage and updates the count.
  await page.getByRole('button', { name: 'Next usage' }).click();
  await expect(panel).toContainText('(2/4)');
  await expect(page.locator('.cm-variableUsage-current')).toHaveCount(1);

  // Wrapping backwards from the second usage lands on the first again.
  await page.getByRole('button', { name: 'Previous usage' }).click();
  await expect(panel).toContainText('(1/4)');

  // Dismissing clears the marks and the bar.
  await page.getByRole('button', { name: 'Close usages' }).click();
  await expect(marks).toHaveCount(0);
  await expect(panel).toBeHidden();

  // One bar at the foot of the editor: opening find/replace takes the usages
  // away. Two CodeMirror panels really competing for the one bottom slot is the
  // browser-only half; Mod-f through searchKeymap is the path users take.
  await firstUse.click();
  await offer.click();
  await expect(marks).toHaveCount(4);
  const search = page.locator('.cm-search');
  await page.keyboard.press('ControlOrMeta+f');
  await expect(search).toBeVisible();
  await expect(marks).toHaveCount(0);
  await expect(panel).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();

  // Editing drops a fresh set of marks, since the offsets they hold go stale.
  await firstUse.click();
  await page.getByRole('button', { name: /Show where SUM is used/ }).click();
  await expect(marks).toHaveCount(4);
  await page.keyboard.type(' ');
  await expect(marks).toHaveCount(0);

  // Which row the menu offers follows what the pointer landed on. Asserted here
  // rather than in its own spec because the program is already typed and the
  // editor already warm; opening the documentation from the row is the docs
  // drawer's spec, which pays for the iframe.
  //
  // Line 30, not line 10: the keystroke above landed in line 10 and changed it.
  const reference = page.getByRole('button', { name: /Look up PRINT/ });
  const usages = page.getByRole('button', { name: /Show where .* is used/ });
  const printLine = page.locator('.cm-line').filter({ hasText: 'PRINT SUM' });

  await printLine.getByText('PRINT', { exact: true }).click();
  await expect(reference).toBeVisible();
  await expect(usages).toBeHidden();

  await printLine.getByText('SUM', { exact: true }).click();
  await expect(usages).toBeVisible();
  await expect(reference).toBeHidden();

  // Escape closes the menu without also dismissing anything behind the editor.
  await page.keyboard.press('Escape');
  await expect(usages).toBeHidden();
  await expect(page.locator('.cm-content')).toBeVisible();
});
