// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The clock that advances a machine nobody is asking anything of.
 *
 * This is the one exception to the rule the rest of the toolchain rests on -
 * that a held machine advances only when a request asks it to - and it lasts
 * exactly as long as a play channel does. Somebody is typing at the machine, so
 * the machine has to be running between their keystrokes; a machine running on
 * this clock is not one anything can measure, and `src/ops/play.ts` refuses the
 * requests that would try.
 *
 * It runs where the machine runs. On the host's thread it would jitter with
 * every other caller's I/O, and the machine would speed up and slow down
 * according to what somebody else was asking.
 *
 * Three properties are what make it keep time rather than approximately keep
 * time, and none of them is what a `setInterval` would do:
 *
 * - **The due time accumulates, the frames do not.** Each frame moves the next
 *   one's deadline on by exactly one period, so a tick delivered two
 *   milliseconds late is followed by one two milliseconds early rather than by
 *   a drift that compounds all evening.
 * - **The rate is read every tick.** `MachineEmulator.frameHz` is rarely a
 *   round number and on some machines is derived from display registers a
 *   running program can reprogram, so a cached rate plays those programs at the
 *   wrong speed.
 * - **Catching up is capped.** A thread that stalled - a garbage collection, a
 *   laptop lid - owes hundreds of frames on the next tick, and paying them all
 *   at once would run the machine at twenty times its speed and then stall
 *   again for having done so. What is past the cap is abandoned rather than
 *   owed, which is a machine that lost a moment rather than one that races.
 */

/**
 * The most frames one tick may run to catch up.
 *
 * Two frames of slack: enough that an ordinary late tick is made up
 * immediately, few enough that a stall is a visible skip rather than a burst.
 */
export const MAX_CATCH_UP_FRAMES = 3;

/** How long a tick waits when there is no machine to advance. */
const NOTHING_TO_RUN_MS = 20;

export interface PlayClockDeps {
  /** The machine's rate now, or null when no machine is up to ask. */
  frameHz(): number | null;
  /** Advance the machine one frame, folding whatever its holder folds. */
  frame(): void;
  /** Milliseconds now; monotonic. Injected so the pacing is testable. */
  now?(): number;
  /** Run this in `ms` milliseconds; the returned function cancels it. */
  schedule?(run: () => void, ms: number): () => void;
}

export interface PlayClock {
  /** Begin advancing the machine. Starting a clock that runs does nothing. */
  start(): void;
  /** Stop advancing it. The machine is where the last frame left it. */
  stop(): void;
  readonly running: boolean;
}

export function createPlayClock(deps: PlayClockDeps): PlayClock {
  const now = deps.now ?? (() => performance.now());
  const schedule =
    deps.schedule ??
    ((run, ms) => {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    });

  let cancel: (() => void) | null = null;
  /** When the next frame is owed. Zero until the clock has started. */
  let due = 0;

  const tick = (): void => {
    cancel = null;
    const hz = deps.frameHz();
    if (hz === null || !(hz > 0)) {
      // Nothing to advance, so nothing is owed: the next frame is due whenever
      // a machine turns up, not however many frames ago this one would have
      // been had one been here.
      due = now();
      cancel = schedule(tick, NOTHING_TO_RUN_MS);
      return;
    }
    const period = 1000 / hz;
    const at = now();
    let ran = 0;
    while (at >= due && ran < MAX_CATCH_UP_FRAMES) {
      deps.frame();
      due += period;
      ran++;
    }
    // Still behind having spent the cap: the frames past it are abandoned
    // rather than owed, and the next one is a period away like any other.
    if (at >= due) due = at + period;
    cancel = schedule(tick, Math.max(0, due - now()));
  };

  return {
    start() {
      if (cancel) return;
      due = now();
      // Straight into a tick rather than a period from now: the first frame of
      // a channel somebody has just been given the address of.
      tick();
    },
    stop() {
      cancel?.();
      cancel = null;
      due = 0;
    },
    get running() {
      return cancel !== null;
    },
  };
}
