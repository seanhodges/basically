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
 *  2. "New machine code block" appends a `#BIN` REM record: a `bin1` tab opens on the return
 *     stub, and the BASIC tab now shows a binary-line chip for it.
 *  3. Editing the block's assembly rewrites that chip (its byte count grows).
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
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /bin1/]);
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
