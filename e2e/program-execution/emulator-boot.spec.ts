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
 * Emulator: the machine picker's list, and one boot.
 *
 * Boots a machine's bundled sample and asserts the screen actually painted
 * (pixel-level check). The sample is chosen explicitly through the New-project
 * dialog: nothing is loaded implicitly any more, so without that step this would
 * run an *empty* program and still pass. Sharpness, audible sound, pitch at
 * speed and background-tab recovery need eyes/ears - manual. The debugger is
 * covered by e2e/program-execution/debug.spec.ts.
 *
 * One boot, not one per emulator wiring family. What a browser adds here is the
 * wiring between the app and the core - the canvas, the frame loop, the
 * screenshot encode - and none of that varies by machine: `EmulatorPane` calls
 * `renderTo` and nothing else. The part that does vary is what each machine
 * draws, and `src/dialects/screenPaints.test.ts` now runs every registered
 * machine's sample and checks it painted, headlessly, in about the time one boot
 * costs here. Five boots in a browser bought a fifth of that coverage for
 * twenty times the runtime.
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
 * The machine this file boots in a browser.
 *
 * Any machine would do - the app's path to the screen is the same for all of
 * them - so this is the one whose ROM boots fastest of those that also exercise
 * the screenshot download below. The per-machine matrix is not here; see the
 * header.
 */
const REPRESENTATIVES = ['zxspectrum'];

const BOOTED = MACHINES.find((m) => m.id === REPRESENTATIVES[0])!;

test(`sample boots, runs and paints - ${BOOTED.label}`, async ({ page }) => {
  test.setTimeout(90_000); // ROM boot + first frames can be slow in CI
  await openApp(page);
  await createProjectWithSample(page, 'Hello world', BOOTED.id);
  // Guard the guard: an empty editor would still boot and paint the ROM's
  // own banner on some machines, so assert the program actually arrived.
  await expect(page.locator('.cm-content')).not.toHaveText('');
  await playAndWaitRunning(page);
  // The loading overlay clears once the first frame renders; then the
  // canvas must contain more than a single flat colour.
  await expect.poll(() => canvasPainted(page), { timeout: 30_000 }).toBe(true);

  // Staged onto the machine this test already booted: the screenshot path
  // decodes the captured canvas, redraws it enlarged and encodes a PNG, none
  // of which exists outside a browser (jsdom has no canvas). The enlargement
  // arithmetic per machine is pinned in src/app/screenshot.test.ts instead.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a screenshot' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.png$/);
  const path = await file.path();
  const head = readFileSync(path).subarray(0, 8);
  expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  await stopEmulator(page);
});

/**
 * No machine, because neither assertion needs one: `EmulatorPane` renders the
 * shell and its canvas whether or not one exists, `focused` is component state
 * the canvas's own focus handlers toggle, and the Escape branch of its key
 * handler returns before it reads the machine at all.
 *
 * This used to boot one and was named for capturing keys, which it never
 * asserted. Nothing in the suite yet proves a physical key press reaches a
 * running machine - the virtual keyboard's route is covered in
 * `e2e/virtual-input/`, and the machines' own key handling in
 * `src/dialects/cursorKeys.test.ts` and `caseKeys.test.ts`, but the browser
 * half between them is a real gap rather than something this test was quietly
 * doing.
 */
test('the screen takes focus on a click and gives it back on Escape', async ({
  page,
}) => {
  await openApp(page);
  const shell = page.locator('[class*="screenShell"]');
  await page.locator('canvas').first().click();
  await expect(shell).toHaveClass(/focused/);
  await page.keyboard.press('Escape');
  await expect(shell).not.toHaveClass(/focused/);
});
