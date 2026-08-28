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
 * reload proving the buffer comes back with the document. Everything else about
 * them - the buffer model, the lifecycle rules, per-buffer breakpoints, which
 * text a run resolves to, and how buffers ride in autosave and the project
 * bundle - is pinned headlessly in `src/app/store.test.ts` and
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

test('a snippet is written, run and kept beside the program', async ({
  page,
}) => {
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await waitForAutosave(page, 'PROGRAM');
  await toggleBreakpointOnLine(page, 20);
  await expect(breakpointDot(page)).toHaveCount(1);

  // A scratch buffer, created from the plus button's menu.
  await page.getByRole('button', { name: 'Add a tab' }).click();
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

  // The document key still holds the program alone - the snippet rides in its
  // own key, which is what keeps a buffer out of what the document builds.
  // Polled, not read once: the buffer reaches storage on the 2s autosave tick.
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('mbide.autosave.scratch')),
    )
    .toContain('SNIPPET');
  const doc = await page.evaluate(() =>
    localStorage.getItem('mbide.autosave.doc'),
  );
  expect(doc).toContain('PROGRAM');
  expect(doc).not.toContain('SNIPPET');

  // A real reload brings back the program and the buffer beside it, the latter
  // with its snippet but without the breakpoint, which was session state.
  await page.reload();
  await expect(page.locator(EDITOR)).toContainText('10 PRINT "PROGRAM"');
  await page.getByRole('tab', { name: 'Scratch 1' }).click();
  await expect(page.locator(EDITOR)).toContainText('70 PRINT "SNIPPET"');
  await expect(breakpointDot(page)).toHaveCount(0);
});

/**
 * The strip fits itself to its width: what does not fit is listed by the count
 * button at its end, and the BASIC tab is never what leaves.
 *
 * Browser-only and cheap - no machine boots. The rule itself (which tabs win the
 * room, in what order, and the bound on saved files) is pinned headlessly in
 * `src/app/tabOverflow.test.ts`; what only a real browser can show is that the
 * widths driving it are the widths the strip actually lays out, and that a
 * viewport change re-runs the fit.
 */
test('tabs the strip has no room for are reachable from its count button', async ({
  page,
}) => {
  await openApp(page);
  await setEditorSource(page, PROGRAM);

  // Enough buffers that no plausible viewport fits them all.
  for (let i = 0; i < 6; i += 1) {
    await page.getByRole('button', { name: 'Add a tab' }).click();
    await page.getByRole('menuitem', { name: 'New scratch buffer' }).click();
  }
  const basic = page.getByRole('tab', { name: 'BASIC' });
  await expect(basic).toBeVisible();

  // Narrow enough that the strip has to give something up. The count button
  // names how many, which is how the assertion knows the fit ran at all.
  await page.setViewportSize({ width: 500, height: 800 });
  const overflow = page.getByRole('button', {
    name: /Show one of \d+ more tabs/,
  });
  await expect(overflow).toBeVisible();

  // Pinned: the way back to the program is never what the strip drops.
  await expect(basic).toBeVisible();

  // A tab in the overflow is not in the strip - offstage, unreachable, and not
  // announced - but the menu lists it and choosing it brings it in.
  await overflow.click();
  const menu = page.getByRole('menu', { name: 'Tabs there is no room for' });
  const firstHidden = menu.getByRole('menuitem').first();
  // The name span, not the whole item - the item leads with the kind glyph, and
  // the tab it names is found by the name alone.
  const hiddenName =
    (await firstHidden.locator('[class*="tabName"]').textContent())?.trim() ??
    '';
  expect(hiddenName).not.toBe('');
  await expect(page.getByRole('tab', { name: hiddenName })).toHaveCount(0);

  await firstHidden.click();
  await expect(page.getByRole('tab', { name: hiddenName })).toBeVisible();
  await expect(basic).toBeVisible();

  // Widening gives the room back, and the button goes with the overflow.
  await page.setViewportSize({ width: 1600, height: 800 });
  await expect(overflow).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Scratch 1' })).toBeVisible();
});
