// Capability: persistence — openspec/specs/persistence/spec.md
import { test, expect, machinePicker } from '../fixtures';
import {
  canvasPainted,
  forceFallbackFilePickers,
  openApp,
  playAndWaitRunning,
  selectDialect,
  setEditorSource,
} from '../helpers';
import type { Page } from '@playwright/test';

/**
 * Supplying your own machine ROM.
 *
 * The load-bearing assertion here is step 3: a ROM image of the right size but
 * filled with zeros is, to a Z80, an unbroken run of NOPs, so the machine never
 * reaches the booted state it waits for and the run fails naming the image.
 * Nothing but the uploaded bytes actually reaching the CPU can produce that,
 * and pairing it with the restore in step 5 - where the same program runs and
 * paints - is what stops it passing for some unrelated reason.
 */

const ZX81_ROM_BYTES = 8192;

async function openRomSettings(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+Comma');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('tab', { name: 'Emulator' }).click();
  await expect(
    page.getByRole('heading', { name: 'Machine ROM' }),
  ).toBeVisible();
}

async function closeSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(
    page.getByRole('heading', { name: 'Settings' }),
  ).not.toBeVisible();
}

/** Hand the settings upload control a file, through the fallback picker. */
async function uploadRom(
  page: Page,
  name: string,
  buffer: Buffer,
): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload ROM image' }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: 'application/octet-stream', buffer });
}

test('a supplied ROM is used, persists, and can be restored', async ({
  page,
}) => {
  await forceFallbackFilePickers(page); // init script: must precede openApp
  await openApp(page);
  await setEditorSource(page, '10 PRINT "HI"');

  await openRomSettings(page);

  // 1. The bundled image is in use, and there is nothing to restore.
  await expect(
    page.getByText(/Using the bundled .* ROM \(8,192 bytes\)/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Restore bundled ROM' }),
  ).toBeDisabled();

  // 2. A wrong-sized file is refused, naming both sizes, and changes nothing.
  await uploadRom(page, 'tiny.rom', Buffer.alloc(100));
  const refusal = page.getByRole('alert');
  await expect(refusal).toContainText('100 bytes');
  await expect(refusal).toContainText('8,192 bytes');
  await expect(page.getByText(/Using the bundled .* ROM/)).toBeVisible();

  // 3. A zero-filled image of the right size installs - and the machine tries
  // to boot it. To a Z80 it is an unbroken run of NOPs, so the ROM never
  // reaches the state the machine waits for and the run fails, naming the image
  // in force. Nothing but the uploaded bytes reaching the CPU produces that.
  await uploadRom(page, 'zeros.rom', Buffer.alloc(ZX81_ROM_BYTES));
  await expect(page.getByText('Using your own ROM: zeros.rom')).toBeVisible();
  await closeSettings(page);

  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect(
    page.getByText(/didn't start on your own ROM \(zeros\.rom\)/),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('emulator: stopped')).toBeVisible();

  // 4. The choice survives a reload.
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await openRomSettings(page);
  await expect(page.getByText('Using your own ROM: zeros.rom')).toBeVisible();

  // 5. Restoring brings the real machine back - the other half of step 3.
  await page.getByRole('button', { name: 'Restore bundled ROM' }).click();
  await expect(page.getByText(/Using the bundled .* ROM/)).toBeVisible();
  await closeSettings(page);

  await setEditorSource(page, '10 PRINT "HI"');
  await playAndWaitRunning(page);
  await expect.poll(() => canvasPainted(page), { timeout: 20_000 }).toBe(true);
});

test('a machine that loads its own ROM set offers no replacement', async ({
  page,
}) => {
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await openRomSettings(page);
  // The section opens on the machine the IDE is on, which is the whole point of
  // the default - the common case needs no dropdown at all.
  await expect(page.locator('select[data-rom-machine]')).toHaveValue(
    'commodore64',
  );

  await expect(page.getByText(/loads its own ROM set/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Upload ROM image' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Restore bundled ROM' }),
  ).toHaveCount(0);
});

test('a ROM can be supplied for a machine the picker does not offer', async ({
  page,
}) => {
  // The loop this closes: the Altair's 8K BASIC ships with nobody, so the
  // picker hides the machine (see src/app/machineAvailability.ts) - and with the
  // ROM settings tied to the machine you were on, there was no way to install
  // the image that would reveal it. The dropdown is the way in.
  await forceFallbackFilePickers(page); // init script: must precede openApp
  await openApp(page);

  // Absent to begin with, on a machine that is not the Altair.
  await page.locator('button[data-target-machine]').first().click();
  await expect(
    machinePicker(page).locator('button[data-machine]').first(),
  ).toBeVisible();
  await expect(
    machinePicker(page).locator('button[data-machine="altair8800"]'),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');

  await openRomSettings(page);
  await expect(page.locator('select[data-rom-machine]')).toHaveValue('zx81');
  await page.locator('select[data-rom-machine]').selectOption('altair8800');
  await expect(
    page.getByText(/No Altair 8800 ROM ships with this IDE/),
  ).toBeVisible();
  await expect(
    page.getByText(/the Altair 8800 is not offered in the machine picker/),
  ).toBeVisible();
  // Nothing bundled means nothing to restore, so that button is not offered.
  await expect(
    page.getByRole('button', { name: 'Restore bundled ROM' }),
  ).toHaveCount(0);

  await uploadRom(page, 'altair.rom', Buffer.alloc(8192));
  await expect(page.getByText('Using your own ROM: altair.rom')).toBeVisible();
  await closeSettings(page);

  // …and the machine is now offered.
  await page.locator('button[data-target-machine]').first().click();
  await expect(
    machinePicker(page).locator('button[data-machine="altair8800"]'),
  ).toBeVisible();
});
