// Capability: virtual-input — openspec/specs/virtual-input/spec.md
import {
  test,
  expect,
  chooseTargetMachine,
  createProjectWithSample,
} from '../fixtures';
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

test('the on-screen keyboard toggles, types, and follows a sliding pointer', async ({
  page,
}) => {
  await openApp(page);
  await clearEditor(page);
  // The single input-overlay button cycles off → keyboard → gamepad. One click
  // from the default (off) shows the keyboard.
  const toggle = page.getByTestId('input-overlay-toggle');
  await toggle.click();
  const keyH = page.locator('[data-keyid="KeyH"]');
  const keyJ = page.locator('[data-keyid="KeyJ"]');
  await expect(keyH).toBeVisible();

  // Outwait the editor-focus debounce (EDITOR_KB_HIDE_DELAY_MS): the ⌨ toggle
  // must not have stolen editor focus, or the keyboard silently reroutes to
  // the stopped machine here and every press below goes dead (regression
  // guard - this used to pass only by racing the debounce).
  await page.waitForTimeout(400);
  await keyH.click();
  await expect(page.locator(EDITOR)).toContainText('H');

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

  // CURSOR mode: the 5/6/7/8 keys, where this machine prints its arrows, stop
  // typing digits and move the caret instead. The mode bar is a real radiogroup
  // in the strip, so only a browser shows that selecting it actually re-targets
  // the keycaps.
  await page
    .getByRole('radiogroup', { name: 'Input mode' })
    .getByRole('radio', { name: 'CURSOR' })
    .click();
  await page.locator('[data-keyid="Digit5"]').click(); // ← under CURSOR
  await page.locator('[data-keyid="Digit8"]').click(); // → under CURSOR
  // Neither typed its own digit, so the text is unchanged - and the caret is
  // back where it started, so the next key appends rather than inserting.
  await expect(page.locator(EDITOR)).toContainText('HJ');
  await expect(page.locator(EDITOR)).not.toContainText('5');
  await expect(page.locator(EDITOR)).not.toContainText('8');

  // SYM mode: the letter keys become the canonical symbol cells - ',' on the
  // N slot - while the digits stay live, so a list types without leaving the
  // mode. Only a browser shows the tab re-labelling and re-targeting the
  // same keycaps.
  await page
    .getByRole('radiogroup', { name: 'Input mode' })
    .getByRole('radio', { name: 'SYM', exact: true })
    .click();
  await page.locator('[data-keyid="KeyN"]').click(); // ',' under SYM
  await page.locator('[data-keyid="Digit3"]').click();
  await expect(page.locator(EDITOR)).toContainText('HJ,3');

  // Advancing to the gamepad state clears the keyboard - and with the editor
  // focused the gamepad can't show either, so the overlay goes away.
  await toggle.click();
  await expect(keyH).toBeHidden();
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

test('the function-key strip is one row of keycaps that scrolls', async ({
  page,
}) => {
  // Browser-only: the whole claim is rendered geometry. A function key is the
  // size of a letter key however many the machine has, which is a fact about
  // resolved grid tracks - a unit test sees only `spanX`, which was the same
  // number back when the keys were drawn a third of the board wide.
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  // The PMD 85 is the machine with more function keys than the board is wide -
  // src/dialects/pmd85/keyboardLayout.test.ts pins that it stays that way.
  await chooseTargetMachine(page, 'pmd85');
  await page.getByTestId('input-overlay-toggle').click();
  // The PMD 85 now has input modes too (CURSOR), so the strip opens on the mode
  // tabs and the function keys sit behind its toggle.
  await page.getByRole('button', { name: 'Show function keys' }).click();
  const strip = page.locator('.vk-fn-row');
  await expect(strip.locator('.vk-key').first()).toBeVisible();

  const boxes = await strip.locator('.vk-key').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), width: +r.width.toFixed(1) };
    }),
  );
  expect(boxes.length).toBeGreaterThan(10);
  // One row: every key shares a top edge, however many there are.
  expect(new Set(boxes.map((b) => b.top)).size).toBe(1);

  // …and each is a keycap, give or take the toggle's share of the row. A strip
  // that also carries the mode/function toggle divides a little less width than
  // the key rows do, so its keys come out just under a keycap - all of them
  // equally, which is the part that matters. Compensating would push a board's
  // worth of keys into scrolling on machines whose keys all fit.
  const keycap = await page
    .locator('.vk-row .vk-key:not(.vk-style-spacer)')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(new Set(boxes.map((b) => b.width)).size).toBe(1);
  for (const b of boxes) {
    expect(b.width).toBeLessThanOrEqual(keycap + 1);
    expect(b.width).toBeGreaterThan(keycap * 0.85);
  }

  // The keys past the edge are reachable rather than lost.
  const scroll = await strip.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  await strip.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  const last = page.locator('[data-keyid="WRK"]');
  await expect(last).toBeInViewport();
  const [stripBox, lastBox] = await Promise.all([
    strip.boundingBox(),
    last.boundingBox(),
  ]);
  expect(lastBox!.x + lastBox!.width).toBeLessThanOrEqual(
    stripBox!.x + stripBox!.width + 1,
  );
  expect(lastBox!.x).toBeGreaterThanOrEqual(stripBox!.x - 1);
});
