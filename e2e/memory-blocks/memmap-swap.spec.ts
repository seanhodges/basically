// Capability: memory-blocks — openspec/specs/memory-blocks/spec.md
import { test, expect, chooseTargetMachine, type Page } from '../fixtures';

/** A long-running loop so the emulator stays in the 'running' state while we
    assert the layout (the BASIC program keeps the machine busy). */
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

test('memory map swaps to the left column while the emulator runs', async ({
  page,
}) => {
  await open(page);

  // ZX Spectrum is the shipped dialect with a memory map.
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

  await page.screenshot({
    path: 'e2e/__screenshots__/memmap-running-left.png',
  });

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
