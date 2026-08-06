// Capability: program-execution — openspec/specs/program-execution/spec.md
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
 * This used to boot all thirteen machines. What each machine's ROM puts on its
 * screen is already proven headlessly, per machine, by the per-dialect
 * `emulator/<id>Machine.test.ts` and `samples.test.ts` suites under src/, which
 * boot the real ROMs and read the screen back. What a browser adds is the wiring
 * between the app and the core - the worker, the canvas, the frame loop - and
 * that is shared by whole families of machines, so it is checked once per family
 * (see REPRESENTATIVES).
 */

/** Every machine the picker offers. Keep in sync with src/dialects/registry.ts -
 *  the guard test below fails with a helpful message when a machine is added,
 *  renamed or re-identified. Ids and labels both come from the rows of the
 *  shared machine picker. Only the REPRESENTATIVES below are booted.
 *
 *  The picker offers only machines that can actually start, so a registered
 *  dialect whose ROM is missing is deliberately absent from both - the Altair,
 *  whose 8K BASIC image ships with nobody. `e2e/project-setup/new-project.spec.ts`
 *  asserts that omission from the other side. */
const MACHINES = [
  { id: 'atom', label: 'Atom' },
  { id: 'bbcmaster', label: 'BBC Master' },
  { id: 'bbcmicro', label: 'BBC Micro' },
  { id: 'commodore64', label: 'C64' },
  { id: 'cpc464', label: 'CPC 464' },
  { id: 'cpc6128', label: 'CPC 6128' },
  { id: 'pet', label: 'PET' },
  { id: 'zxspectrum', label: 'Spectrum' },
  { id: 'zxspectrum128', label: 'Spectrum 128' },
  { id: 'trs80', label: 'TRS-80' },
  { id: 'vic20', label: 'VIC-20' },
  { id: 'zx80', label: 'ZX80' },
  { id: 'zx81', label: 'ZX81' },
];

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
    'a machine was added/renamed - update MACHINES in emulator-boot.spec.ts';
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
 *  - `zxspectrum` - the self-contained Z80 machines under src/dialects/<id>/
 *    (zx80, zx81, zxspectrum128, trs80, cpc464, cpc6128).
 *  - `pet` - the shared cpu6502 core in src/emulator/ (vic20, atom).
 *  - `commodore64` - the vendored viciious core.
 *  - `bbcmicro` - the jsbeeb package (bbcmaster).
 *
 * A machine that arrives on a wiring none of these covers wants a fifth entry
 * here; one that reuses an existing core does not.
 */
const REPRESENTATIVES = ['zxspectrum', 'pet', 'commodore64', 'bbcmicro'];

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
