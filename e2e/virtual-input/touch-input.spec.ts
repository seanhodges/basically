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

  // The layered keycap prints the base legend and at most one of the machine's
  // other markings, and sizes both from the key rather than the viewport - so
  // a desktop key is the phone's key drawn larger, not the phone's key with
  // every remaining marking crammed into its corners. Both are facts about
  // laid-out boxes and a resolved container query, so only a browser has them.
  const keycaps = await page
    .locator('.vk-keycap')
    .evaluateAll((caps) =>
      caps.map(
        (cap) => cap.querySelectorAll('.vk-label:not(.vk-sym-hint)').length,
      ),
    );
  expect(Math.max(...keycaps)).toBeLessThanOrEqual(2);
  const letterSize = await keyH
    .locator('.vk-pos-center')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(letterSize).toBeGreaterThan(15);

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
  // (The slide above typed H and J once each on press and once on entry, so
  // the line reads HHJJ before the SYM taps append to it.)
  await expect(page.locator(EDITOR)).toContainText('J,3');

  // Strict characters on a machine with no lower case: the shift keycap goes,
  // and the row it stood in is not reflowed around the gap. That the key is
  // really gone from a rendered, laid-out keyboard - and that its neighbour has
  // not moved into the space - is the browser-only fact; which machine loses
  // which key stays in Vitest (src/keyboard/caseAffordance.test.ts).
  const shiftKey = page.locator('[data-keyid="Shift"]');
  // KeyZ is the first letter after the shift flank on this row, so it is the
  // key a reflow would move.
  const boxOf = async (keyId: string) => {
    const box = await page.locator(`[data-keyid="${keyId}"]`).boundingBox();
    return { x: Math.round(box!.x), width: Math.round(box!.width) };
  };
  const zBefore = await boxOf('KeyZ');
  await expect(shiftKey).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('tab', { name: 'Editor' }).click();
  await page
    .getByLabel('Strict characters (refuse what the machine cannot store)')
    .check();
  await page.getByRole('button', { name: 'Close' }).click();
  // The dialog took editor focus, and the keyboard follows that: without
  // handing it back the board is typing at the stopped machine, where the
  // shift is the machine's own key and stays. The mode is then named rather
  // than assumed - the hand-back may or may not have remounted the board.
  await page.locator(EDITOR).click({ position: { x: 6, y: 6 } });
  const modes = page.getByRole('radiogroup', { name: 'Input mode' });
  await modes.getByRole('radio', { name: 'ABC' }).click();
  await expect(shiftKey).toBeHidden();
  expect(await boxOf('KeyZ')).toEqual(zBefore);

  // Inside SYM the shift flank is the page toggle, not the shift - hiding it
  // there would take a whole page of symbols with it, on the machines that
  // have a second page (src/keyboard/caseAffordance.test.ts pins which).
  await modes.getByRole('radio', { name: 'SYM', exact: true }).click();
  await expect(shiftKey).toBeVisible();
  await modes.getByRole('radio', { name: 'ABC' }).click();
  await expect(shiftKey).toBeHidden();

  // A machine with a case lock: the BBC, whose keycaps are the capitals it
  // powers up in. The keycap *redrawing* in the other case is the browser-only
  // fact here - that locking the shift repaints twenty-six laid-out keycaps -
  // and it is the one the per-machine matrix in Vitest cannot show. Which
  // machine reaches its other case which way stays there
  // (src/dialects/caseKeys.test.ts, src/keyboard/layoutGeometry.test.ts).
  await chooseTargetMachine(page, 'bbcmicro');
  // Switching with code in the editor asks what to do with it; a fresh start
  // is what this stage wants.
  await page.getByRole('button', { name: 'Start new' }).click();
  await clearEditor(page);
  await page.waitForTimeout(400);
  const bbcA = page.locator('[data-keyid="KeyA"]');
  const legend = bbcA.locator('.vk-pos-center');
  await expect(legend).toHaveText('A');
  await bbcA.click();
  await expect(page.locator(EDITOR)).toContainText('A');

  // No keycap of its own: the lock is the shift key's second tap, as a phone
  // keyboard's is.
  await expect(page.locator('[data-keyid="CapsLock"]')).toHaveCount(0);
  const bbcShift = page.locator('[data-keyid="Shift"]');
  await bbcShift.click();
  await bbcShift.click();
  // Every letter keycap follows the lock, not just the one that was pressed.
  await expect(legend).toHaveText('a');
  await expect(page.locator('[data-keyid="KeyZ"] .vk-pos-center')).toHaveText(
    'z',
  );
  await bbcA.click();
  await expect(page.locator(EDITOR)).toContainText('Aa');

  // A further tap releases the lock, and the capitals come back.
  await bbcShift.click();
  await expect(legend).toHaveText('A');
  await bbcA.click();
  await expect(page.locator(EDITOR)).toContainText('AaA');

  // Advancing to the gamepad state clears the keyboard - and with the editor
  // focused the gamepad can't show either, so the overlay goes away.
  await toggle.click();
  await expect(bbcA).toBeHidden();
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
