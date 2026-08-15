import type { LineCost } from '../dialects/types';

/**
 * Cycles a cycle-counting machine runs between line samples.
 *
 * The figure the C64's debugger already justifies (`DEBUG_SLICE_CYCLES`): no
 * BASIC line takes fewer cycles than this to execute, so sampling on it never
 * steps over a line transition. Shared here so the machines measure on one
 * cadence rather than each inventing its own.
 *
 * What it costs, measured per machine at 600 frames of a tight BASIC loop:
 * around +1.1ms a frame on the slowest core (the C64, 6.9 → 8.0ms) and +0.3ms
 * on the fastest (the ZX81, 0.36 → 0.65ms). Against a 20ms frame budget that is
 * affordable on every core, which is what lets recording be armed for a whole
 * run rather than for a mode the user has to choose.
 */
export const PROFILE_SLICE_CYCLES = 8;

/**
 * Per-BASIC-line cycle cost accumulated between drains, for the always-on
 * profiler.
 *
 * Shared across dialects: any machine that can say which BASIC line it is
 * executing owns one and charges the step it already runs. The contract is the
 * one {@link ../emulator/memoryActivityBuffer.MemoryActivityBuffer} carries -
 * off by default, drained by whoever armed it, null while off - so there is one
 * recording pattern to learn rather than two.
 *
 * {@link enabled}, {@link pending} and {@link slice} are public because the hot
 * path indexes them directly: the whole point is that recording costs a
 * not-taken branch when off, and a `+=` plus a compare when on.
 *
 * The machine drives it in two steps rather than one call, so that
 * {@link currentLine} is only read when a sample is actually due:
 *
 * ```ts
 * const p = this.profile;
 * if (p.enabled) {
 *   p.pending += t;
 *   if (p.pending >= p.slice) p.sample(this.currentLine());
 * }
 * ```
 */
export class LineCostRecorder {
  /** When false, the hot path must not charge. Off by default. */
  enabled = false;
  /** Cycles accrued since the last sample. */
  pending = 0;
  private costs = new Map<number, number>();

  constructor(
    /** {@link pending} at which a sample is due. */
    readonly slice: number,
  ) {}

  /**
   * Charge everything accrued since the last sample to `line`, and start the
   * next slice empty.
   *
   * A null line is time the machine spent outside any BASIC line - booting, at
   * the READY prompt, inside an INPUT wait - and is dropped rather than parked
   * on the line that ran last. Dropping it is what makes the drained figures
   * sum to the time the program's own lines were executing, and what stops a
   * program that sits waiting for a keypress reading as one enormous line.
   */
  sample(line: number | null): void {
    const spent = this.pending;
    this.pending = 0;
    if (line === null || spent <= 0) return;
    this.costs.set(line, (this.costs.get(line) ?? 0) + spent);
  }

  /**
   * Hand over what has been charged so far and start empty, or null when
   * recording is off.
   *
   * Null rather than an empty array while off, because the two mean different
   * things to the caller: nothing to measure with, versus nothing measured yet.
   */
  drain(): LineCost[] | null {
    if (!this.enabled) return null;
    const out: LineCost[] = [];
    for (const [line, cost] of this.costs) {
      out.push({ line, cost });
    }
    this.costs.clear();
    return out;
  }

  /**
   * Arm or disarm. Disarming drops what was recorded: the costs belong to
   * whoever armed the recorder, and a later run must never be handed them.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.clear();
  }

  /** Drop everything recorded, including the part-slice in flight. */
  clear(): void {
    this.costs.clear();
    this.pending = 0;
  }
}
