// Capability: persistence — openspec/specs/persistence/spec.md
import { test, expect } from '../fixtures';
import {
  EDITOR,
  openApp,
  playAndWaitRunning,
  selectDialect,
  setEditorSource,
  stopEmulator,
} from '../helpers';

/**
 * A file a running program saves appears as an editor tab, outlives the run,
 * can be copied into a block of the document, and is discarded by the next run
 * while the block it seeded stays.
 *
 * Browser-only, and worth its minute: the file arrives from a ROM trap inside a
 * real run, reaches the editor through the file store's own change
 * notification, and then has to survive the pane tearing the machine down and
 * be gone once the next run clears the store. None of that is reachable without
 * an actual machine running in an actual browser - the projection itself is
 * covered in `src/app/dataBlocks.test.ts`, and the tape unwrap in
 * `src/dialects/zxspectrum/storedFile.test.ts`.
 *
 * One journey with staged assertions rather than four tests: the Spectrum is
 * booted once and the program is run twice, which is the whole cost here.
 */
test('a saved file appears as a tab, survives the stop, copies into a block, and goes with the next run', async ({
  page,
}) => {
  // The Spectrum stores a whole two-block tape image, so it is also the machine
  // that proves the tab shows the file and not the header around it.
  test.setTimeout(90_000);

  await openApp(page);
  await selectDialect(page, 'zxspectrum');
  // `SAVE … DATA` writes the array through SA-BYTES, where the deck traps it.
  // Two elements: 1 dimension byte + a 2-byte size + 5 bytes per element = 13,
  // where the stored tape image is 38 - so the byte count alone says which of
  // the two the tab is showing.
  await setEditorSource(
    page,
    '10 DIM a(2)\n20 LET a(1)=7\n30 LET a(2)=9\n40 SAVE "SCORES" DATA a()\n50 PRINT "SAVED"\n',
  );
  await playAndWaitRunning(page);

  const tab = page.getByRole('tab', { name: 'SCORES' });

  // The ROM's SAVE holds at "Start tape, then press any key." - tap one until
  // the file lands. Polling the tab rather than sleeping out the boot: how long
  // the ROM takes to reach the prompt is not a fixed number of frames.
  await expect
    .poll(
      async () => {
        await page.keyboard.press('q');
        return tab.count();
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toBe(1);

  // The tab shows the file the program saved, not the tape framing around it.
  await tab.click();
  const bytes = page.getByTestId('byte-editor');
  await expect(page.getByText('13 bytes')).toBeVisible();
  await expect(bytes).toContainText('01 02 00 00 00 07');

  // Read-only: the bytes are program output, with nowhere an edit could go.
  await bytes.click();
  await page.keyboard.press('f');
  await expect(page.getByTestId('byte-refusal')).toBeVisible();
  await expect(bytes).toContainText('01 02 00 00 00 07');

  // Stopping the machine to read what the program produced does not destroy it.
  await stopEmulator(page);
  await expect(tab).toHaveCount(1);
  await expect(bytes).toContainText('01 02 00 00 00 07');

  // Copying the file into a block rides on this journey rather than on a
  // memory-blocks spec of its own: the file has to come from a real run, and
  // that boot (the ROM SAVE and its tape prompt) is the whole cost here.
  await tab.click({ button: 'right' });
  const tabMenu = page.getByRole('menu', { name: 'Tab actions' });
  await tabMenu
    .getByRole('menuitem', { name: 'Copy to a binary block' })
    .click();

  // The block arrives with its settings open on it, because the address it
  // starts at is a suggestion. Renaming here also keeps the two tabs apart:
  // the block is named after the file, so both would answer to "SCORES".
  await expect(
    page.getByRole('heading', { name: 'Block settings' }),
  ).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('SCORES');
  await page.getByLabel('Name').fill('kept');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // The block holds a copy of what the tab showed - the file, not the framing.
  // Picked by its ▤ block glyph rather than by name alone: loading a program
  // also puts each block on the deck as a CODE file, so that a program's own
  // `LOAD "name" CODE` finds it - which gives the block a 🖫 data tab of the
  // same name from the next run onwards.
  const blockTab = page
    .getByRole('tab', { name: 'kept' })
    .filter({ hasText: '▤' });
  await blockTab.click();
  await expect(bytes).toContainText('01 02 00 00 00 07');
  // ...and the file is unaffected by the copy.
  await expect(tab).toHaveCount(1);

  // Running again starts clean. The second run is never given the keypress the
  // tape prompt waits for, so it cannot re-save the file - what the tab shows
  // is the store being cleared, not a race with the next capture.
  await playAndWaitRunning(page);
  await expect(tab).toHaveCount(0);
  // The block is part of the document, so it outlives the file it came from.
  await expect(blockTab).toHaveCount(1);
  await page.getByRole('tab', { name: 'BASIC' }).click();
  await expect(page.locator(EDITOR)).toContainText('SAVE "SCORES" DATA');
});
