import { test, expect, type Page } from './fixtures';

/**
 * Block creation, settings and deletion from the editor tab strip:
 *
 *  1. The plus button creates a code block with defaults (`block1`,
 *     `block2`…), activates its tab, and opens the assembly editor on the
 *     one-instruction return stub.
 *  2. Right-clicking a block tab opens a context menu with "Settings…" and
 *     "Delete…"; Escape (or an outside click) dismisses it.
 *  3. Settings opens the block-metadata dialog: renaming and moving the
 *     block updates its tab and its origin.
 *  4. Delete asks for confirmation; Delete removes the block (and its tab),
 *     Cancel keeps it.
 *  5. The BASIC tab has no context menu - the main program can't be deleted.
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

const tabMenu = (page: Page) =>
  page.getByRole('menu', { name: 'Block actions' });

test('the plus button creates blocks with sequential default names', async ({
  page,
}) => {
  await openSpectrum(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC']);

  await tablist.getByRole('button', { name: 'New block' }).click();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /block1/]);
  // The new block's tab is active and shows the assembled return stub.
  await expect(page.getByRole('tab', { name: 'block1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(asmContent(page)).toContainText('RET');
  // Spectrum defaultAddress pins the origin strip.
  await expect(page.getByText('ORG $8000')).toBeVisible();

  await tablist.getByRole('button', { name: 'New block' }).click();
  await expect(tablist.getByRole('tab')).toHaveText([
    'BASIC',
    /block1/,
    /block2/,
  ]);
});

test('right-click opens the context menu; Escape dismisses it', async ({
  page,
}) => {
  await openSpectrum(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await tablist.getByRole('button', { name: 'New block' }).click();

  await page.getByRole('tab', { name: 'block1' }).click({ button: 'right' });
  await expect(tabMenu(page)).toBeVisible();
  await expect(tabMenu(page).getByRole('menuitem')).toHaveText([
    'Settings…',
    'Delete…',
  ]);

  await page.keyboard.press('Escape');
  await expect(tabMenu(page)).toBeHidden();
});

test('Settings edits the block metadata via the dialog', async ({ page }) => {
  await openSpectrum(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await tablist.getByRole('button', { name: 'New block' }).click();

  await page.getByRole('tab', { name: 'block1' }).click({ button: 'right' });
  await tabMenu(page).getByRole('menuitem', { name: 'Settings…' }).click();
  await expect(
    page.getByRole('heading', { name: 'Block settings' }),
  ).toBeVisible();

  // A bad name is rejected inline...
  await page.getByLabel('Name').fill('1bad');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Names start with a letter/)).toBeVisible();

  // ...a clean edit renames and moves the block.
  await page.getByLabel('Name').fill('sprites');
  await page.getByLabel('Load address').fill('$9000');
  await page.getByLabel('Comment (optional)').fill('the draw routine');
  await page.getByRole('button', { name: 'Save' }).click();

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
  await tablist.getByRole('button', { name: 'New block' }).click();
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

test('the BASIC tab has no context menu', async ({ page }) => {
  await openSpectrum(page);
  await page.getByRole('tab', { name: 'BASIC' }).click({ button: 'right' });
  await expect(tabMenu(page)).toHaveCount(0);
});
