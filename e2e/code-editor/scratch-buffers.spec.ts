// Capability: code-editor — openspec/specs/code-editor/spec.md
import { test, expect, type Page } from '../fixtures';
import {
  EDITOR,
  canvasPainted,
  openApp,
  setEditorSource,
  stopEmulator,
  waitForAutosave,
} from '../helpers';

/**
 * Scratch buffers: writing and running a snippet without touching the program.
 *
 * One journey, one machine boot, because the browser-only facts all sit on the
 * same run: the live EditorView really swapping its document when the tab
 * changes, the canvas actually painting what the *snippet* printed, and a real
 * reload proving the buffers were never persisted. Everything else about them -
 * the buffer model, the lifecycle rules, per-buffer breakpoints, which text a
 * run resolves to, and the absence of scratch buffers from autosave and the
 * project bundle - is pinned headlessly in `src/app/store.test.ts` and
 * `src/app/fileCommands.test.ts`.
 *
 * The snippet's line numbers (70/80) deliberately do not appear in the program,
 * so "paused at line 80" is only reachable if Run took the buffer on screen and
 * that buffer's own breakpoints.
 */

const PROGRAM = '10 PRINT "PROGRAM"\n20 GOTO 20';
const SNIPPET = '70 PRINT "SNIPPET"\n80 GOTO 70';

/** The breakpoint dot marker; the gutter's invisible spacer uses the same one. */
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

test('a snippet is written, run and discarded without touching the program', async ({
  page,
}) => {
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await waitForAutosave(page, 'PROGRAM');
  await toggleBreakpointOnLine(page, 20);
  await expect(breakpointDot(page)).toHaveCount(1);

  // A scratch buffer, created from the plus button's menu.
  await page.getByRole('button', { name: 'New tab' }).click();
  await page.getByRole('menuitem', { name: 'New scratch buffer' }).click();
  const scratchTab = page.getByRole('tab', { name: 'Scratch 1' });
  await expect(scratchTab).toHaveAttribute('aria-selected', 'true');
  // The one mounted EditorView really swapped its document, and the dots that
  // came with the program did not come with it.
  await expect(page.locator(EDITOR)).not.toContainText('PROGRAM');
  await expect(breakpointDot(page)).toHaveCount(0);

  await setEditorSource(page, SNIPPET);
  await toggleBreakpointOnLine(page, 80);
  await expect(breakpointDot(page)).toHaveCount(1);
  // The run control says what it would boot.
  await expect(
    page.getByRole('button', { name: '▶ Play Scratch 1' }),
  ).toBeVisible();

  // Run takes the buffer on screen: line 80 exists only in the snippet, and
  // only the snippet's breakpoints could pause on it.
  await page.getByRole('button', { name: 'Play' }).first().click();
  await expect(page.getByText('paused at line 80')).toBeVisible({
    timeout: 30_000,
  });
  // …and the snippet's PRINT really reached the screen.
  await expect.poll(() => canvasPainted(page)).toBe(true);

  // Looking at the program while the snippet is paused: it is intact, its own
  // breakpoint is back, and no line of it is marked as the paused one.
  await page.getByRole('tab', { name: 'BASIC' }).click();
  await expect(page.locator(EDITOR)).toContainText('10 PRINT "PROGRAM"');
  await expect(breakpointDot(page)).toHaveCount(1);
  await expect(page.locator('[class*="debugCurrentLine"]')).toHaveCount(0);

  await stopEmulator(page);

  // Saving still means the program: what autosave holds is the document, with
  // no trace of the snippet.
  const saved = await page.evaluate(() =>
    localStorage.getItem('mbide.autosave.doc'),
  );
  expect(saved).toContain('PROGRAM');
  expect(saved).not.toContain('SNIPPET');

  // A real reload restores the document and nothing else.
  await page.reload();
  await expect(page.locator(EDITOR)).toContainText('10 PRINT "PROGRAM"');
  await expect(page.getByRole('tab', { name: 'Scratch 1' })).toHaveCount(0);
});
