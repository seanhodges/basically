// Capability: profiling — openspec/specs/profiling/spec.md
import { test, expect } from '../fixtures';
import {
  EDITOR,
  editMenu,
  openApp,
  playAndWaitRunning,
  selectDialect,
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
  await editMenu(page, /^Profiler report/);
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

  // The marking carries the accounting: whose time the share is, and that it
  // excludes the routines the line calls. Nothing else in the editor says so.
  await expect(heatBars(page).first()).toHaveAttribute(
    'title',
    /run's time on this machine[\s\S]*charged to them/,
  );

  // The report reads out what the gutter cannot: the timing, the shares and the
  // memory account across the run. Opened while the program is still running,
  // so the chart fills as more of the run is measured.
  await editMenu(page, /^Profiler report/);
  await expect(
    page.getByRole('heading', { name: 'Profiler report' }),
  ).toBeVisible();

  // The stopwatch reaches the screen with its ending attached: the run loop
  // marks the clock and publishes a duration, and it is never shown bare. This
  // program loops forever, so "still running" is the true reading - and the
  // ZX81 cannot observe a program finishing at all, which the dialog says
  // rather than leaving a timing that never ends unexplained.
  await expect(
    page.getByText(/\d+\.\d+s of ZX81 time - the program is still running\./),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/cannot tell whether a BASIC program is still running/),
  ).toBeVisible();
  // Compute is the tab a report opens on, and the duration sits above both -
  // the memory chart is drawn against it.
  await expect(page.getByRole('tab', { name: 'Compute' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('Hottest lines')).toBeVisible();
  await expect(page.getByText('Memory use over time')).toHaveCount(0);

  // The two halves are actually separate panels, which only a browser can show:
  // clicking the tab swaps the content and leaves the timing in place.
  await page.getByRole('tab', { name: 'Memory' }).click();
  await expect(page.getByText('Hottest lines')).toHaveCount(0);
  await expect(page.getByText('Memory use over time')).toBeVisible();
  await expect(
    page.getByText(/\d+\.\d+s of ZX81 time - the program is still running\./),
  ).toBeVisible();
  // The chart needs two samples to be a line at all; they arrive on the
  // profiler's own cadence, so this waits for the run rather than sleeping.
  await expect(page.locator('svg[class*="chart"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Peak: .* \/ .* bytes/)).toBeVisible();
  // The memory account reaches the screen charged to lines, not only as a
  // chart. This loop takes no memory the ZX81's own figures can see, which is
  // the reading that must be said rather than left as a blank panel - and is a
  // different reading from no figures having been taken at all. Which line took
  // what is `src/dialects/lineProfiling.test.ts`, over every machine.
  await expect(page.getByText('Where the memory went')).toBeVisible();
  await expect(
    page.getByText('No memory was taken over this run.'),
  ).toBeVisible();
  await expect(page.getByText('No memory readings')).toHaveCount(0);
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

/**
 * A program that ends, on a machine that can see it end.
 *
 * What only a browser can prove here is the run loop's own behaviour on a real
 * machine: that the loop reaches a settled timing through the machine's actual
 * `isProgramRunning` wiring, and that measuring stops with the program rather
 * than running on while the machine sits at its prompt. No unit test reaches
 * that - the rules are pure and tested in `src/app/runTiming.test.ts`, but
 * whether the loop applies them to a booted PET is a question only this can
 * answer. The ZX81 journey above can never show it: that machine cannot observe
 * a program finishing at all.
 *
 * The PET because it is the quickest-booting machine that answers the question.
 */
const ENDS = '10 FOR I=1 TO 300\n20 NEXT I\n30 END';

test('a run that finishes stops the clock and stops measuring', async ({
  page,
}) => {
  test.setTimeout(60_000); // ROM boot, the program's own run, then the hold
  await openApp(page);
  await selectDialect(page, 'pet');
  await setEditorSource(page, ENDS);
  await playAndWaitRunning(page);

  await editMenu(page, /^Profiler report/);
  // The machine saw the program return to its prompt, so the duration is the
  // time the program takes - the one ending that may be read that way.
  const finished = page.getByText(/of PET time - the program finished\./);
  await expect(finished).toBeVisible({ timeout: 45_000 });
  const settled = await finished.textContent();

  // The emulator is still running: the machine sits at its READY prompt and
  // goes on drawing frames. None of that is the program, and the figures must
  // not grow with it. Slept rather than polled because the assertion is that
  // nothing changes - there is no observable event to wait for, and the point
  // is precisely that none arrives.
  await expect(page.getByText('emulator: running')).toBeVisible();
  await page.waitForTimeout(3000);
  expect(await finished.textContent()).toBe(settled);

  // The run control over the editor reads the same finish. Asserted here rather
  // than in `e2e/program-execution/` because this is the only place in the suite
  // with a machine that has been watched all the way to a finish - proving it
  // there would mean booting a second Commodore to reach the state this test is
  // already sitting in. Addressed by test id, never by role name: the touch
  // layout's overflow menu carries its own Play.
  await page.getByRole('button', { name: 'Close' }).click();
  await page.setViewportSize({ width: 700, height: 1000 });
  await expect(page.getByRole('tablist', { name: 'App panes' })).toBeVisible();
  await expect(page.getByTestId('fab-run')).toHaveAttribute(
    'data-state',
    'play',
  );
  // Still a live machine underneath it: the control follows the program, not
  // the emulator, which is why this is not simply the stopped state.
  await expect(page.getByText('emulator: running').first()).toBeVisible();
});
