// Capability: memory-blocks — openspec/specs/memory-blocks/spec.md
import { test, expect, type Page } from '../fixtures';

/**
 * The per-block assembly editor:
 *
 *  1. A document with memory blocks shows a tab strip (BASIC + one tab per
 *     block); one without blocks still shows the strip (BASIC + the
 *     new-block button; see block-tabs.spec.ts for create/delete).
 *  2. A `kind: 'code'` block tab opens an editable disassembly; edits
 *     re-assemble on a debounce and replace the block's bytes (visible in
 *     autosave), and the text survives tab switches and reloads.
 *  3. A syntax error shows an error dot on the tab and leaves bytes alone.
 *  4. A `kind: 'data'` block shows the not-yet-supported placeholder.
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
    kind: 'data',
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

test('a blockless document still shows the strip: BASIC plus the new-block button', async ({
  page,
}) => {
  await seedProject(page, null);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC']);
  await expect(
    tablist.getByRole('button', { name: 'New block' }),
  ).toBeVisible();
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

test('a data block shows the not-yet-supported placeholder', async ({
  page,
}) => {
  await seedProject(page);
  await page.getByRole('tab', { name: 'sprites' }).click();
  await expect(page.getByRole('note')).toContainText(
    'This file format is not yet supported.',
  );
  await expect(page.getByRole('note')).toContainText('sprites');
  await expect(page.getByRole('note')).toContainText('$9000');
});
