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
 *
 * Charging memory as well does not move those figures. Re-measured on the same
 * loop - which alternates between two lines, so it reads the machine's memory
 * as often as any program can - the difference is inside the noise between
 * runs: a reading is a handful of pointer loads once per BASIC line, against a
 * line sample taken every {@link PROFILE_SLICE_CYCLES} cycles.
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
  private allocated = new Map<number, number>();
  /** The line the previous sample fell in, so a change of line can be seen. */
  private lastLine: number | null = null;
  /** The in-use figure at the last line boundary, null when there is none. */
  private prevUsed: number | null = null;
  /** True once a reading has actually landed, so absence never reads as zero. */
  private sawUsed = false;

  constructor(
    /** {@link pending} at which a sample is due. */
    readonly slice: number,
    /**
     * The machine's BASIC RAM in use, or null while the figure is implausible
     * (mid-boot, mid-injection). Omitted by a machine that cannot attribute its
     * memory to a line, which then reports cycles alone.
     */
    private readonly readUsed?: () => number | null,
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
    if (line !== this.lastLine && this.readUsed) {
      this.chargeMemory(this.lastLine);
      this.lastLine = line;
    }
    if (line === null || spent <= 0) return;
    this.costs.set(line, (this.costs.get(line) ?? 0) + spent);
  }

  /**
   * Charge the memory taken since the previous reading to `from`, the line that
   * has just stopped executing, and take the next reading's baseline.
   *
   * Called at a change of line rather than on the sampling cadence, which is
   * both the moment the figure is wanted and the moment it means something: the
   * previous line's work is finished, and BASIC is between statements rather
   * than part-way through evaluating an expression on its own stacks.
   *
   * Only rises are charged. A fall is BASIC reclaiming, and reclaiming is not
   * the taking: subtracting it would report a program that builds strings and
   * lets BASIC collect them - the case this figure exists to find - as having
   * taken nothing. A fall re-baselines instead, so the same bytes are not
   * charged twice when they are taken again.
   */
  private chargeMemory(from: number | null): void {
    const used = this.readUsed!();
    if (used === null) {
      // Mid-boot or mid-injection: no figure to compare the next one against.
      this.prevUsed = null;
      return;
    }
    this.sawUsed = true;
    const prev = this.prevUsed;
    this.prevUsed = used;
    // A null `from` is memory taken outside any BASIC line, dropped for the
    // same reason its cycles are: it belongs to no line of the program.
    if (prev === null || from === null) return;
    const grew = used - prev;
    if (grew > 0) {
      this.allocated.set(from, (this.allocated.get(from) ?? 0) + grew);
    }
  }

  /**
   * Hand over what has been charged so far and start empty, or null when
   * recording is off.
   *
   * Null rather than an empty array while off, because the two mean different
   * things to the caller: nothing to measure with, versus nothing measured yet.
   *
   * `allocated` appears only once a reading has landed, and then on every entry
   * including the lines that took nothing - its presence is how the caller
   * learns the machine can attribute memory at all, so a machine that cannot
   * must be indistinguishable from one, not one reporting zeroes.
   */
  drain(): LineCost[] | null {
    if (!this.enabled) return null;
    const out: LineCost[] = [];
    // The union, because a line's last boundary can fall in a later drain than
    // its cycles did: a line still executing when one drain ends is charged its
    // memory by the first sample of the next.
    const lines = this.sawUsed
      ? new Set([...this.costs.keys(), ...this.allocated.keys()])
      : this.costs.keys();
    for (const line of lines) {
      const cost = this.costs.get(line) ?? 0;
      out.push(
        this.sawUsed
          ? { line, cost, allocated: this.allocated.get(line) ?? 0 }
          : { line, cost },
      );
    }
    this.costs.clear();
    this.allocated.clear();
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
    this.allocated.clear();
    this.pending = 0;
    // The baseline goes too: a figure read during the previous run would make
    // everything the machine did between the two runs read as one allocation.
    this.lastLine = null;
    this.prevUsed = null;
    this.sawUsed = false;
  }
}
