/**
 * ULA memory and I/O contention: the T-states the display hardware takes off
 * the CPU.
 *
 * The Spectrum's ULA and its Z80 share one bus into the lower 16K of RAM. While
 * the ULA is fetching the bytes it is about to paint it holds the CPU off, so a
 * CPU access to a contended address costs between 0 and 6 T-states more than the
 * instruction timing tables say. The pattern is fixed and repeats every eight
 * T-states across the 128 contended T-states of each of the 192 display lines:
 *
 *   offset  0 1 2 3 4 5 6 7
 *   delay   6 5 4 3 2 1 0 0
 *
 * Two consequences, and the second is the reason this exists at all.
 *
 * The CPU loses roughly a fifth of a frame, which is why BASIC - whose program
 * text, variables and workspace all live below 0x8000 - runs slower than the
 * 3.5MHz clock alone suggests.
 *
 * And every contended access lands on the same eight-T grid whatever offset it
 * begins at: delay + offset is 6 or 7 for all eight. The pattern restarts at
 * each line's first fetch, so a raster routine that touches contended memory
 * once per iteration is *phase-locked* to the line it is drawing on - its
 * timing is pulled back onto the grid on every pass, and its coloured bands
 * cannot drift relative to the lines they are meant to sit on. Without
 * contention the same routine free-runs a few per cent short of a line, and its
 * bands beat against the display instead.
 *
 * Not modelled: the +2A/+3 ULA, whose pattern is a rotation of this one and
 * which no registered machine emulates; the floating bus; and the M1 refresh
 * cycle's own contention. See also {@link ContentionClock} on the one
 * approximation this makes.
 */

/** ULA delay by T-state offset within an eight-T block of a display line. */
export const CONTENTION_PATTERN = [6, 5, 4, 3, 2, 1, 0, 0] as const;

/** One machine's display geometry, measured from the frame interrupt. */
export interface UlaTiming {
  /**
   * Frame T-state of the first contended cycle. The first pixel byte is fetched
   * one T-state later, which is where a machine's display origin comes from.
   */
  readonly firstContendedT: number;
  readonly tstatesPerLine: number;
  /** Contended T-states per display line: 32 character columns of 4 T. */
  readonly contendedTPerLine: number;
  readonly displayLines: number;
}

/** ZX Spectrum 48K: 3.5MHz, 312 lines of 224 T. */
export const ULA_48K: UlaTiming = {
  firstContendedT: 14335,
  tstatesPerLine: 224,
  contendedTPerLine: 128,
  displayLines: 192,
};

/** ZX Spectrum 128K / +2: 3.5469MHz, 311 lines of 228 T. */
export const ULA_128K: UlaTiming = {
  firstContendedT: 14361,
  tstatesPerLine: 228,
  contendedTPerLine: 128,
  displayLines: 192,
};

/**
 * T-states the ULA adds to a contended access begun at frame position `t`.
 *
 * `t` is an absolute position within the frame and never wraps, so there is no
 * modulo over the frame length here: everything past the last display line
 * falls out of the window and costs nothing, which is also what makes the
 * border and the vertical blanking free.
 */
export function memoryDelay(timing: UlaTiming, t: number): number {
  const offset = t - timing.firstContendedT;
  // True for the first 14335 T of every frame, so it goes first: this runs on
  // every bus access the CPU makes, millions a second.
  if (offset < 0) return 0;
  const line = Math.floor(offset / timing.tstatesPerLine);
  if (line >= timing.displayLines) return 0;
  const column = offset - line * timing.tstatesPerLine;
  if (column >= timing.contendedTPerLine) return 0;
  return CONTENTION_PATTERN[column & 7]!;
}

/** Whether the ULA contends the CPU for an address under the current paging. */
export type ContendedAddress = (address: number) => boolean;

/** 48K: the one 16K RAM bank the ULA shares, holding the screen. */
export const contended48K: ContendedAddress = (address) =>
  (address & 0xc000) === 0x4000;

/** M-cycle lengths, in T-states, for the accesses the bus hooks can see. */
const M1_CYCLE = 4;
const MEMORY_CYCLE = 3;

/**
 * Charges ULA contention for one machine, a bus access at a time.
 *
 * The vendored Z80 core reports only the total T-states an instruction took; it
 * cannot say *when* within that instruction each access happened. So the clock
 * keeps a believed CPU position: repositioned to the truth at every instruction
 * boundary by {@link at}, and advanced by one M-cycle per access in between.
 * That is wrong by a few T-states inside an instruction - the core's internal
 * cycles are invisible, and a prefix byte looks like a data read - but the
 * error cannot accumulate, because every contended access re-quantises the
 * position onto the ULA's eight-T grid (see the module comment). Against a 224 T
 * line it is far below what the picture can show.
 *
 * Only the CPU's own accesses come through here. The host's introspection -
 * reading the current BASIC line, the tape traps, injecting memory blocks,
 * drawing a scanline - goes to the memory object directly and is free, as it
 * must be: none of it is time the emulated machine spends.
 */
export class ContentionClock {
  /** Believed frame T-state of the next M-cycle. */
  private t = 0;
  /** Delay accrued since the last {@link take}. */
  private owed = 0;
  /** Delay charged since the last {@link reset}, for tests and diagnostics. */
  private charged = 0;

  constructor(
    private readonly timing: UlaTiming,
    private readonly contended: ContendedAddress,
  ) {}

  /**
   * Put the believed position at frame T-state `t`. Does not clear owed delay:
   * an interrupt acknowledgement pushes the return address before the frame's
   * first instruction runs, and that push is contended like any other write.
   */
  at(t: number): void {
    this.t = t;
  }

  /** An M1 opcode fetch. */
  opcode(address: number): void {
    if (this.contended(address)) this.stall();
    this.t += M1_CYCLE;
  }

  /** A data read or write. */
  memory(address: number): void {
    if (this.contended(address)) this.stall();
    this.t += MEMORY_CYCLE;
  }

  /**
   * The I/O M-cycle of an `IN` or `OUT`, four T-states long but contended in
   * four different shapes depending on whether the port address sits in
   * contended memory and whether the ULA answers it (A0 low):
   *
   *   contended, ULA      C:1 C:3
   *   contended, not ULA  C:1 C:1 C:1 C:1
   *   uncontended, ULA    N:1 C:3
   *   uncontended, not    N:4
   *
   * where C is a stall followed by that many T-states and N is the T-states
   * alone. This is the half of raster timing that `OUT 254` border effects
   * live on.
   */
  io(port: number): void {
    const onContendedBus = this.contended(port & 0xffff);
    const ula = (port & 0x0001) === 0;
    if (onContendedBus && !ula) {
      for (let cycle = 0; cycle < 4; cycle++) {
        this.stall();
        this.t += 1;
      }
      return;
    }
    if (onContendedBus) this.stall();
    this.t += 1;
    if (ula) this.stall();
    this.t += 3;
  }

  /** Delay owed since the last call, and clear it. */
  take(): number {
    const owed = this.owed;
    this.owed = 0;
    return owed;
  }

  /** Delay charged since the last {@link reset}, counted monotonically. */
  get contendedTStates(): number {
    return this.charged;
  }

  reset(): void {
    this.t = 0;
    this.owed = 0;
    this.charged = 0;
  }

  private stall(): void {
    const delay = memoryDelay(this.timing, this.t);
    this.t += delay;
    this.owed += delay;
    this.charged += delay;
  }
}
