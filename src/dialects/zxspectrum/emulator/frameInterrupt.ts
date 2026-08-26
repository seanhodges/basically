/**
 * The frame interrupt, and the window the ULA holds it open for.
 *
 * The ULA pulls /INT low once a frame and keeps it there for 32 T-states —
 * "long enough for all instructions to have time to respond to it", as the
 * hardware documentation puts it, since the Z80 samples /INT only at the end of
 * an instruction and the longest is a few dozen cycles short of that.
 *
 * Modelling the hold rather than a single pulse matters for exactly one case,
 * and it is a case raster code lives in: a routine that has interrupts off as
 * the frame turns over and re-enables them a handful of cycles later. On real
 * hardware it still gets its interrupt; against a one-instant pulse it loses the
 * whole frame, and a frame whose handler never ran is a frame the screen effect
 * skipped. Interrupts still off when the window closes lose it, as they do on
 * the machine.
 *
 * The window is checked at instruction boundaries because that is where the Z80
 * looks. The caller supplies the frame T-state each instruction begins at, which
 * the frame loop already tracks.
 */

/**
 * T-states the ULA holds /INT low. Sourced for the 48K; the 128K's ULA is not
 * separately documented and is assumed to match, which costs nothing either way
 * - both are far longer than the instruction that could be straddling the frame
 * boundary, so what the figure decides is only how long a `DI` region may run
 * past the boundary and still catch the interrupt.
 */
export const INT_HOLD_TSTATES = 32;

export class FrameInterrupt {
  /** /INT is low and no CPU has taken it yet. */
  private pending = false;
  /** Frame T-state the ULA releases /INT at. */
  private until = 0;

  constructor(private readonly holdTStates: number = INT_HOLD_TSTATES) {}

  /** The ULA has pulled /INT low, at frame T-state `t`. */
  raise(t: number): void {
    this.pending = true;
    this.until = t + this.holdTStates;
  }

  /**
   * Whether the CPU takes the interrupt at the instruction boundary at frame
   * T-state `t`: /INT is still low and interrupts are enabled. Retires it once
   * the ULA has let go, so a `DI` region that outlasts the window loses the
   * frame's interrupt rather than collecting it late.
   */
  due(t: number, interruptsEnabled: boolean): boolean {
    if (!this.pending) return false;
    if (t >= this.until) {
      this.pending = false;
      return false;
    }
    if (!interruptsEnabled) return false;
    this.pending = false;
    return true;
  }

  reset(): void {
    this.pending = false;
    this.until = 0;
  }
}
