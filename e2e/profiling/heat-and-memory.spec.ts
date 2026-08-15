// Capability: profiling — openspec/specs/profiling/spec.md
import { test, expect } from '../fixtures';
import {
  EDITOR,
  editMenu,
  openApp,
  playAndWaitRunning,
  setEditorSource,
} from '../helpers';

/**
 * One browser journey for the profile, on one machine.
 *
 * What only a real browser can prove is that the measurements reach the screen:
 * the run loop actually arms recording and folds frames into the store, the
 * CodeMirror gutter actually paints a bar next to the hot line without losing
 * the breakpoint dot beside it, and the report actually renders the memory
 * account. Everything else is unit-level and lives there - which lines a run
 * charges is `src/dialects/lineProfiling.test.ts` over every registered machine,
 * the banding and the shares are `src/app/runProfile.test.ts`, and which buffer
 * a profile belongs to is `src/app/store.test.ts`.
 *
 * The ZX81 because it boots in a fraction of the time the Commodore and Acorn
 * ROMs take, and the gutter it draws into is the same gutter on every machine.
 *
 * Staged as one journey rather than three tests: they share a boot, and a ROM
 * boot is the expensive part.
 */

/** Line 20 does the work, line 30 jumps back; line 10 runs once and stops. */
const HOT_LOOP = '10 LET A=0\n20 LET A=A+1\n30 GOTO 20';

/** Cost bars in the combined gutter (the CSS module hashes the class name). */
function heatBars(page: import('@playwright/test').Page) {
  return page.locator('.cm-combined-gutter [class*="heatHit"]');
}

test('a run paints its cost in the gutter and reports where it went', async ({
  page,
}) => {
  test.setTimeout(90_000); // ROM boot plus enough measured frames to publish
  await openApp(page);
  await setEditorSource(page, HOT_LOOP);
  await expect(page.locator(EDITOR)).toContainText('30 GOTO 20');

  // Nothing has run, so nothing is marked - and the report says so rather than
  // showing an empty table of zeroes.
  await expect(heatBars(page)).toHaveCount(0);
  await editMenu(page, /^Run profile/);
  await expect(page.getByText('Run this program to measure it')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await playAndWaitRunning(page);

  // The run measures itself with nothing switched on: bars appear as the
  // program runs. Polled for rather than slept on - the store is published on
  // the profiler's own cadence, which is emulated time, not wall-clock time.
  await expect(heatBars(page).first()).toBeVisible({ timeout: 45_000 });

  // The hottest line is the loop's work, and the line that ran once before the
  // program reached its loop carries no bar at all.
  const barOnLine = async (lineNo: number) => {
    const box = await page
      .locator('.cm-line', { hasText: new RegExp(`^${lineNo}\\b`) })
      .first()
      .boundingBox();
    return heatBars(page).evaluateAll(
      (els, y) =>
        els.some((el) => {
          const r = el.getBoundingClientRect();
          return y >= r.top && y <= r.bottom;
        }),
      box!.y + box!.height / 2,
    );
  };
  await expect.poll(() => barOnLine(20), { timeout: 30_000 }).toBe(true);
  expect(await barOnLine(10)).toBe(false);

  // The report reads out what the gutter cannot: the shares, the memory account
  // across the run, and what the figures mean. Opened while the program is
  // still running, so the chart fills as more of the run is measured.
  await editMenu(page, /^Run profile/);
  await expect(
    page.getByRole('heading', { name: 'Where the run went' }),
  ).toBeVisible();
  await expect(page.getByText('Hottest lines')).toBeVisible();
  await expect(page.getByText('Memory across the run')).toBeVisible();
  // The chart needs two samples to be a line at all; they arrive on the
  // profiler's own cadence, so this waits for the run rather than sleeping.
  await expect(page.locator('svg[class*="chart"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Peak .* bytes of .* fitted/)).toBeVisible();
  await expect(
    page.getByText(/time inside a routine it calls is charged/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // A breakpoint on the same line: the dot and the cost bar share one gutter
  // column, and neither may hide the other. Last, because setting one on the
  // executing line pauses the run that everything above is measuring.
  const gutter = page.locator('.cm-combined-gutter');
  const hotLine = page.locator('.cm-line', { hasText: /^20\b/ }).first();
  const gutterBox = await gutter.boundingBox();
  const lineBox = await hotLine.boundingBox();
  await page.mouse.click(
    gutterBox!.x + gutterBox!.width / 2,
    lineBox!.y + lineBox!.height / 2,
  );
  await expect(
    page
      .locator('.cm-combined-gutter [class*="breakpointDot"]')
      .filter({ visible: true }),
  ).toBeVisible();
  expect(await barOnLine(20)).toBe(true);
});
