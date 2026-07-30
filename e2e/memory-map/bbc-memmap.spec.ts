// Capability: memory-map — openspec/specs/memory-map/spec.md
import { test, expect, chooseTargetMachine, type Page } from '../fixtures';

/** A long-running loop keeps the emulator busy so the live overlay has activity
    to draw while we assert. */
const LOOP_SRC = '10 A=1\n20 GOTO 10';

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

for (const { id, label } of [
  { id: 'bbcmicro', label: 'BBC Micro' },
  { id: 'bbcmaster', label: 'BBC Master' },
  { id: 'atom', label: 'Atom' },
]) {
  test(`memory map opens for the ${label} dialect`, async ({ page }) => {
    await open(page);
    await chooseTargetMachine(page, id);

    // The toolbar toggle only renders when the dialect defines a memory map.
    const toggle = page.locator('button[title^="Memory map"]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(memoryHost(page)).toBeVisible();

    // At least one colour-coded region band renders.
    await expect(page.locator('[class*="band"]').first()).toBeVisible();

    // Run a busy loop; the map jumps to the left column with the emulator live.
    await setEditorSource(page, LOOP_SRC);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.locator('[class*="memoryLeft"]')).toBeVisible({
      timeout: 30_000,
    });
  });
}
