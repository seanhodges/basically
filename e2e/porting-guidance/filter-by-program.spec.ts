// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect, createProjectWithSample, type Page } from '../fixtures';
import { openApp, selectDialect, setEditorSource } from '../helpers';

/**
 * Narrowing the porting guide to the open program.
 *
 * The program lives in the app and the comparison tables live in the docs
 * iframe; the two only meet over postMessage, so nothing about this join
 * typechecks and only a real round trip proves it works. The unit tests cover
 * the analyser and the filters; what is automated here is that the two sides
 * actually talk, and that the program is read as the machine being ported
 * *from* rather than the one the IDE has selected - the case that only arises
 * once a port has begun, and the one that silently reports the program
 * unreadable if it is got wrong.
 */

/**
 * A Commodore program the ZX81 cannot run at all: `{clr}` and `{white}` are
 * PETSCII control codes with no ZX81 equivalent. Switching to a ZX81 therefore
 * raises the "keep my code" confirmation, and the program only reads as a
 * program in Commodore BASIC.
 */
const PROGRAM = [
  '10 PRINT "{clr}{white}HI"',
  '20 FORI=1TO10:POKE1024+I,81:NEXT',
  '30 GOTO 20',
].join('\n');

const drawerOf = (page: Page) =>
  page.getByRole('dialog', { name: 'Documentation' });

/** Open a Commodore program, then keep it while switching to a ZX81. */
async function beginPort(page: Page) {
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, PROGRAM);
  await selectDialect(page, 'zx81', 'keep my code');
}

test('keeping a program on a new machine opens the comparison, narrowed', async ({
  page,
}) => {
  await beginPort(page);

  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  const frame = drawer.frameLocator('iframe');

  // The comparison offered is the port that has just begun: from the machine
  // left, to the machine chosen.
  await expect(
    frame.getByRole('button', { name: /^Porting from:/ }),
  ).toHaveAttribute('data-target-machine', 'commodore64', { timeout: 15_000 });
  await expect(
    frame.getByRole('button', { name: /^Porting to:/ }),
  ).toHaveAttribute('data-target-machine', 'zx81');

  // Narrowed, and *not* reporting the program as unreadable - which is what a
  // guide reading it as the machine it was just moved to would say.
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible();
  await expect(frame.getByText(/cannot be read/)).toHaveCount(0);

  // The program is sized by the *target's* tokenizer, which only a real round
  // trip through the app can do - the docs bundle has no tokenizer at all. The
  // ZX81 cannot store this program's PETSCII codes, so the figure it can reach
  // is a floor and is reported as one rather than as a comfortable fit.
  const fit = frame.locator('#fit');
  await expect(fit).toContainText(/At least [\d,]+ bytes/);
  await expect(fit).toContainText(/15,360 bytes free/);
  await expect(fit).not.toContainText(/Fits/);
});

/**
 * The finding a port with no other work in it can still fail on: C64 → VIC-20
 * is the same Commodore BASIC V2 in a tenth of the memory, so every keyword
 * bucket on the page is empty and the program still will not load.
 *
 * Rides the same journey rather than opening its own: only the target machine
 * and the size of the program change.
 */
test('a program too large for the target is reported as not fitting', async ({
  page,
}) => {
  await beginPort(page);
  const frame = drawerOf(page).frameLocator('iframe');
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible({
    timeout: 15_000,
  });

  // Comfortably past the VIC-20's 3,583 bytes and comfortably inside the C64's
  // 38,911, so the same program fits the machine it was written for.
  const big = Array.from(
    { length: 240 },
    (_, i) => `${(i + 1) * 10} PRINT "PADDING PADDING PADDING"`,
  ).join('\n');
  await setEditorSource(page, big);

  await frame.getByRole('button', { name: /^Porting to:/ }).click();
  await frame
    .getByRole('dialog', { name: 'Choose a machine' })
    .locator('button[data-machine="vic20"]')
    .click();

  const fit = frame.locator('#fit');
  await expect(fit).toContainText(/Will not fit/);
  // Both figures, so a reader told it does not fit is told by how much.
  await expect(fit).toContainText(/3,583 bytes/);
});

/**
 * The two ways a port runs out of line numbers, both of which need the program
 * and the target's range to meet: the numbers as written, and the numbers a
 * split would create. Only a round trip through the app puts them together.
 */
