// Capability: memory-blocks — openspec/specs/memory-blocks/spec.md
import { test, expect, type Page } from '../fixtures';
import { editMenu } from '../helpers';

/**
 * The two per-block editing surfaces - assembly for a code block, bytes for a
 * data block:
 *
 *  1. A document with memory blocks shows a tab strip (BASIC + one tab per
 *     block); one without blocks still shows the strip (BASIC + the
 *     new-block button; see block-tabs.spec.ts for create/delete).
 *  2. A `kind: 'code'` block tab opens an editable disassembly; edits
 *     re-assemble on a debounce and replace the block's bytes (visible in
 *     autosave), and the text survives tab switches and reloads.
 *  3. A syntax error shows an error dot on the tab and leaves bytes alone.
 *  4. A `kind: 'memory'` block opens the byte editor instead: its bytes are
 *     editable in place, the two views move together, the block grows at its
 *     end, and both survive a tab switch and a reload.
 *  5. The Edit menu acts on the block on screen, and each block keeps its own
 *     edit history across tab switches - assembly or bytes.
 *  6. Byte edits are undoable, the byte count is an editable field, and Fill
 *     changes a named address range without changing the length.
 *
 * Specs seed blocks through autosave (the same wire shape the project zip
 * uses), which the app restores on boot - faster and more precise than clicking
 * through the creation UI.
 */

/** 3E 02 D3 FE C9 = LD A,$02 / OUT ($FE),A / RET, base64-encoded. */
const BORDER_BYTES = 'PgLT/sk=';
/** The same routine with LD A,$07 instead. */
const BORDER_BYTES_EDITED = 'PgfT/sk=';

const BLOCKS = JSON.stringify([
  {
    id: 'blk-border',
    name: 'border',
    address: 0x8000,
    bytes: BORDER_BYTES,
    kind: 'code',
  },
  {
    id: 'blk-sprites',
    name: 'sprites',
    address: 0x9000,
    bytes: 'AQIDBA==',
    kind: 'memory',
  },
]);

/** Seed a Spectrum document (with the blocks above) into autosave. */
async function seedProject(page: Page, blocks: string | null = BLOCKS) {
  await page.addInitScript(
    ({ blocks }) => {
      localStorage.setItem('mbide.dialectId', 'zxspectrum');
      localStorage.setItem('mbide.autosave.doc', '10 PRINT "HI"');
      localStorage.setItem('mbide.autosave.name', 'blocks.zip');
      if (blocks !== null) {
        localStorage.setItem('mbide.autosave.blocks', blocks);
      }
    },
    { blocks },
  );
  await page.goto('/');
  await expect(page.locator('.cm-content').first()).toBeVisible();
}

/** The autosaved wire-shape blocks (autosave polls every 2s). */
async function autosavedBlocks(
  page: Page,
): Promise<{ name: string; bytes: string; asmSource?: string }[]> {
  await expect
    .poll(
      () =>
        page.evaluate(() => sessionStorage.getItem('mbide.autosave.blocks')),
      { timeout: 8000 },
    )
    .not.toBeNull();
  const raw = await page.evaluate(() =>
    sessionStorage.getItem('mbide.autosave.blocks'),
  );
  return JSON.parse(raw!) as { name: string; bytes: string }[];
}

const asmContent = (page: Page) =>
  page.locator('.cm-editor').last().locator('.cm-content');

test('a blockless document still shows the strip: BASIC plus the new-tab button', async ({
  page,
}) => {
  await seedProject(page, null);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC']);
  await expect(tablist.getByRole('button', { name: 'New tab' })).toBeVisible();
});

