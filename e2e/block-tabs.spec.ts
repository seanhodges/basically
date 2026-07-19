import { test, expect, type Page } from './fixtures';

/**
 * Block creation and deletion from the editor tab strip:
 *
 *  1. The plus button creates a code block with defaults (`block1`,
 *     `block2`…), activates its tab, and opens the assembly editor on the
 *     one-instruction return stub.
 *  2. Right-clicking a block tab asks for confirmation; Delete removes the
 *     block (and its tab), Cancel keeps it.
 *  3. The BASIC tab has no delete gesture - the main program can't be
 *     deleted.
 *
 * (Long-press shares the right-click path via requestRemoveBlock and is
 * covered by the useLongPress unit tests.)
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

test('right-click asks to confirm; Delete removes the block, Cancel keeps it', async ({
  page,
}) => {
  await openSpectrum(page);
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await tablist.getByRole('button', { name: 'New block' }).click();
  const blockTab = page.getByRole('tab', { name: 'block1' });
  await expect(blockTab).toBeVisible();

  // Cancel keeps the block.
  await blockTab.click({ button: 'right' });
  await expect(
    page.getByRole('heading', { name: /Delete block1/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /block1/]);

  // Delete removes it and falls back to the BASIC tab.
  await blockTab.click({ button: 'right' });
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC']);
  await expect(page.getByRole('tab', { name: 'BASIC' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the BASIC tab cannot be deleted', async ({ page }) => {
  await openSpectrum(page);
  await page.getByRole('tab', { name: 'BASIC' }).click({ button: 'right' });
  await expect(page.getByRole('heading', { name: /Delete/ })).toHaveCount(0);
});
