// Capability: virtual-input — openspec/specs/virtual-input/spec.md
import { test, expect, createProjectWithSample } from '../fixtures';
import { EDITOR, clearEditor, openApp, playAndWaitRunning } from '../helpers';

/**
 * Virtual keyboard & game controller.
 *
 * These drive the on-screen input with pointer events (mouse), which shares
 * the code path with touch. Real multi-touch chords, key sound, haptics,
 * device rotation and iOS gesture suppression still need a physical device -
 * manual. Rotation's layout switching is covered on Chromium by
 * e2e/shell/landscape-layout.spec.ts.
 */

test('on-screen keyboard toggles and types into the editor', async ({
  page,
}) => {
  await openApp(page);
  await clearEditor(page);
  // The single input-overlay button cycles off → keyboard → gamepad. One click
  // from the default (off) shows the keyboard.
  const toggle = page.getByTestId('input-overlay-toggle');
  await toggle.click();
  const keyH = page.locator('[data-keyid="KeyH"]');
  await expect(keyH).toBeVisible();
  await keyH.click();
  await expect(page.locator(EDITOR)).toContainText('H');
  // Advancing to the gamepad state clears the keyboard - and with the editor
  // focused the gamepad can't show either, so the overlay goes away.
  await toggle.click();
  await expect(keyH).toBeHidden();
});

test('sliding between keys follows the pointer (capture works)', async ({
  page,
}) => {
  await openApp(page);
  await clearEditor(page);
  await page.getByTestId('input-overlay-toggle').click();
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

test('game-controller overlay shows while running and takes presses', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openApp(page);
  // Needs a program to run: the editor starts empty now.
  await createProjectWithSample(page, 'Hello world');
  await playAndWaitRunning(page);
  // Cycle off → keyboard → gamepad. With the emulator the active surface the
  // gamepad overlay appears.
  const toggle = page.getByTestId('input-overlay-toggle');
  await toggle.click();
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-mode', 'gamepad');
  // D-pad arms and the primary fire button are on screen.
  await expect(page.locator('.gc-arm-up')).toBeVisible();
  const fire = page.locator('.gc-fire').first();
  await expect(fire).toBeVisible();
  // A press registers without stealing the run state.
  await fire.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
  await fire.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  await expect(page.getByText('emulator: running')).toBeVisible();
  // gamepad → off hides the overlay again.
  await toggle.click();
  await expect(page.locator('.gc-arm-up')).toBeHidden();
});
