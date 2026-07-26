import { test, expect, chooseTargetMachine, type Page } from './fixtures';

/**
 * The C64 memory map: opening it for the Commodore 64 dialect renders the
 * machine's regions and per-POKE markers, and the live read/write overlay
 * arms once a program runs. Complements memmap-swap.spec.ts (which covers the
 * shared left/right layout behaviour on the Spectrum).
 */

// A POKE into VIC I/O ($D020 border) and one into screen RAM ($0400), plus a
// long loop so the emulator stays 'running' while the overlay is asserted.
const SRC = '10 POKE 53280,0\n20 POKE 1024,1\n30 FOR I=1 TO 1000000\n40 NEXT I';

async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

async function setEditorSource(page: Page, source: string) {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

const memoryHost = (page: Page) => page.locator('[class*="memoryHost"]');

test('C64 memory map renders regions, POKE markers and a live overlay', async ({
  page,
}) => {
  await open(page);

  await chooseTargetMachine(page, 'commodore64');
  await setEditorSource(page, SRC);

  // The toolbar entry is gated on the dialect having a memory map, so its
  // presence confirms the C64 opted in.
  const mapButton = page.locator('button[title^="Memory map"]');
  await expect(mapButton).toBeVisible();
  await mapButton.click();
  await expect(memoryHost(page)).toBeVisible();

  // A C64-specific region band is drawn (its title carries the leaf label).
  await expect(
    page.locator('[title*="BASIC program & variables"]'),
  ).toBeVisible();

  // Both literal POKEs land in RAM/IO (not ROM), so their markers are drawn.
  await expect(page.locator('[class*="pokeMarker"]').first()).toBeVisible();

  // Run the program: the live activity overlay canvas is present and recording
  // is armed while the machine runs.
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('[class*="memoryLeft"]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('[class*="activityCanvas"]')).toBeVisible();

  await page.screenshot({ path: 'e2e/__screenshots__/memmap-c64.png' });
});