test('block tabs appear; the code block opens an editable disassembly', async ({
  page,
}) => {
  await seedProject(page);

  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await expect(tablist.getByRole('tab')).toHaveText([
    'BASIC',
    /border/,
    /sprites/,
  ]);
  await expect(page.getByRole('tab', { name: 'BASIC' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: 'border' }).click();
  await expect(asmContent(page)).toContainText('LD A,$02');
  await expect(asmContent(page)).toContainText('OUT ($FE),A');
  await expect(asmContent(page)).toContainText('RET');
  // The status strip pins the block's origin.
  await expect(page.getByText('ORG $8000')).toBeVisible();

  // Edit $02 -> $07: after the debounce the reassembled bytes replace the
  // block's contents (observed through autosave, like a reload would).
  await asmContent(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('LD A,$07\nOUT ($FE),A\nRET');
  await expect
    .poll(
      async () =>
        (await autosavedBlocks(page)).find((b) => b.name === 'border')?.bytes,
      { timeout: 8000 },
    )
    .toBe(BORDER_BYTES_EDITED);
  const border = (await autosavedBlocks(page)).find(
    (b) => b.name === 'border',
  )!;
  expect(border.asmSource).toContain('LD A,$07');

  // The text survives switching away and back...
  await page.getByRole('tab', { name: 'BASIC' }).click();
  await expect(page.locator('.cm-content').first()).toContainText(
    '10 PRINT "HI"',
  );
  await page.getByRole('tab', { name: 'border' }).click();
  await expect(asmContent(page)).toContainText('LD A,$07');

  // ...and a full reload (autosave restores blocks + asmSource).
  await page.reload();
  await expect(page.locator('.cm-content').first()).toBeVisible();
  await page.getByRole('tab', { name: 'border' }).click();
  await expect(asmContent(page)).toContainText('LD A,$07');

  // The click menu reaches this editor too, which only a browser can show: it
  // is a second, separately-configured CodeMirror, and the row depends on
  // posAtCoords landing on the mnemonic's own glyphs. Which tokens qualify is
  // settled in src/editor/tokenAt.test.ts; that the drawer opens on the right
  // topic is settled in e2e/shell/docs-drawer.spec.ts, so this stops at the
  // drawer rather than paying for a second cold docs iframe.
  await asmContent(page).getByText('RET', { exact: true }).click();
  await page.getByRole('button', { name: /Look up RET/ }).click();
  await expect(
    page.getByRole('dialog', { name: 'Documentation' }),
  ).toBeVisible();
});

test('a syntax error marks the tab and leaves the bytes untouched', async ({
  page,
}) => {
  await seedProject(page);
  await page.getByRole('tab', { name: 'border' }).click();
  await expect(asmContent(page)).toContainText('LD A,$02');

  await asmContent(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('FLY away');

  const borderTab = page.getByRole('tab', { name: 'border' });
  await expect(
    borderTab.locator('[aria-label="does not assemble"]'),
  ).toBeVisible();
  // The broken text is kept (asmSource), the bytes are not.
  await expect
    .poll(
      async () =>
        (await autosavedBlocks(page)).find((b) => b.name === 'border')
          ?.asmSource,
      { timeout: 8000 },
    )
    .toContain('FLY');
  const border = (await autosavedBlocks(page)).find(
    (b) => b.name === 'border',
  )!;
  expect(border.bytes).toBe(BORDER_BYTES);
});

test('the Edit menu acts on the block, whose history outlives a tab switch', async ({
  page,
}) => {
  // Browser-only: the menu has to reach the editor that is actually on screen,
  // and the block's state has to survive a real tab switch as a live view is
  // handed a different state. Neither is observable outside a browser.
  await seedProject(page);
  await page.getByRole('tab', { name: 'border' }).click();
  await expect(asmContent(page)).toContainText('LD A,$02');

  // A menu-driven Undo takes the block's own last edit...
  await asmContent(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' ; TWEAK');
  await expect(asmContent(page)).toContainText('TWEAK');
  await editMenu(page, /^Undo/);
  await expect(asmContent(page)).not.toContainText('TWEAK');

  // ...and the entries that only mean something for BASIC are withheld here
  // rather than acting on the program behind the block.
  await page.getByRole('button', { name: 'Edit ▾' }).click();
  await expect(
    page.getByRole('button', { name: /^Renumber line/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: /^Renumber file/ }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Outline/ })).toBeDisabled();
  await page.keyboard.press('Escape');

  // The BASIC program never saw any of it.
  await page.getByRole('tab', { name: 'BASIC' }).click();
  await expect(page.locator('.cm-content').first()).toContainText(
    '10 PRINT "HI"',
  );

  // Back to the block: its history came back with it, so Redo still has the
  // edit that Undo took.
  await page.getByRole('tab', { name: 'border' }).click();
  await expect(asmContent(page)).toContainText('LD A,$02');
  await editMenu(page, /^Redo/);
  await expect(asmContent(page)).toContainText('TWEAK');
});

/**
 * Put the caret on the first byte of the first row, in the hex view. A plain
 * click lands wherever the pointer is - often in the character column - so the
 * position is pinned to the left edge of the row.
 */
async function clickFirstByte(page: Page) {
  await page
    .getByTestId('byte-editor')
    .locator('.cm-line')
    .first()
    .click({ position: { x: 3, y: 6 } });
}

test('a data block opens the byte editor, and its edits round-trip', async ({
  page,
}) => {
  await seedProject(page);
  await page.getByRole('tab', { name: 'sprites' }).click();

  // The surface a data block used to be refused: its own bytes, its own
  // address, and no placeholder in sight.
  const editor = page.getByTestId('byte-editor');
  const content = editor.locator('.cm-content');
  await expect(editor).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);
  await expect(page.getByText('ORG $9000')).toBeVisible();
  await expect(content).toContainText('01 02 03 04');

  // Overwrite the first byte with $41. Two nibbles typed over the byte that was
  // there; the ones after it keep their addresses.
  await clickFirstByte(page);
  await page.keyboard.type('41');
  await expect(content).toContainText('41 02 03 04');
  // The character view is the same document, so it moved with the hex: $41 is
  // the machine's own code for A.
  await expect(editor.locator('.cm-line').first()).toContainText('A');

  // And the other way: a character typed into the character view is encoded
  // through the machine's charset and shows in the hex.
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  await page.keyboard.type('B');
  await expect(content).toContainText('42 02 03 04');

  // Grow the block by a byte at its end: the caret rests one past the last
  // byte, and a value entered there appends.
  await page.keyboard.press('Tab');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('7e');
  await expect(page.getByTestId('byte-length')).toHaveValue('5');

  // The edit and the new length reached the document...
  await expect
    .poll(
      async () =>
        (await autosavedBlocks(page)).find((b) => b.name === 'sprites')?.bytes,
      { timeout: 8000 },
    )
    .toBe('QgIDBH4=');

  // ...survive showing another tab and coming back...
  await page.getByRole('tab', { name: 'BASIC' }).click();
  await expect(page.locator('.cm-content').first()).toContainText(
    '10 PRINT "HI"',
  );
  await page.getByRole('tab', { name: 'sprites' }).click();
  await expect(content).toContainText('42 02 03 04 7E');

  // ...and a reload, which restores the block from autosave.
  await page.reload();
  await expect(page.locator('.cm-content').first()).toBeVisible();
  await page.getByRole('tab', { name: 'sprites' }).click();
  await expect(content).toContainText('42 02 03 04 7E');
  await expect(page.getByTestId('byte-length')).toHaveValue('5');
});

test("a block's byte edits are undoable, and outlive showing another tab", async ({
  page,
}) => {
  await seedProject(page);
  await page.getByRole('tab', { name: 'sprites' }).click();
  const content = page.getByTestId('byte-editor').locator('.cm-content');
  await clickFirstByte(page);
  await page.keyboard.type('ab');
  await expect(content).toContainText('AB 02 03 04');

  await page.getByRole('tab', { name: 'BASIC' }).click();
  await page.getByRole('tab', { name: 'sprites' }).click();
  // Each nibble is its own step: the second one goes back first, then the one
  // that set the high half, leaving the byte the block started with.
  await editMenu(page, /^Undo/);
  await expect(content).toContainText('A1 02 03 04');
  await editMenu(page, /^Undo/);
  await expect(content).toContainText('01 02 03 04');

  // Fill names an address range rather than sweeping one, and changes values
  // without changing the length.
  await page.getByRole('button', { name: 'Fill…' }).click();
  await page.getByLabel('Fill from address').fill('$9001');
  await page.getByLabel('Fill to address').fill('$9002');
  await page.getByLabel('Fill byte value').fill('$AA');
  await page.getByRole('button', { name: 'Fill', exact: true }).click();
  await expect(content).toContainText('01 AA AA 04');
  await expect(page.getByTestId('byte-length')).toHaveValue('4');

  // A length change too large to type goes through the byte count in the status
  // strip - and undo reaches it like any other edit, bringing back the bytes it
  // discarded with the values they had.
  await page.getByTestId('byte-length').fill('2');
  await page.getByTestId('byte-length').press('Enter');
  await expect(content).toContainText('01 AA');
  await expect(content).not.toContainText('01 AA AA');
  await editMenu(page, /^Undo/);
  await expect(content).toContainText('01 AA AA 04');
});
