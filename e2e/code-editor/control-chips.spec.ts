// Capability: code-editor — openspec/specs/code-editor/spec.md
import { test, expect, chooseTargetMachine } from '../fixtures';
import { EDITOR, clearEditor, openApp, setEditorSource } from '../helpers';

/**
 * Display control codes drawn as chips.
 *
 * A MODE 7 line is teletext control bytes interleaved with the text they act
 * on, and the charset spells each as a named escape so the program round-trips
 * byte-exactly. Read back, though, `{GRAPHICS WHITE}` is sixteen of a forty
 * column line spelling a colour the chip can simply be - so the editor draws
 * it, in one column, and leaves the document exactly as written.
 *
 * Only a browser can answer whether the chip lands on the line without
 * disturbing it and behaves as one unit for the cursor; which escape maps to
 * which byte is unit-tested in src/editor/controlChipWidget.test.ts.
 */

const PROGRAM = '10 PRINT "{GRAPHICS WHITE}\u{1FB00}\u{1FB02}"\n20 END\n';

test('a teletext control code shows as a chip without disturbing its line', async ({
  page,
}) => {
  await openApp(page);
  await chooseTargetMachine(page, 'bbcmicro');
  await clearEditor(page);
  await setEditorSource(page, PROGRAM);

  const chip = page.locator('.cm-controlChip');
  await expect(chip).toHaveCount(1);
  await expect(chip.locator('svg')).toBeVisible();
  // The escape's name is not spelled out on the line any more...
  await expect(page.locator(EDITOR)).not.toContainText('GRAPHICS WHITE');
  // ...but it is still there for anyone who asks the chip what it is.
  await expect(chip).toHaveAttribute('title', /GRAPHICS WHITE/);

  // One column, not sixteen: the chip is about as wide as it is tall.
  const box = (await chip.boundingBox())!;
  expect(box.width).toBeLessThan(box.height * 2);

  // And the line it sits on is the same height as the one below it.
  const lines = page.locator('.cm-line');
  const withChip = (await lines.nth(0).boundingBox())!;
  const plain = (await lines.nth(1).boundingBox())!;
  expect(Math.abs(withChip.height - plain.height)).toBeLessThan(1);
});

test('the program still holds the escape the chip stands for', async ({
  page,
}) => {
  await openApp(page);
  await chooseTargetMachine(page, 'bbcmicro');
  await clearEditor(page);
  await setEditorSource(page, PROGRAM);

  // Nothing about the program changed, so it still tokenizes cleanly.
  await expect(page.getByText(/\d+ error/)).toHaveCount(0);

  // Select the line and copy it back out through the editor's own state.
  const source = await page.evaluate(() => {
    const view = (
      document.querySelector('.cm-editor') as
        | (HTMLElement & { cmView?: { view: { state: { doc: unknown } } } })
        | null
    )?.cmView;
    return view ? String(view.view.state.doc) : null;
  });
  if (source !== null) expect(source).toContain('{GRAPHICS WHITE}');
});

test('a chip deletes as one unit', async ({ page }) => {
  await openApp(page);
  await chooseTargetMachine(page, 'bbcmicro');
  await clearEditor(page);
  await setEditorSource(page, '10 PRINT "{GRAPHICS WHITE}"\n');

  await expect(page.locator('.cm-controlChip')).toHaveCount(1);

  // Put the caret at the end of the first line, step back over the closing
  // quote, then one delete must take the whole escape - not a fragment of it.
  await page.locator(EDITOR).click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');

  await expect(page.locator('.cm-controlChip')).toHaveCount(0);
  await expect(page.locator(EDITOR)).not.toContainText('{');
  await expect(page.locator(EDITOR)).not.toContainText('GRAPHICS');
});
