import { readFile } from 'node:fs/promises';
import { test, expect } from '../fixtures';
import {
  EDITOR,
  expectMenuStaysOpen,
  fileMenu,
  forceFallbackFilePickers,
  openApp,
  saveAsBas,
  setEditorSource,
} from './helpers';

/**
 * Test plan §5 - Files: open & save.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * All tests force the classic file-input/download fallback (see helpers) so
 * one code path runs identically across the matrix - Playwright cannot drive
 * the Chromium-native FS Access pickers, so that half of 5.1/5.2 (and dialog
 * cancel behaviour, 5.3) stays a manual check.
 */

test('5.1 Save downloads a .txt with the chosen name and clears the dirty marker', async ({
  page,
}) => {
  await forceFallbackFilePickers(page);
  const dialogs = await openApp(page);
  await setEditorSource(page, '10 PRINT "SAVE ME"');
  await expect(page.getByText(/untitled\.txt\s*•/)).toBeVisible(); // dirty
  const suggested = await saveAsBas(page, dialogs, 'myprog');
  expect(suggested).toBe('myprog.txt');
  // Saved: the new name shows and the dirty dot is gone.
  await expect(page.getByText('myprog.txt')).toBeVisible();
  await expect(page.getByText(/myprog\.txt\s*•/)).toBeHidden();
});

test('5.1b File menu opens, stays open, and dismisses on outside click / Escape', async ({
  page,
}) => {
  await openApp(page);

  // Opens on click and does NOT close when the pointer leaves the panel - the
  // Firefox regression that hover-based dismissal caused.
  await page.getByRole('button', { name: 'File ▾' }).click();
  await expectMenuStaysOpen(page, /^New/);

  // Dismisses on a click outside the menu. (Scope to the dropdown panel: the
  // editor tab strip's "New block" button also matches /^New/.)
  const menuNew = page
    .locator('[class*="menuItems"]')
    .getByRole('button', { name: /^New/ });
  await page.locator(EDITOR).click();
  await expect(menuNew).toBeHidden();

  // Dismisses on Escape.
  await page.getByRole('button', { name: 'File ▾' }).click();
  await expect(menuNew).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menuNew).toBeHidden();
});

test('5.2 Open loads a legacy .bas file (content and filename)', async ({
  page,
}) => {
  await forceFallbackFilePickers(page);
  await openApp(page);
  const chooser = page.waitForEvent('filechooser');
  await fileMenu(page, /^Open…/);
  await (
    await chooser
  ).setFiles({
    name: 'loaded.bas',
    mimeType: 'text/plain',
    buffer: Buffer.from('10 PRINT "FROM DISK"\n20 GOTO 10\n'),
  });
  await expect(page.locator(EDITOR)).toContainText('FROM DISK');
  await expect(page.getByText('loaded.bas')).toBeVisible();
});

test('5.4/5.5 native binary round trip: export .P, re-import it', async ({
  page,
}) => {
  await forceFallbackFilePickers(page);
  const dialogs = await openApp(page);
  await setEditorSource(page, '10 PRINT "ROUNDTRIP"\n20 GOTO 10');
  await saveAsBas(page, dialogs, 'roundtrip');

  // Export the ZX81 .P image.
  await fileMenu(page, /^Export/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .P file' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.p$/i);
  const bytes = await readFile(await download.path());
  expect(bytes.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Close' }).click();

  // Wipe the editor, then import the .P back.
  await setEditorSource(page, '10 REM GONE');
  await fileMenu(page, /^Import/);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import .P…' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'roundtrip.p',
    mimeType: 'application/octet-stream',
    buffer: bytes,
  });
  await expect(page.locator(EDITOR)).toContainText('PRINT "ROUNDTRIP"');
  await expect(page.locator(EDITOR)).toContainText('20 GOTO 10');
  // An import is not a saved file, so it comes back as an untitled document.
  await expect(page.getByText('Imported roundtrip.p.')).toBeVisible();
  await expect(page.getByText(/untitled\.txt\s*•/)).toBeVisible();
});
