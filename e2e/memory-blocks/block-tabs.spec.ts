// Capability: memory-blocks — openspec/specs/memory-blocks/spec.md
import { test, expect, type Page } from '../fixtures';
import { addMemoryBlock, playAndWaitRunning } from '../helpers';

/**
 * Block creation, settings and deletion from the editor tab strip:
 *
 *  1. The plus button creates a code block with defaults (`block1`,
 *     `block2`…), activates its tab, and opens the assembly editor on the
 *     one-instruction return stub.
 *  2. Right-clicking a code block tab opens a context menu with "Download
 *     .asm", "Download .bin", "Settings…" and "Delete…"; Escape (or an outside
 *     click) dismisses it.
 *  3. Settings opens the block-metadata dialog: renaming and moving the
 *     block updates its tab and its origin.
 *  4. Delete asks for confirmation; Delete removes the block (and its tab),
 *     Cancel keeps it.
 *  5. The BASIC tab's context menu offers "Download .bas" (the main program
 *     can't be deleted, so it has no Delete).
 *
 * (Long-press shares the right-click path via the same open-menu callback and
 * is covered by the useLongPress unit tests.)
 */

async function openSpectrum(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mbide.dialectId', 'zxspectrum');
    localStorage.setItem('mbide.autosave.doc', '10 PRINT "HI"');
    localStorage.setItem('mbide.autosave.name', 'blocks.bas');
  });
  await page.goto('/');
  await expect(page.locator('.cm-content').first()).toBeVisible();
}

const asmContent = (page: Page) =>
  page.locator('.cm-editor').last().locator('.cm-content');

const tabMenu = (page: Page) => page.getByRole('menu', { name: 'Tab actions' });

test('the plus button creates blocks with sequential default names', async ({
  page,
}) => {
  await openSpectrum(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC']);

  await addMemoryBlock(page);
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /block1/]);
  // The new block's tab is active and shows the assembled return stub.
  await expect(page.getByRole('tab', { name: 'block1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(asmContent(page)).toContainText('RET');
  // Spectrum defaultAddress pins the origin strip.
  await expect(page.getByText('ORG $8000')).toBeVisible();

  await addMemoryBlock(page);
  await expect(tablist.getByRole('tab')).toHaveText([
    'BASIC',
    /block1/,
    /block2/,
  ]);
});

test('the context menu offers the block actions, and Settings edits its metadata', async ({
  page,
}) => {
  await openSpectrum(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await addMemoryBlock(page);

  await page.getByRole('tab', { name: 'block1' }).click({ button: 'right' });
  await expect(tabMenu(page)).toBeVisible();
  // A code block downloads either its assembly or its bytes, plus Settings /
  // Delete.
  await expect(tabMenu(page).getByRole('menuitem')).toHaveText([
    'Download .asm',
    'Download .bin',
    'Settings…',
    'Delete…',
  ]);

  await page.keyboard.press('Escape');
  await expect(tabMenu(page)).toBeHidden();

  await page.getByRole('tab', { name: 'block1' }).click({ button: 'right' });
  await tabMenu(page).getByRole('menuitem', { name: 'Settings…' }).click();
  await expect(
    page.getByRole('heading', { name: 'Block settings' }),
  ).toBeVisible();

  // A bad name is rejected inline. `exact` on every Save below: accessible-name
  // matching is a substring match by default, and the toolbar behind the dialog
  // carries a "Save a screenshot" button that would match a bare 'Save' too.
  await page.getByLabel('Name').fill('1bad');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Names start with a letter/)).toBeVisible();

  // ...a clean edit renames and moves the block.
  await page.getByLabel('Name').fill('sprites');
  await page.getByLabel('Load address').fill('$9000');
  await page.getByLabel('Comment (optional)').fill('the draw routine');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /sprites/]);
  // The block tab is still active; its origin strip follows the move.
  await expect(page.getByText('ORG $9000')).toBeVisible();
  await expect(page.getByText('the draw routine')).toBeVisible();
});

test('Delete asks to confirm; Delete removes the block, Cancel keeps it', async ({
  page,
}) => {
  await openSpectrum(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await addMemoryBlock(page);
  const blockTab = page.getByRole('tab', { name: 'block1' });
  await expect(blockTab).toBeVisible();

  // Cancel keeps the block.
  await blockTab.click({ button: 'right' });
  await tabMenu(page).getByRole('menuitem', { name: 'Delete…' }).click();
  await expect(
    page.getByRole('heading', { name: /Delete block1/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /block1/]);

  // Delete removes it and falls back to the BASIC tab.
  await blockTab.click({ button: 'right' });
  await tabMenu(page).getByRole('menuitem', { name: 'Delete…' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC']);
  await expect(page.getByRole('tab', { name: 'BASIC' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

/**
 * Whether the Atom's video RAM is free depends on the program, and only the
 * running app puts the two together: the Run gate reads the open program's text
 * and hands it to the block linter. The unit tests pin the linter's verdicts
 * (`src/app/blockLint.test.ts`) and the declared region
 * (`src/dialects/atom/memoryBlocks.test.ts`); what no unit test can prove is
 * that the gate asks at all. Both halves ride one page load - the refusal
 * never boots a machine, so only the accepted run pays for one.
 */
test('a block in the Atom video RAM runs while the program stays in text mode', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('mbide.dialectId', 'atom');
    localStorage.setItem('mbide.autosave.doc', '10 CLEAR 4');
    localStorage.setItem('mbide.autosave.name', 'video.bas');
  });
  await page.goto('/');
  await expect(page.locator('.cm-content').first()).toBeVisible();

  await addMemoryBlock(page);
  await page.getByRole('tab', { name: 'block1' }).click({ button: 'right' });
  await tabMenu(page).getByRole('menuitem', { name: 'Settings…' }).click();
  await page.getByLabel('Load address').fill('$8400');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('ORG $8400')).toBeVisible();

  // CLEAR 4 draws into the video RAM, so the placement is refused - and the
  // refusal says what would make it legal rather than only that it is not.
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect(
    page.getByText(/free only while the program stays in text mode/),
  ).toBeVisible();

  // Back to text mode and the same block is accepted: the machine boots and
  // runs with a block the linter refused a moment ago.
  await page.getByRole('tab', { name: 'BASIC' }).click();
  const basic = page.locator('.cm-content').first();
  await basic.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('10 CLEAR 0');
  await playAndWaitRunning(page);
});

test('the BASIC tab context menu downloads the .bas listing', async ({
  page,
}) => {
  await openSpectrum(page);
  await page.getByRole('tab', { name: 'BASIC' }).click({ button: 'right' });
  // Only a download - the main program can't be deleted.
  await expect(tabMenu(page).getByRole('menuitem')).toHaveText([
    'Download .bas',
  ]);

  const downloadPromise = page.waitForEvent('download');
  await tabMenu(page).getByRole('menuitem', { name: 'Download .bas' }).click();
  const download = await downloadPromise;
  // Named after the document (blocks.bas -> blocks.bas), .bas extension.
  expect(download.suggestedFilename()).toBe('blocks.bas');
});
