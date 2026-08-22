import type { DebugStepOptions, DebugStepResult } from '../dialects/types';

/**
 * The frame/slice loop every stepping machine runs.
 *
 * `MachineEmulator.runFrame` and `MachineEmulator.debugStep` are the same walk
 * over the same cycle budget: a debug slice is a frame that may stop early. For
 * every `debuggable` dialect the debug path *is* the normal Play path, so
 * everything a frame does around the CPU work - the frame counter a blink
 * attribute is read off, the profiler's charge, a sound chip's catch-up, the
 * picture - is owed by a slice too. Machines used to write both walks by hand
 * and drift apart: a slice that stepped the CPU directly never reached the
 * profiler, so a measured run measured nothing; one that never caught its sound
 * chip up played a held note as silence followed by a burst of backlog; one
 * that left the frame counter alone froze every blinking character in whichever
 * half of its cycle the boot left it.
 *
 * So the walk lives here once and each machine supplies only what is its own:
 * its step, what a step owes around it, and the budget a frame is worth.
 * `src/dialects/debugEquivalence.test.ts` still proves the invariant per
 * machine, but a machine now has to go out of its way to break it.
 *
 * Not every machine drives one. A machine with no stepper - the Atom, whose
 * jsbeeb core is advanced in whole budgets and which offers no debugger - has
 * no second path to keep in step and keeps its own loop; see `atomMachine.ts`.
 */

/** What one {@link MachineLoopContract.step} did, when the cycle count alone won't say. */
export interface MachineStep {
  /** Cycles consumed, charged against the slice's budget. */
  cycles: number;
  /**
   * The CPU executed nothing: it is halted and no interrupt has woken it. The
   * loop skips the line watch (a BASIC line cannot change while nothing runs)
   * and, when {@link MachineLoopContract.idleEndsSlice} is set, ends the slice
   * owing nothing for time the CPU was never going to run.
   */
  idle?: boolean;
}

/** What a machine supplies to {@link createMachineLoop}. */
export interface MachineLoopContract {
  /**
   * Cycles one display frame is worth. A function where the machine's frame
   * length is not a constant - the Amstrad derives it from CRTC registers a
   * program can reprogram mid-run - and is then read once per slice.
   */
  readonly cyclesPerFrame: number | (() => number);
  /**
   * False while the machine cannot run at all: still booting, mid-injection,
   * disposed, or handed no firmware. Both paths then do nothing, and a slice
   * reports itself unpaused on no line. Omit where the machine is always able
   * to step.
   */
  ready?(): boolean;
  /**
   * Once at the top of every frame and every slice, before any stepping: the
   * Spectrums' one maskable interrupt per frame, the PMD 85's frame counter.
   */
  onSliceStart?(): void;
  /**
   * Advance the machine by its smallest honest step unit and return the cycles
   * it consumed - one instruction on a machine that owns its CPU, one cycle on
   * a core ticked a cycle at a time, one profiler slice on a wrapped core
   * advanced in whole budgets. `elapsed` is the cycle position within the slice
   * at which the step begins, for a machine that timestamps writes against the
   * frame (a beeper) or chases a raster.
   *
   * This is also where a step's own dues are paid, the profiler's charge above
   * all: a run the IDE performs to check an assistant answer opens no debug
   * session, so anything only the debugger did would go unmeasured.
   */
  step(elapsed: number): number | MachineStep;
  /**
   * After each step, with the cycle position the step reached: the Spectrums
   * draw every display line whose ULA fetch time has now passed, so a
   * mid-frame attribute write lands on the right scanline.
   */
  afterStep?(elapsed: number): void;
  /**
   * Once at the end of every frame and every slice, however it ended - budget
   * exhausted, CPU idle, or paused on a line: the picture, a frame counter.
   */
  onSliceEnd?(): void;
  /**
   * The BASIC line about to execute, or null when none is determinable. Read
   * only when the line watch is due, so a machine that pays to introspect pays
   * on the cadence it chose. A machine with no debugger returns null.
   */
  currentLine(): number | null;
  /**
   * Cycles between line watches. Zero (the default) watches after every step,
   * which is what a machine stepping whole instructions wants. A core ticked a
   * cycle at a time sets the cadence it can afford - `PROFILE_SLICE_CYCLES`,
   * short enough that no BASIC line passes unseen.
   */
  readonly lineWatchCycles?: number;
  /**
   * Whether an idle step ends the slice. True where nothing on the motherboard
   * will wake a HALT before the next frame's interrupt, so the CPU would
   * otherwise be stepped through the whole budget doing nothing.
   */
  readonly idleEndsSlice?: boolean;
}

