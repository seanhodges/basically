// Capability: memory-map — openspec/specs/memory-map/spec.md
import { test, expect, chooseTargetMachine, type Page } from '../fixtures';

/**
 * The memory map as the app shows it: the regions and POKE markers a machine's
 * own map produces, and the column swap the panel performs when the emulator
 * starts.
 *
 * Two tests, on two machines, because they need different things. The C64 case
 * is about the map's *content* - a dialect that opted in, the leaf labels its
 * map declares, and a marker per literal POKE - and needs no emulator at all.
 * The Spectrum case is about *layout*, which only a real browser can measure,
 * and needs a running machine for the swap to happen.
 *
 * These were two files, and the C64 one ran the machine as well so it could
 * watch the live overlay appear - the same thing the Spectrum case observes,
 * paid for twice. The map's region tables are unit-covered across every dialect
 * in src/dialects/memoryMap.test.ts, and its sub-region detail in
 * memoryMapDetail.test.ts.
 */

// A POKE into VIC I/O ($D020 border) and one into screen RAM ($0400): two
// literal addresses in RAM/IO, so both draw a marker.
const POKE_SRC = '10 POKE 53280,0\n20 POKE 1024,1';

/** A long-running loop, so the emulator stays 'running' while layout is read. */
const LOOP_SRC = '10 FOR I=1 TO 1000000\n20 NEXT I';

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
const monitorPane = (page: Page) => page.locator('[class*="monitorPane"]');
const editorPane = (page: Page) => page.locator('[class*="editorPane"]');

test('the map draws a machine’s own regions and a marker per POKE', async ({
  page,
}) => {
  await open(page);

  await chooseTargetMachine(page, 'commodore64');
  await setEditorSource(page, POKE_SRC);

  // The toolbar entry is gated on the dialect having a memory map, so its
  // presence confirms the C64 opted in.
  const mapButton = page.locator('button[title^="Memory map"]');
  await expect(mapButton).toBeVisible();
  await mapButton.click();
  await expect(memoryHost(page)).toBeVisible();

  // A C64-specific region band is drawn (its title carries the leaf label), so
  // this is the selected machine's map and not a generic one.
  await expect(
    page.locator('[title*="BASIC program & variables"]'),
  ).toBeVisible();

  // Both literal POKEs land in RAM/IO (not ROM), so both markers are drawn.
  await expect(page.locator('[class*="pokeMarker"]')).toHaveCount(2);
});

test('the map swaps to the left column while the emulator runs', async ({
  page,
}) => {
  await open(page);

  await chooseTargetMachine(page, 'zxspectrum');
  await setEditorSource(page, LOOP_SRC);

  // Open the memory map from the toolbar.
  await page.locator('button[title^="Memory map"]').click();
  await expect(memoryHost(page)).toBeVisible();

  // Stopped: memory map on the RIGHT (shares the right slot), editor on the
  // LEFT, emulator preview hidden behind the map, no memoryLeft class.
  await expect(page.locator('[class*="memoryLeft"]')).toHaveCount(0);
  await expect(editorPane(page)).toBeVisible();
  {
    const mem = await memoryHost(page).boundingBox();
    const ed = await editorPane(page).boundingBox();
    expect(mem).not.toBeNull();
    expect(ed).not.toBeNull();
    expect(mem!.x).toBeGreaterThan(ed!.x); // memory is to the right of editor
  }

  // Run it (no breakpoint -> runs). The map should jump to the LEFT column and
  // the live emulator should appear on the right; the editor hides.
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('[class*="memoryLeft"]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(monitorPane(page)).toBeVisible(); // emulator now shown on the right
  await expect(editorPane(page)).toBeHidden(); // editor replaced by the map
  {
    const mem = await memoryHost(page).boundingBox();
    const emu = await monitorPane(page).boundingBox();
    expect(mem).not.toBeNull();
    expect(emu).not.toBeNull();
    expect(mem!.x).toBeLessThan(emu!.x); // memory is to the LEFT of the emulator
  }

  // The live read/write overlay arms with the run, in the swapped column.
  await expect(page.locator('[class*="activityCanvas"]')).toBeVisible();

  // Stop: the map returns to the right slot and the editor comes back on the left.
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('[class*="memoryLeft"]')).toHaveCount(0);
  await expect(editorPane(page)).toBeVisible();
  {
    const mem = await memoryHost(page).boundingBox();
    const ed = await editorPane(page).boundingBox();
    expect(mem!.x).toBeGreaterThan(ed!.x);
  }
});
