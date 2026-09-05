// Capability: memory-blocks — openspec/specs/memory-blocks/spec.md
import { test, expect, type Page } from '../fixtures';
import { addMemoryBlock } from '../helpers';

/**
 * ZX80/ZX81 listing-backed memory blocks: a block IS a hidden-machine-code
 * `#BIN` REM record inside the BASIC listing (carried in the monolithic
 * `.P`/`.O` image), surfaced in the editor as both a block tab and an inline
 * chip on the BASIC tab. This checks the round trip between the two surfaces:
 *
 *  1. On a ZX81 document the tab strip is present (it is `memoryBlocks`-capable).
 *  2. "New assembly block" appends a `#BIN` REM record: a `bin1` tab opens on the return
 *     stub, and the BASIC tab now shows a binary-line chip for it.
 *  3. Editing the block's assembly rewrites that chip (its byte count grows).
 *  4. A block switched to `data` opens the byte editor, and editing a byte
 *     there rewrites the same listing record - the commit path a fixed-address
 *     block does not take.
 */

async function openZx81(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mbide.dialectId', 'zx81');
    localStorage.setItem('mbide.autosave.doc', '10 PRINT "HI"');
    localStorage.setItem('mbide.autosave.name', 'listing.bas');
  });
  await page.goto('/');
  await expect(page.locator('.cm-content').first()).toBeVisible();
}

const asmContent = (page: Page) =>
  page.locator('.cm-editor').last().locator('.cm-content');

test('a new block is a #BIN REM chip on the BASIC tab', async ({ page }) => {
  await openZx81(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC']);

  // Create a block: it appends a hidden-code REM to the program.
  await addMemoryBlock(page);
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', 'bin1']);
  await expect(page.getByRole('tab', { name: 'bin1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // The block opens on the assembled return stub.
  await expect(asmContent(page)).toContainText('RET');

  // Switch to the BASIC tab: the block shows as an inline binary-line chip.
  // The chip reports the whole REM record's size - the 1-byte RET stub plus the
  // line-number, length, REM-token and terminator bytes = 7 bytes.
  await page.getByRole('tab', { name: 'BASIC' }).click();
  const chip = page.locator('.cm-binaryLineChip');
  await expect(chip).toHaveCount(1);
  await expect(chip).toContainText('7 bytes');
});

test('editing the block assembly rewrites its #BIN chip', async ({ page }) => {
  await openZx81(page);
  await addMemoryBlock(page);

  // Replace the stub with three instructions, then let it re-assemble.
  const asm = asmContent(page);
  await asm.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('LD A,42\nRET\n');
  // The debounce commits and rewrites the #BIN line.
  await page.getByRole('tab', { name: 'BASIC' }).click();
  const chip = page.locator('.cm-binaryLineChip');
  await expect(chip).toHaveCount(1);
  // LD A,42 (2 bytes) + RET (1) = 3 code bytes; the record grows from 7 to 9.
  await expect(chip).toContainText('9 bytes');
});

test('a listing block switched to memory is editable as bytes', async ({
  page,
}) => {
  await openZx81(page);
  await addMemoryBlock(page);

  // Switch the block's kind: a listing block is machine code by default, and
  // memory is the kind with no assembly view.
  await page.getByRole('tab', { name: 'bin1' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Settings…' }).click();
  await page.getByLabel('Kind').selectOption('memory');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // It opens in the byte editor, on the return stub's single byte.
  const editor = page.getByTestId('byte-editor');
  await expect(editor).toBeVisible();
  await expect(editor.locator('.cm-content')).toContainText('C9');

  // Editing a byte here rewrites the BASIC listing itself, since that is where
  // this machine keeps a block's bytes. The commit path differs from a
  // fixed-address block's, so the round trip is checked through the chip the
  // BASIC tab draws for the same record.
  await editor
    .locator('.cm-line')
    .first()
    .click({ position: { x: 3, y: 6 } });
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('00');
  await expect(page.getByTestId('block-bar')).toContainText('2 bytes');

  await page.getByRole('tab', { name: 'BASIC' }).click();
  const chip = page.locator('.cm-binaryLineChip');
  await expect(chip).toHaveCount(1);
  // The stub's 1 byte plus the one just appended: the record grows 7 -> 8.
  await expect(chip).toContainText('8 bytes');
});
