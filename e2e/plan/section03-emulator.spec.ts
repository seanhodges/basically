import { test, expect } from '../fixtures';
import {
  canvasPainted,
  openApp,
  playAndWaitRunning,
  selectDialect,
  stopEmulator,
} from './helpers';

/**
 * Test plan §3 - Emulator, every dialect.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * 3.1 boots every machine's bundled sample and asserts the screen actually
 * painted (pixel-level check). 3.2 (sharpness), 3.4 (audible sound), 3.5
 * (pitch at speed) and 3.7 (background-tab recovery) need eyes/ears - manual.
 * 3.6 (debugger) is covered by e2e/debug.spec.ts.
 */

/** Keep in sync with src/dialects/registry.ts - the guard test below fails
 *  with a helpful message when a machine is added or renamed. */
const MACHINES = [
  'Acorn Atom',
  'BBC Master',
  'BBC Micro',
  'Commodore 64',
  'Commodore PET',
  'Commodore VIC-20',
  'Spectrum',
  'Spectrum 128K',
  'TRS-80',
  'ZX80',
  'ZX81',
];

test('3.1 guard: automated machine list matches the Target dropdown', async ({
  page,
}) => {
  await openApp(page);
  const options = await page
    .locator('select.dialect-select option')
    .allTextContents();
  expect(
    options.sort(),
    'a machine was added/renamed - update MACHINES in section03-emulator.spec.ts',
  ).toEqual([...MACHINES].sort());
});

for (const machine of MACHINES) {
  test(`3.1 sample boots, runs and paints - ${machine}`, async ({ page }) => {
    test.setTimeout(120_000); // ROM boot + first frames can be slow in CI
    await openApp(page);
    await selectDialect(page, machine);
    await playAndWaitRunning(page);
    // The loading overlay clears once the first frame renders; then the
    // canvas must contain more than a single flat colour.
    await expect
      .poll(() => canvasPainted(page), { timeout: 30_000 })
      .toBe(true);
    await stopEmulator(page);
  });
}

test('3.3 screen focus captures keys; Escape releases it', async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page);
  await playAndWaitRunning(page);
  const shell = page.locator('[class*="screenShell"]');
  await page.locator('canvas').first().click();
  await expect(shell).toHaveClass(/focused/);
  await page.keyboard.press('Escape');
  await expect(shell).not.toHaveClass(/focused/);
  await stopEmulator(page);
});