export interface MachineLoop {
  /** {@link MachineEmulator.runFrame}: one whole frame, never pausing. */
  runFrame(): void;
  /** {@link MachineEmulator.debugStep}: the same frame, stopping early on a line. */
  debugStep(opts: DebugStepOptions): DebugStepResult;
  /** Drop the carried cycle debt. For a machine reset, alongside its own state. */
  reset(): void;
}

/**
 * Build the pair of paths from one contract. The machine exposes the returned
 * `runFrame`/`debugStep` as its own; a machine with no debugger simply doesn't
 * expose `debugStep`, and the seam's `typeof machine.debugStep === 'function'`
 * detection keeps working.
 */
export function createMachineLoop(contract: MachineLoopContract): MachineLoop {
  /**
   * Cycles the previous slice overran its budget by. Real emulated time, so it
   * is carried rather than dropped: a machine stepping whole instructions can
   * only ever stop past the budget, and a frame that ignored the overrun would
   * run fast by however much each frame's last instruction cost.
   */
  let debt = 0;
  const watchEvery = contract.lineWatchCycles ?? 0;

  const budget = (): number =>
    typeof contract.cyclesPerFrame === 'number'
      ? contract.cyclesPerFrame
      : contract.cyclesPerFrame();

  /**
   * One frame's worth of stepping. `opts` is null for {@link runFrame}, which
   * makes the line watch dead code on the path that never pauses.
   */
  function slice(opts: DebugStepOptions | null): DebugStepResult {
    if (contract.ready && !contract.ready())
      return { paused: false, line: null };
    contract.onSliceStart?.();

    const total = budget();
    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line doesn't re-trigger on
    // the spot but still re-pauses when the loop comes back around.
    let armed = opts === null || opts.fromLine === null;
    let elapsed = debt;
    // Watch on the first step whatever the debt, then every `watchEvery` on.
    let watched = elapsed - watchEvery;

    while (elapsed < total) {
      const outcome = contract.step(elapsed);
      const idle = typeof outcome === 'number' ? false : outcome.idle === true;
      if (idle && contract.idleEndsSlice) {
        debt = 0; // nothing is owed for time the CPU was never going to run
        break;
      }
      elapsed += typeof outcome === 'number' ? outcome : outcome.cycles;
      contract.afterStep?.(elapsed);

      if (opts === null || idle) continue;
      if (elapsed - watched < watchEvery) continue;
      watched = elapsed;
      const line = contract.currentLine();
      if (line === null) continue;
      if (opts.mode === 'step') {
        if (opts.fromLine === null || line !== opts.fromLine) {
          debt = 0; // pausing abandons the rest of the slice
          contract.onSliceEnd?.();
          return { paused: true, line };
        }
      } else {
        if (!armed && line !== opts.fromLine) armed = true;
        if (armed && opts.breakpoints.has(line)) {
          debt = 0;
          contract.onSliceEnd?.();
          return { paused: true, line };
        }
      }
    }

    if (elapsed >= total) debt = elapsed - total;
    contract.onSliceEnd?.();
    return {
      paused: false,
      line: opts === null ? null : contract.currentLine(),
    };
  }

  return {
    runFrame(): void {
      slice(null);
    },
    debugStep(opts: DebugStepOptions): DebugStepResult {
      return slice(opts);
    },
    reset(): void {
      debt = 0;
    },
  };
}
