import { readFile } from 'node:fs/promises';
import { test, expect } from '../fixtures';
import {
  EDITOR,
  fileMenu,
  forceFallbackFilePickers,
  openApp,
  saveAsBas,
  setEditorSource,
} from './helpers';

/**
 * Test plan §5 — Files: open & save.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * All tests force the classic file-input/download fallback (see helpers) so
 * one code path runs identically across the matrix — Playwright cannot drive
 * the Chromium-native FS Access pickers, so that half of 5.1/5.2 (and dialog
 * cancel behaviour, 5.3) stays a manual check.
 */

test('5.1 Save .bas downloads with the chosen name and clears the dirty marker', async ({
  page,
}) => {
  await forceFallbackFilePickers(page);
  const dialogs = await openApp(page);
  await setEditorSource(page, '10 PRINT "SAVE ME"');
  await expect(page.getByText(/untitled\.bas\s*•/)).toBeVisible(); // dirty
  const suggested = await saveAsBas(page, dialogs, 'myprog');
  expect(suggested).toBe('myprog.bas');
  // Saved: the new name shows and the dirty dot is gone.
  await expect(page.getByText('myprog.bas')).toBeVisible();
  await expect(page.getByText(/myprog\.bas\s*•/)).toBeHidden();
});

test('5.2 Open .bas loads content and filename', async ({ page }) => {
  await forceFallbackFilePickers(page);
  await openApp(page);
  const chooser = page.waitForEvent('filechooser');
  await fileMenu(page, /^Open \.bas/);
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
  await expect(page.getByText('roundtrip.bas')).toBeVisible();
});
