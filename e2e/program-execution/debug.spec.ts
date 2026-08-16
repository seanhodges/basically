// Capability: program-execution — openspec/specs/program-execution/spec.md
import { test, expect, type Page } from '../fixtures';

/**
 * End-to-end checks for the step-through debugger:
 *
 *  1. Core flow - debugging is always on, so just set a breakpoint in the
 *     gutter; Play pauses on it, Step advances to the next BASIC line, Continue
 *     re-pauses on the breakpoint, Stop clears the session.
 *  2. The debug session survives an orientation change (a viewport flip that
 *     crosses the mobile/desktop breakpoint) - nothing is lost and Step still
 *     works afterwards. The touch viewport it flips through is also where the
 *     run control over the editor lives, so the three states it shows are
 *     checked there, on the machine this test already has booted.
 *
 * Which machines offer the controls at all is not here. That is
 * `Dialect.debuggable`, and `src/dialects/debugCapability.test.ts` crosschecks
 * it against the currentLine/debugStep pair every registered machine actually
 * implements - all fourteen of them, where this file could only afford four
 * app boots to look at the toolbar.
 *
 * Run with `npm run e2e` (Chromium is pre-installed in the managed env).
 */

/** A tight loop whose "line being executed" cycles 20 → 30 → 20, so a
    breakpoint on 20 is hit almost immediately after the ROM boots. Endless on
    purpose: a run that is left going while the tests take a breakpoint out and
    put it back must still be inside the loop when it goes back in. */
const LOOP_SRC = '10 FOR I=1 TO 1000\n20 LET A=I\n30 NEXT I\n40 GOTO 10';

/** Accept the "Discard unsaved changes?" confirm so doc swaps go through. */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

/**
 * Replace the editor contents with `source` in one insert (CodeMirror's auto
 * line-numbering only fires on real Enter keystrokes, so a pasted block lands
 * verbatim).
 */
async function setEditorSource(page: Page, source: string) {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

/** The breakpoint dot marker (a styled div in the combined gutter). The
 *  gutter's invisible spacer uses the same marker, so keep visible ones only. */
function breakpointDot(page: Page) {
  return page
    .locator('.cm-combined-gutter [class*="breakpointDot"]')
    .filter({ visible: true });
}

/** Toggle the breakpoint gutter cell on the editor row that starts with `lineNo`. */
async function toggleBreakpointOnLine(page: Page, lineNo: number) {
  const gutter = page.locator('.cm-combined-gutter');
  const line = page.locator('.cm-line', {
    hasText: new RegExp(`^${lineNo}\\b`),
  });
  const gutterBox = await gutter.boundingBox();
  const lineBox = await line.first().boundingBox();
  expect(gutterBox).not.toBeNull();
  expect(lineBox).not.toBeNull();
  await page.mouse.click(
    gutterBox!.x + gutterBox!.width / 2,
    lineBox!.y + lineBox!.height / 2,
  );
}

test('core flow: breakpoint, run-to-pause, step, continue, stop', async ({
  page,
}) => {
  await open(page);
  await setEditorSource(page, LOOP_SRC);
  await expect(page.locator('.cm-content')).toContainText('30 NEXT I');

  // Set a breakpoint on line 20 - a dot marker appears in the gutter. Debugging
  // is always armed now, so there is nothing to toggle first.
  await toggleBreakpointOnLine(page, 20);
  await expect(breakpointDot(page)).toBeVisible();

  // Play pauses just as line 20 starts executing.
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText('paused at line 20')).toBeVisible({
    timeout: 20_000,
  });
  // The paused BASIC line is highlighted in the editor.
  await expect(page.locator('[class*="debugCurrentLine"]')).toHaveCount(1);

  // Step runs to the next BASIC line (30).
  await page.getByRole('button', { name: 'Step' }).click();
  await expect(page.getByText('paused at line 30')).toBeVisible({
    timeout: 20_000,
  });

  // Continue runs to the next breakpoint - the loop comes back round to 20.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('paused at line 20')).toBeVisible({
    timeout: 20_000,
  });

  // Stop ends the session and clears the highlight. It first asks whether to
  // clear the breakpoints - the dialog handler in open() accepts.
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText(/paused at line/)).toBeHidden();
  await expect(page.locator('[class*="debugCurrentLine"]')).toHaveCount(0);
});

test('debug session survives an orientation change', async ({ page }) => {
  await open(page);
  await setEditorSource(page, LOOP_SRC);
  await toggleBreakpointOnLine(page, 20);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText('paused at line 20')).toBeVisible({
    timeout: 20_000,
  });

  // Rotate to a mobile portrait viewport (crosses the 768px breakpoint, so the
  // layout switches to the tabbed mobile mode and MobileTabBar mounts)...
  await page.setViewportSize({ width: 700, height: 1000 });
  // mobile layout active (the editor's block tab-strip is a tablist too, so
  // pick the app-pane bar by name)
  await expect(page.getByRole('tablist', { name: 'App panes' })).toBeVisible();

  // The run control over the editor is where a touch user sees the state of the
  // run, so it is only provable in a browser at a touch viewport. Addressed by
  // test id, never by role name: accessible-name matching is a substring match
  // and the overflow menu carries its own Play and Continue.
  //
  // The debugger's own pause reads as Continue, without the user having reached
  // it themselves.
  const fab = page.getByTestId('fab-run');
  await expect(fab).toHaveAttribute('data-state', 'continue');
  await expect(page.getByText('emulator: paused').first()).toBeVisible();

  // Take the breakpoint out so continuing leaves the machine running rather
  // than landing straight back on line 20, and the user's own pause is the only
  // thing that can stop it.
  await toggleBreakpointOnLine(page, 20);
  await fab.click();
  await expect(page.getByText('emulator: running').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(fab).toHaveAttribute('data-state', 'pause');

  // The pause this change adds: a running program held still from that control,
  // on no breakpoint and no BASIC line.
  await fab.click();
  await expect(page.getByText('emulator: paused').first()).toBeVisible();
  await expect(fab).toHaveAttribute('data-state', 'continue');
  await expect(page.getByText(/paused at line/)).toBeHidden();

  // And the one Continue carries that pause on too, not just a breakpoint's.
  await fab.click();
  await expect(page.getByText('emulator: running').first()).toBeVisible({
    timeout: 20_000,
  });

  // Put the breakpoint back and let the loop come round to it, so the session
  // is paused on line 20 again for the assertions after the flip back.
  await toggleBreakpointOnLine(page, 20);
  await expect(page.getByText('emulator: paused').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(fab).toHaveAttribute('data-state', 'continue');

  // ...then back to a desktop landscape viewport.
  await page.setViewportSize({ width: 1000, height: 700 });

  // The session is intact: still paused on line 20, breakpoint dot and the
  // paused-line highlight preserved.
  await expect(page.getByText('paused at line 20')).toBeVisible();
  await expect(breakpointDot(page)).toBeVisible();
  await expect(page.locator('[class*="debugCurrentLine"]')).toHaveCount(1);

  // And the controls still drive the (preserved) machine.
  await page.getByRole('button', { name: 'Step' }).click();
  await expect(page.getByText('paused at line 30')).toBeVisible({
    timeout: 20_000,
  });
});
