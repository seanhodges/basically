// Capability: program-execution — openspec/specs/program-execution/spec.md
import { test, expect, createProjectWithSample } from '../fixtures';
import {
  canvasFingerprint,
  openApp,
  playAndWaitRunning,
  setEditorSource,
  stopEmulator,
} from '../helpers';

/**
 * Emulation advances at the machine's own rate measured against real time.
 *
 * This is the one fact in this area no unit test can reach. The pacing
 * arithmetic is pinned headlessly in `src/app/frameClock.test.ts` against a fake
 * clock, and every machine's frame rate in `src/dialects/frameRate.test.ts`.
 * What neither can prove is that the two are wired to a real
 * `requestAnimationFrame` firing at a real display's refresh rate - the whole
 * mechanism at issue, since the defect this guards against was a loop that ran
 * one machine frame per animation frame and so inherited the monitor's rate.
 * Headless Chromium ticks at 60Hz, where that runs a 50Hz machine at 1.2x and
 * would make each interval below 1.67s rather than 2.
 *
 * One machine only - the pacing loop is shared by every dialect. The BBC because
 * `TIME` is a centisecond counter driven by the machine's own 100Hz interrupt
 * off the CPU clock, so the program measures emulated time with the machine's
 * clock while the test measures real time with the host's.
 */

/** Emulated seconds between consecutive screen flips. */
const FLIP_SECONDS = 2;
/**
 * Flips to time. The mean over several is what makes this stable: a single
 * interval is measured between two poll hits, and a poll delayed by the other
 * worker starting a page can shift one endpoint by most of a second - which
 * against one interval is the whole margin, and against five is a fifth of it.
 */
const FLIPS = 5;
/** Poll fast: this is a stopwatch, and the default backoff reaches a second. */
const TICK = { intervals: [50], timeout: 30_000 };

// Ten emulated seconds plus a BBC boot does not fit the 30s default, and the
// whole point of the test is that those seconds are real ones.
test.setTimeout(90_000);

test('a program takes its own time in real seconds, not the display’s', async ({
  page,
}) => {
  await openApp(page);
  await createProjectWithSample(page, 'Hello world', 'bbcmicro');
  await setEditorSource(
    page,
    // Flip the whole screen between black and white on a fixed emulated period.
    // A palette remap rather than a CLS or a PRINT because it repaints every
    // pixel in one go: there is no settling, so each flip is a clean instant to
    // measure between. Physical colours 0 and 7 are steady - 8 and above flash
    // on this hardware, which would repaint continuously and defeat the point.
    // MODE 1 first because VDU 19 does nothing in the teletext mode the machine
    // boots into.
    [
      '10 MODE 1',
      '20 C=0',
      '30 T=TIME',
      `40 IF TIME-T<${FLIP_SECONDS * 100} THEN 40`,
      '50 C=7-C',
      '60 VDU 19,0,C,0,0,0',
      '70 GOTO 30',
      '',
    ].join('\n'),
  );

  await playAndWaitRunning(page);

  let print = await canvasFingerprint(page);
  const nextFlip = async () => {
    await expect
      .poll(async () => (await canvasFingerprint(page)) !== print, TICK)
      .toBe(true);
    print = await canvasFingerprint(page);
  };

  // Two changes discarded before the stopwatch starts. The first is whichever of
  // the mode switch and the opening flip the poll happened to catch - they land
  // together and which one it sees is a race - and the second gives the page a
  // flip's worth of quiet after the run started, so the opening timestamp is not
  // taken while the browser is still busy.
  await nextFlip();
  await nextFlip();

  const started = Date.now();
  for (let i = 0; i < FLIPS; i++) await nextFlip();
  const perFlip = (Date.now() - started) / 1000 / FLIPS;

  // The lower bound is the one that matters: the defect this guards against made
  // emulation run *fast*, so a short interval is how it would show up here.
  expect(perFlip).toBeGreaterThan(FLIP_SECONDS * 0.9);
  // The upper bound is loose on purpose. A single-worker runner under load can
  // fail to emulate in real time, and this test is not the place to police that
  // - a tight bound here would only ever flake.
  expect(perFlip).toBeLessThan(FLIP_SECONDS * 2.5);

  await stopEmulator(page);
});
