/**
 * Paces emulation against the wall clock.
 *
 * The run loop is driven by animation frames, which fire at the display's
 * refresh rate - 60Hz commonly, 120Hz on a recent phone or tablet, 144Hz on a
 * gaming monitor. None of those is any machine's frame rate, so running one
 * emulated frame per animation frame runs the machine at refresh/native speed:
 * 1.2x on a 60Hz screen, 2.4x on a 120Hz one. This converts elapsed real time
 * into a count of whole frames instead, so a program takes the same wall-clock
 * time to run whatever the display does.
 *
 * Frame rate and speed are passed per call rather than held, which is what lets
 * the Amstrad's CRTC-derived rate change mid-run and a live speed change take
 * effect on the next tick, with no invalidation to plumb.
 */

/**
 * Frame periods the accumulator may bank.
 *
 * A tab that stalls - backgrounded, a long synchronous load, a machine the host
 * cannot emulate in real time - comes back with a large elapsed time, and
 * running every frame of it would repay the stall as a burst of fast-forward.
 * Lost time is dropped instead: emulation falls behind and stays behind, which
 * is what running at the machine's own rate means.
 *
 * Eight rather than fewer so the assistant's 4x run check, whose hidden-tab
 * clock ticks every 20ms, stays comfortably inside the clamp.
 */
export const MAX_CATCHUP_FRAMES = 8;

export class FrameClock {
  /** Real time owed to the machine, in ms. Always < one frame period after a tick. */
  private accumulator = 0;
  /** Timestamp of the previous tick, or null before the first one. */
  private last: number | null = null;

  /**
   * Whole frames to run for the tick at `now` (a `performance.now()`-style
   * timestamp in ms). Returns 0 when the machine is already ahead of real time,
   * which is the common case on a display that refreshes faster than the
   * machine - the caller still renders, repainting the same picture.
   */
  advance(now: number, frameHz: number, speed: number): number {
    const period = 1000 / (frameHz * speed);
    // First tick of a run: there is no elapsed time to divide up yet, but a
    // fresh start should advance rather than idle.
    if (this.last === null) {
      this.last = now;
      return 1;
    }
    // A clock that went backwards (a timestamp from before a reset, or a host
    // clock adjustment) would otherwise bank negative time and stall the loop.
    this.accumulator += Math.max(0, now - this.last);
    this.last = now;
    const cap = period * MAX_CATCHUP_FRAMES;
    if (this.accumulator > cap) this.accumulator = cap;
    const frames = Math.floor(this.accumulator / period);
    this.accumulator -= frames * period;
    return frames;
  }

  /**
   * Forget the elapsed time and the last timestamp. Called whenever the loop
   * stops, so a pause - or the gap while a breakpoint is examined - is not
   * banked and replayed when it resumes.
   */
  reset(): void {
    this.accumulator = 0;
    this.last = null;
  }
}
