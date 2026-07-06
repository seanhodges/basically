import { test, expect } from '../fixtures';
import { EDITOR, clearEditor, openApp, playAndWaitRunning } from './helpers';

/**
 * Test plan §4 - Virtual keyboard & game controller.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * These drive the on-screen input with pointer events (mouse), which shares
 * the code path with touch. Real multi-touch chords (4.3), key sound (4.4),
 * haptics (4.5), device rotation (4.7) and iOS gesture suppression (4.8)
 * still need a physical device - manual. 4.7's layout switching is covered
 * on Chromium by e2e/landscape-layout.spec.ts.
 */

test('4.1 on-screen keyboard toggles and types into the editor', async ({
  page,
}) => {
  await openApp(page);
  await clearEditor(page);
  await page.getByRole('button', { name: '⌨' }).click();
  const keyH = page.locator('[data-keyid="KeyH"]');
  await expect(keyH).toBeVisible();
  await keyH.click();
  await expect(page.locator(EDITOR)).toContainText('H');
  // Toggle off again.
  await page.getByRole('button', { name: '⌨' }).click();
  await expect(keyH).toBeHidden();
});

test('4.2 sliding between keys follows the pointer (capture works)', async ({
  page,
}) => {
  await openApp(page);
  await clearEditor(page);
  await page.getByRole('button', { name: '⌨' }).click();
  const keyH = page.locator('[data-keyid="KeyH"]');
  const keyJ = page.locator('[data-keyid="KeyJ"]');
  await expect(keyH).toBeVisible();
  // Outwait the editor-focus debounce (EDITOR_KB_HIDE_DELAY_MS): the ⌨ toggle
  // must not have stolen editor focus, or the keyboard silently reroutes to
  // the stopped machine here and every press below goes dead (regression
  // guard - this used to pass only by racing the debounce).
  await page.waitForTimeout(400);
  const from = await keyH.boundingBox();
  const to = await keyJ.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  // Press on H, slide to J, release - the release lands on J.
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  // No stuck key, no crash; the keyboard is still interactive.
  await keyJ.click();
  await expect(page.locator(EDITOR)).toContainText('J');
});

test('4.6 game-controller overlay shows while running and takes presses', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openApp(page);
  await playAndWaitRunning(page);
  await page.getByRole('button', { name: 'Enable game controller' }).click();
  // D-pad arms and the primary fire button are on screen.
  await expect(page.locator('.gc-arm-up')).toBeVisible();
  const fire = page.locator('.gc-fire').first();
  await expect(fire).toBeVisible();
  // A press registers without stealing the run state.
  await fire.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
  await fire.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  await expect(page.getByText('emulator: running')).toBeVisible();
  await page.getByRole('button', { name: 'Disable game controller' }).click();
  await expect(page.locator('.gc-arm-up')).toBeHidden();
});
