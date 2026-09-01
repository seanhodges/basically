// Capability: program-execution — openspec/specs/program-execution/spec.md
import { readFileSync } from 'node:fs';
import {
  test,
  expect,
  createProjectWithSample,
  machinePicker,
} from '../fixtures';
import {
  canvasPainted,
  openApp,
  playAndWaitRunning,
  stopEmulator,
} from '../helpers';
import { BOOT_MACHINES as MACHINES } from '../bootMachines';

/**
 * Emulator: the machine picker's list, and one boot per emulator wiring family.
 *
 * Boots a machine's bundled sample and asserts the screen actually painted
 * (pixel-level check). The sample is chosen explicitly through the New-project
 * dialog: nothing is loaded implicitly any more, so without that step this would
 * run an *empty* program and still pass. Sharpness, audible sound, pitch at
 * speed and background-tab recovery need eyes/ears - manual. The debugger is
 * covered by e2e/program-execution/debug.spec.ts.
 *
 * Booting every machine here would be redundant. What each machine's ROM puts on its
 * screen is already proven headlessly, per machine, by the per-dialect
 * `emulator/<id>Machine.test.ts` and `samples.test.ts` suites under src/, which
 * boot the real ROMs and read the screen back. What a browser adds is the wiring
 * between the app and the core - the worker, the canvas, the frame loop - and
 * that is shared by whole families of machines, so it is checked once per family
 * (see REPRESENTATIVES).
 */

test('guard: automated machine list matches the machine picker', async ({
  page,
}) => {
  await openApp(page);
  await page.locator('button[data-target-machine]').first().click();
  const rows = machinePicker(page).locator('button[data-machine]');
  await expect(rows.first()).toBeVisible();

  const { ids, labels } = await rows.evaluateAll((els) => ({
    ids: els.map((e) => (e as HTMLElement).dataset.machine ?? ''),
    // The name is the row's first line; the year and blurb follow it.
    labels: els.map(
      (e) =>
        e.querySelector('[class*="machineName"]')?.firstChild?.textContent ??
        '',
    ),
  }));

  const msg =
    'a machine was added/renamed - update BOOT_MACHINES in e2e/bootMachines.ts';
  expect(labels.sort(), msg).toEqual(MACHINES.map((m) => m.label).sort());
  expect(ids.sort(), msg).toEqual(MACHINES.map((m) => m.id).sort());

  // ...and the boot loop below really does boot something: a representative id
  // that no longer matches a machine would silently drop its whole family.
  expect(
    REPRESENTATIVES.filter((id) => !ids.includes(id)),
    'a representative machine is not in the picker - update REPRESENTATIVES',
  ).toEqual([]);
});

/**
 * One machine per emulator wiring family - the seam a browser actually
 * exercises. Each stands for the machines that reach their core the same way:
 *
 *  - `zxspectrum` - the self-contained Z80 machines (zx80, zx81,
 *    zxspectrum128, trs80, cpc464, cpc6128, and the MSX in src/emulator/msx/).
 *  - `pet` - the shared cpu6502 core in src/emulator/ (vic20, atom).
 *  - `commodore64` - the vendored viciious core.
 *  - `bbcmicro` - the jsbeeb package (bbcmaster).
 *  - `pmd85` - the vendored Z80 core executing 8080 object code through the
 *    shared src/emulator/i8080 layer. It earns a boot of its own rather than
 *    riding on `zxspectrum` because its interpreter is not in the address space
 *    at all: the firmware reads BASIC-G out of a ROM module through an I/O port
 *    and copies it down before a program can run, so "the ROM loaded" and "the
 *    machine can run a program" are two different facts here and only a boot
 *    proves the second. The Altair rides on this one: it is the other 8080
 *    machine through the same layer, and its interpreter is likewise copied
 *    into RAM rather than mapped.
 *
 * A machine that arrives on a wiring none of these covers wants an entry here;
 * one that reuses an existing core does not.
 */
const REPRESENTATIVES = [
  'zxspectrum',
  'pet',
  'commodore64',
  'bbcmicro',
  'pmd85',
];

for (const machine of MACHINES.filter((m) => REPRESENTATIVES.includes(m.id))) {
  test(`sample boots, runs and paints - ${machine.label}`, async ({ page }) => {
    test.setTimeout(90_000); // ROM boot + first frames can be slow in CI
    await openApp(page);
    await createProjectWithSample(page, 'Hello world', machine.id);
    // Guard the guard: an empty editor would still boot and paint the ROM's
    // own banner on some machines, so assert the program actually arrived.
    await expect(page.locator('.cm-content')).not.toHaveText('');
    await playAndWaitRunning(page);
    // The loading overlay clears once the first frame renders; then the
    // canvas must contain more than a single flat colour.
    await expect
      .poll(() => canvasPainted(page), { timeout: 30_000 })
      .toBe(true);

    // Staged onto the machine this test already booted: the screenshot path
    // decodes the captured canvas, redraws it enlarged and encodes a PNG, none
    // of which exists outside a browser (jsdom has no canvas). The enlargement
    // arithmetic per machine is pinned in src/app/screenshot.test.ts instead, so
    // this runs on one machine only. Family-independent, but free here.
    if (machine.id === REPRESENTATIVES[0]) {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Save a screenshot' }).click();
      const file = await download;
      expect(file.suggestedFilename()).toMatch(/\.png$/);
      const path = await file.path();
      const head = readFileSync(path).subarray(0, 8);
      expect([...head]).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
    }

    await stopEmulator(page);
  });
}

test('screen focus captures keys; Escape releases it', async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page);
  // Needs a program to run: the editor starts empty now.
  await createProjectWithSample(page, 'Hello world');
  await playAndWaitRunning(page);
  const shell = page.locator('[class*="screenShell"]');
  await page.locator('canvas').first().click();
  await expect(shell).toHaveClass(/focused/);
  await page.keyboard.press('Escape');
  await expect(shell).not.toHaveClass(/focused/);
  await stopEmulator(page);
});