test('line numbers the target will not take are reported', async ({ page }) => {
  await beginPort(page);
  const frame = drawerOf(page).frameLocator('iframe');
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible({
    timeout: 15_000,
  });

  // A colon-separated Commodore program numbered past the ZX81's 9,999 ceiling:
  // it must be renumbered, and the ZX81 takes one statement per line, so the
  // split adds lines on top of that.
  await setEditorSource(
    page,
    ['10 A=1:B=2', '20000 PRINT A:PRINT B'].join('\n'),
  );

  const numbers = frame.locator('#line-numbers');
  await expect(numbers).toContainText(/Must be renumbered/);
  await expect(numbers).toContainText(/1–9999/);
  await expect(numbers).toContainText(/20000/);

  // The split's own arithmetic, reported where the split is.
  await expect(frame.locator('#statement-layout')).toContainText(
    /turns 2 lines into 4/,
  );
});

test('the narrowing states what it recognised and what it holds back', async ({
  page,
}) => {
  await beginPort(page);
  const frame = drawerOf(page).frameLocator('iframe');

  // How much of the program it recognised: the commands and control codes the
  // listing above actually contains.
  await expect(
    frame.getByText(/Narrowed to your program:.*commands.*control codes/),
  ).toBeVisible({ timeout: 15_000 });
  // And what it is holding back, so an under-report is visible rather than
  // silent.
  const heldBack = frame.getByText(/other differences? for this pair/);
  await expect(heldBack).toBeVisible();

  // Narrowed, the guide reports fewer commands to rewrite than the full
  // comparison does.
  const hint = frame.getByText(/to rewrite or remove, grouped by what they do/);
  const narrowedText = (await hint.textContent()) ?? '';

  await frame.getByRole('checkbox', { name: /Show every difference/ }).check();
  await expect(heldBack).toHaveCount(0);
  await expect(hint).not.toHaveText(narrowedText);
});

test('a narrow viewport points at the comparison instead of burying the program', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await beginPort(page);

  // The documentation would cover the whole screen here, so it is offered
  // rather than imposed.
  const drawer = drawerOf(page);
  await expect(drawer).toBeHidden();
  const hint = page.getByRole('button', {
    name: /Porting guide ready for this move/,
  });
  await expect(hint).toBeVisible();

  // Acting on it opens the comparison that was offered.
  await hint.click();
  await expect(drawer).toBeVisible();
  await expect(
    drawer
      .frameLocator('iframe')
      .getByRole('button', { name: /^Porting from:/ }),
  ).toHaveAttribute('data-target-machine', 'commodore64', { timeout: 15_000 });
});

test('the indicator goes as soon as the user does anything else', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await beginPort(page);

  const hint = page.getByRole('button', {
    name: /Porting guide ready for this move/,
  });
  await expect(hint).toBeVisible();

  // Anything other than the indicator dismisses it immediately - it never
  // stands between the user and the program they have just chosen to port.
  await page.locator('.cm-content').click();
  await expect(hint).toBeHidden();

  // The comparison is still there to be opened afterwards, by any means.
  await page.getByRole('button', { name: /^Open documentation/ }).click();
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  await expect(
    drawer.frameLocator('iframe').getByRole('button', { name: /^Porting to:/ }),
  ).toHaveAttribute('data-target-machine', 'zx81', { timeout: 15_000 });
});

// Two ways the indicator goes have no browser test of their own. Escape is the
// other branch of the same `useDismiss` call whose outside-click branch the
// test above drives through the real wiring, and its hit test is unit-covered
// in src/app/useDismiss.test.ts. The self-dismissal timeout is a plain
// setTimeout, and waiting it out cost this spec ten seconds of doing nothing.

test('the indicator never appears while the documentation is already open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, PROGRAM);

  // Documentation open before the switch: the comparison it opens on is the
  // offer, so pointing at a handle that is not on screen would be nonsense.
  await page.getByRole('button', { name: /^Open documentation/ }).click();
  await expect(drawerOf(page)).toBeVisible();
  await selectDialect(page, 'zx81', 'keep my code');

  await expect(
    page.getByRole('button', { name: /Porting guide ready for this move/ }),
  ).toHaveCount(0);
});

test('loading a different program closes the comparison it was offered for', async ({
  page,
}) => {
  await beginPort(page);
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();

  // A comparison narrowed to one program says nothing true about another, so
  // starting a different one closes the documentation showing it.
  await createProjectWithSample(page, 'Hello world');
  await expect(drawer).toBeHidden();
});
