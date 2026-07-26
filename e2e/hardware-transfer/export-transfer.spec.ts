// Capability: hardware-transfer — openspec/specs/hardware-transfer/spec.md
import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '../fixtures';
import {
  fileMenu,
  forceFallbackFilePickers,
  installDialogHandler,
  openApp,
  saveAsProject,
  setEditorSource,
} from '../helpers';

/** Open the export dialog on an unsaved program (no save gate to clear). */
async function openExportOnUnsavedDoc(page: Page) {
  await openApp(page);
  await setEditorSource(page, '10 PRINT "EXPORT"\n20 GOTO 10');
  await fileMenu(page, /^Export/);
  await expect(
    page.getByRole('heading', { name: 'Run on real hardware' }),
  ).toBeVisible();
}

/**
 * Test plan §7 - Export / transfer to hardware.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * 7.2 asserts the playback flow (status, Stop) - whether the tone is audible
 * and loads on real hardware (7.3's mixing, real machine loading) is manual.
 * 7.5's actual serial transfer needs bridge hardware - manual; the gating
 * (enabled on Chromium/Edge, disabled+tooltip elsewhere) is automated.
 */

/** Save a small program so the export dialog opens with a deliberate name. */
async function openExportOnSavedDoc(page: Page) {
  await forceFallbackFilePickers(page);
  const dialogs = await openApp(page);
  await setEditorSource(page, '10 PRINT "EXPORT"\n20 GOTO 10');
  await saveAsProject(page, dialogs, 'export');
  await fileMenu(page, /^Export/);
  await expect(
    page.getByRole('heading', { name: 'Run on real hardware' }),
  ).toBeVisible();
}

test('7.1 unsaved program exports immediately under the PROGRAM name', async ({
  page,
}) => {
  await openExportOnUnsavedDoc(page);
  // No save gate: the export controls are available straight away.
  await expect(page.getByText(/Save your program to a/)).toBeHidden();
  const serial = page.getByRole('button', { name: 'Send via serial bridge' });
  await expect(serial).toBeVisible();
  // With no saved filename, the exported image (and its tape header) default to
  // PROGRAM - the .P downloads as program.p.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .P file' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('program.p');
});

test('7.2 cassette playback starts from the click and stops on demand', async ({
  page,
}) => {
  await openExportOnSavedDoc(page);
  // Playwright's WebKit build on Windows/Linux ships without Web Audio, so
  // playback can't start there. Feature-detect rather than skip by browser so
  // the test still runs where WebKit has it (e.g. macOS).
  test.skip(
    await page.evaluate(() => typeof AudioContext === 'undefined'),
    'Web Audio unavailable in this WebKit build',
  );
  await page.getByRole('button', { name: '▶ Play through speakers' }).click();
  // The status must reach "Playing …s" - on Safari-like engines this guards
  // the suspended-AudioContext hang fixed in src/transfer/audioPlayer.ts.
  await expect(page.getByText(/Playing \d+s of cassette audio/)).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: '■ Stop audio' }).click();
  await expect(
    page.getByRole('button', { name: '▶ Play through speakers' }),
  ).toBeVisible();
});

test('7.5/7.6 serial bridge button gates on WebSerial support', async ({
  page,
  browserName,
}) => {
  await openExportOnSavedDoc(page);
  const serial = page.getByRole('button', { name: 'Send via serial bridge' });
  await expect(serial).toBeVisible();
  if (browserName === 'chromium') {
    // Chrome and Edge (both Chromium projects) expose WebSerial.
    await expect(serial).toBeEnabled();
  } else {
    await expect(serial).toBeDisabled();
    await expect(serial).toHaveAttribute(
      'title',
      'WebSerial needs Chrome or Edge',
    );
  }
});

/** Boot straight into the C64 with a program, dodging the machine-switch gate. */
async function openC64WithBlock(page: Page) {
  installDialogHandler(page);
  await page.addInitScript(() => {
    localStorage.setItem('mbide.dialectId', 'commodore64');
    localStorage.setItem('mbide.autosave.doc', '10 PRINT "HELLO"\n20 GOTO 10');
    localStorage.setItem('mbide.autosave.name', 'game.bas');
  });
  await page.goto('/');
  await expect(page.locator('.cm-content').first()).toBeVisible();
  // Add a memory block so the document holds something the .prg can't carry.
  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await tablist.getByRole('button', { name: 'New block' }).click();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /block1/]);
}

test('7.8 C64 .d64 export carries blocks; .prg warns before dropping them', async ({
  page,
}) => {
  await openC64WithBlock(page);
  await fileMenu(page, /^Export/);
  await expect(
    page.getByRole('heading', { name: 'Run on real hardware' }),
  ).toBeVisible();

  // The block-aware .d64 export is offered and downloads a single container.
  const d64Download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .d64' }).click();
  expect((await d64Download).suggestedFilename()).toMatch(/\.d64$/);

  // The .prg can't carry the block: it warns and waits for confirmation
  // instead of downloading straight away.
  await page.getByRole('button', { name: 'Export .prg' }).click();
  await expect(page.getByText(/won.t be included/)).toBeVisible();

  // Cancel keeps the document and dismisses the warning - no download.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText(/won.t be included/)).toBeHidden();

  // Export anyway proceeds with the BASIC-only .prg.
  await page.getByRole('button', { name: 'Export .prg' }).click();
  const prgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export anyway' }).click();
  expect((await prgDownload).suggestedFilename()).toMatch(/\.prg$/);
});

test('7.7 robust mode produces a longer cassette recording', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openExportOnSavedDoc(page);

  const normalDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .wav' }).click();
  const normal = await readFile(await (await normalDownload).path());

  await page.getByLabel(/Robust mode/).check();

  const robustDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .wav' }).click();
  const robust = await readFile(await (await robustDownload).path());

  expect(robust.length).toBeGreaterThan(normal.length);
});
