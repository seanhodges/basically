/**
 * The VIC-II's claim on the bus, cycle by cycle — the "bad lines".
 *
 * Every eighth raster line of the display window, the video chip needs the next
 * row of forty characters and their colours before it can draw them. It has no
 * bus of its own, so it takes the CPU's: it pulls the BA line low, the 6510
 * finishes the access it is in the middle of and then stops, and the chip reads
 * its forty columns. The CPU loses those forty cycles. Twenty-five bad lines a
 * frame comes to a thousand cycles out of a PAL frame's 19656 — five per cent of
 * everything the machine does, and the difference between a cycle-counted raster
 * effect landing where its author meant it to and drifting a band a frame.
 *
 * viciious models the fetch but not the theft: its own header says its timing is
 * placeholder and that it does not stun the CPU for bad lines. It is vendored,
 * so the arbitration lives here instead, on the adapter side of the cycle loop
 * that ticks the chips ({@link ../c64Machine.C64Machine} `tickOnce`) and is
 * therefore the one place that can decline to tick the CPU.
 *
 * **Invariant this depends on:** the adapter ticks the VIC exactly once per call
 * to {@link BadLineClock.tick}, and nothing else in the app ticks it. That is
 * what keeps {@link cycleOfLine} aligned with the chip's own idea of where it is
 * within the line, and so keeps the stolen cycles on top of the fetch they pay
 * for. The line *number* is read back from the chip rather than counted here, so
 * the two cannot drift silently, and `c64Machine.test.ts` pins the agreement
 * across a whole frame.
 *
 * Sprite fetches take cycles by the same mechanism and are not modelled: they
 * are smaller, and they depend on which sprites a program has enabled where.
 * Bad lines are the case every program pays.
 */

/** VIC-II register addresses this reads. Both are free of read side effects. */
const D011 = 0xd011;
const D012 = 0xd012;

/** Cycles in a PAL raster line. */
const CYCLES_PER_LINE = 63;

/**
 * First and last raster lines on which a bad line can occur ($30 and $F7). The
 * chip fetches nothing above or below the display window, so the CPU keeps its
 * cycles through the top and bottom borders and the vertical blank.
 */
const FIRST_DISPLAY_LINE = 0x30;
const LAST_DISPLAY_LINE = 0xf7;

/**
 * The character fetch, in viciious's cycle-within-line numbering: forty cycles
 * covering the forty columns it reads in `fetchNextRowOfCharMatrix`. Aligning
 * the stall to the vendored core's own fetch window rather than to the
 * hardware's absolute cycle numbers is what keeps the two describing the same
 * event, since the core counts from its own zero.
 */
const FETCH_FIRST_CYCLE = 15;
const FETCH_LAST_CYCLE = 54;

/** Cycles the chip takes on each bad line. */
export const CYCLES_PER_BAD_LINE = FETCH_LAST_CYCLE - FETCH_FIRST_CYCLE + 1;

/** Reads a VIC-II register directly, bypassing the CPU's memory banking. */
export type ReadVicRegister = (address: number) => number;

/**
 * Tracks where the VIC-II is within its line and frame, and answers whether it
 * has the bus this cycle.
 */
export class BadLineClock {
  /** Cycle within the raster line, 0–62, in step with the chip's own counter. */
  private cycleOfLine = 0;
  /** Raster line the chip reported at the top of the current line. */
  private raster = 0;
  /** Vertical scroll ($D011 bits 0–2), which selects the bad lines. */
  private yscroll = 0;
  /**
   * Whether this line is one the chip fetches on. Recomputed per line rather
   * than per cycle: nothing it depends on can change within a line without the
   * next line seeing it anyway.
   */
  private badLine = false;
  /**
   * Display-enable ($D011 bit 4) as it stood when the display window opened.
   * The chip decides a frame's fetching on the state of this bit at the top of
   * the window, so a program that clears it mid-screen has already missed the
   * decision and keeps paying for the frame it is in.
   */
  private displayEnabled = false;

  /**
   * Cycles surrendered to the chip since reset, counted monotonically. A caller
   * wanting a frame's worth takes the difference across the frame, which stays
   * meaningful when a debug slice ends part-way through one.
   */
  private stalled = 0;

  /** Cycles surrendered to the chip since the last {@link reset}. */
  get stalledCycles(): number {
    return this.stalled;
  }

  /** Raster line the clock last read from the chip. */
  get rasterLine(): number {
    return this.raster;
  }

  /** Back to a line boundary, for a machine that has just reset its chips. */
  reset(): void {
    this.cycleOfLine = 0;
    this.raster = 0;
    this.yscroll = 0;
    this.badLine = false;
    this.displayEnabled = false;
    this.stalled = 0;
  }

  /**
   * Advance one cycle and report whether the VIC-II holds the bus, in which case
   * the caller must not tick the CPU. Call once per emulated cycle, in the same
   * loop that ticks the chip.
   */
  tick(read: ReadVicRegister): boolean {
    if (this.cycleOfLine === 0) this.startLine(read);

    const stunned =
      this.badLine &&
      this.cycleOfLine >= FETCH_FIRST_CYCLE &&
      this.cycleOfLine <= FETCH_LAST_CYCLE;
    if (stunned) this.stalled++;

    if (++this.cycleOfLine >= CYCLES_PER_LINE) this.cycleOfLine = 0;
    return stunned;
  }

  /**
   * Read the line's position and mode from the chip and decide whether it
   * fetches on this line. `$D011` carries bit 8 of the raster line alongside the
   * scroll and display-enable bits, so one read answers all three.
   */
  private startLine(read: ReadVicRegister): void {
    const d011 = read(D011);
    this.raster = ((d011 & 0x80) << 1) | read(D012);
    this.yscroll = d011 & 0x07;

    if (this.raster === FIRST_DISPLAY_LINE) {
      this.displayEnabled = (d011 & 0x10) !== 0;
    }

    this.badLine =
      this.displayEnabled &&
      this.raster >= FIRST_DISPLAY_LINE &&
      this.raster <= LAST_DISPLAY_LINE &&
      ((this.raster - this.yscroll) & 0x07) === 0;
  }
}
