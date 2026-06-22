import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end checks for the step-through debugger (ZX81 / ZX80 / Spectrum):
 *
 *  1. Core flow — debugging is always on, so just set a breakpoint in the
 *     gutter; Play pauses on it, Step advances to the next BASIC line, Continue
 *     re-pauses on the breakpoint, Stop clears the session.
 *  2. The debug session survives an orientation change (a viewport flip that
 *     crosses the mobile/desktop breakpoint) — nothing is lost and Step still
 *     works afterwards.
 *  3. Capability gating — Step/Continue only show for debuggable dialects
 *     (hidden for the Commodore 64); Play/Stop show for every machine.
 *
 * Run with `npm run e2e` (Chromium is pre-installed in the managed env).
 */

/** A tight loop whose "line being executed" cycles 20 → 30 → 20, so a
    breakpoint on 20 is hit almost immediately after the ROM boots. */
const LOOP_SRC = '10 FOR I=1 TO 1000\n20 LET A=I\n30 NEXT I';

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

/** Toggle the breakpoint gutter cell on the editor row that starts with `lineNo`. */
async function toggleBreakpointOnLine(page: Page, lineNo: number) {
  const gutter = page.locator('.cm-breakpoint-gutter');
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

  // Set a breakpoint on line 20 — a red dot appears in the gutter. Debugging is
  // always armed now, so there is nothing to toggle first.
  await toggleBreakpointOnLine(page, 20);
  await expect(page.locator('.cm-breakpoint-gutter')).toContainText('●');

  // Play pauses just as line 20 starts executing.
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText('paused at line 20')).toBeVisible({
    timeout: 20_000,
  });
  // The paused BASIC line is highlighted in the editor.
  await expect(page.locator('[class*="debugCurrentLine"]')).toHaveCount(1);

  await page.screenshot({ path: 'e2e/__screenshots__/debug-paused.png' });

  // Step runs to the next BASIC line (30).
  await page.getByRole('button', { name: 'Step' }).click();
  await expect(page.getByText('paused at line 30')).toBeVisible({
    timeout: 20_000,
  });

  // Continue runs to the next breakpoint — the loop comes back round to 20.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('paused at line 20')).toBeVisible({
    timeout: 20_000,
  });

  // Stop ends the session and clears the highlight. It first asks whether to
  // clear the breakpoints — the dialog handler in open() accepts.
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
  await expect(page.getByRole('tablist')).toBeVisible(); // mobile layout active
  // ...then back to a desktop landscape viewport.
  await page.setViewportSize({ width: 1000, height: 700 });

  // The session is intact: still paused on line 20, breakpoint dot and the
  // paused-line highlight preserved.
  await expect(page.getByText('paused at line 20')).toBeVisible();
  await expect(page.locator('.cm-breakpoint-gutter')).toContainText('●');
  await expect(page.locator('[class*="debugCurrentLine"]')).toHaveCount(1);

  // And the controls still drive the (preserved) machine.
  await page.getByRole('button', { name: 'Step' }).click();
  await expect(page.getByText('paused at line 30')).toBeVisible({
    timeout: 20_000,
  });
});

test('Step/Continue are gated to debuggable dialects', async ({ page }) => {
  await open(page);
  // The Debug toggle is gone — debugging is always on.
  await expect(page.getByRole('button', { name: 'Debug' })).toHaveCount(0);

  // Default target is the ZX81 — debuggable: Step/Continue are present
  // (alongside Play/Stop, which every machine gets).
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  // The Commodore 64 wraps a core that can't single-step: no Step/Continue,
  // but Play and Stop remain.
  await page
    .locator('select.dialect-select')
    .selectOption({ label: 'Commodore 64' });
  await expect(page.getByRole('button', { name: 'Step' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

  // Switching back to a Sinclair machine brings them back.
  await page
    .locator('select.dialect-select')
    .selectOption({ label: 'Spectrum' });
  await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});
