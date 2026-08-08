import { describe, expect, it } from 'vitest';
import { FrameClock, MAX_CATCHUP_FRAMES } from './frameClock';

/**
 * Run `clock` for `seconds` of simulated time at a fixed tick rate, returning
 * the total frames it asked for. The first tick seeds the clock and is not
 * counted, matching a real run where the loop's first animation frame carries
 * no elapsed time.
 */
function framesOverASecond(
  clock: FrameClock,
  tickHz: number,
  frameHz: number,
  speed = 1,
  seconds = 1,
): number {
  clock.advance(0, frameHz, speed); // seed
  let frames = 0;
  const ticks = tickHz * seconds;
  // Computed rather than accumulated: adding 1000/144 to itself 144 times
  // lands ~1e-12ms off a whole second, which is enough to straddle a frame
  // boundary and cost the assertions below a frame.
  for (let i = 1; i <= ticks; i++) {
    frames += clock.advance((i * 1000) / tickHz, frameHz, speed);
  }
  return frames;
}

describe('FrameClock', () => {
  it('runs the machine at its own rate, not the display refresh rate', () => {
    // The bug this exists to prevent: 60 ticks of one frame each is 60Hz.
    expect(framesOverASecond(new FrameClock(), 60, 50)).toBe(50);
    expect(framesOverASecond(new FrameClock(), 120, 50)).toBe(50);
    expect(framesOverASecond(new FrameClock(), 144, 50)).toBe(50);
    // A display slower than the machine still gets the machine's full second,
    // several frames at a time.
    expect(framesOverASecond(new FrameClock(), 30, 50)).toBe(50);
  });

  it('handles the non-integer rates real machines actually have', () => {
    // The C64's PAL frame is 50.125Hz and the Spectrum's 50.08Hz - neither
    // divides a second evenly, so a whole second lands on either side.
    for (const rate of [50.125, 50.08, 50.02, 50.32]) {
      const frames = framesOverASecond(new FrameClock(), 60, rate);
      expect(frames).toBeGreaterThanOrEqual(Math.floor(rate) - 1);
      expect(frames).toBeLessThanOrEqual(Math.ceil(rate));
    }
  });

  it('does not lose the fractional remainder over a long run', () => {
    // 50.125Hz over 9s is 451.125 frames. A clock that banked no remainder
    // would never reach a 19.95ms period from 16.67ms ticks and would sit at
    // zero; one that banked but drifted would not still be exact nine seconds
    // in. 9s rather than a whole number of frames so the assertion is not
    // decided by which side of a boundary a float lands on.
    expect(framesOverASecond(new FrameClock(), 60, 50.125, 1, 9)).toBe(451);
  });

  it('scales linearly with the speed multiplier', () => {
    expect(framesOverASecond(new FrameClock(), 60, 50, 2)).toBe(100);
    expect(framesOverASecond(new FrameClock(), 60, 50, 0.5)).toBe(25);
    expect(framesOverASecond(new FrameClock(), 60, 50, 0.25)).toBe(12);
    // The assistant's run check: 4x driven by its 20ms hidden-tab clock.
    expect(framesOverASecond(new FrameClock(), 50, 50, 4)).toBe(200);
  });

  it('advances on the first tick rather than idling', () => {
    expect(new FrameClock().advance(1000, 50, 1)).toBe(1);
  });

  it('drops the time lost to a stall instead of replaying it', () => {
    const clock = new FrameClock();
    clock.advance(0, 50, 1);
    clock.advance(20, 50, 1);
    // Five seconds hidden. Without the clamp this would be 250 frames of
    // fast-forward the moment the tab came back.
    expect(clock.advance(5020, 50, 1)).toBe(MAX_CATCHUP_FRAMES);
  });

  it('clamps in frames, so the cap scales with speed', () => {
    const clock = new FrameClock();
    clock.advance(0, 50, 8);
    expect(clock.advance(5000, 50, 8)).toBe(MAX_CATCHUP_FRAMES);
  });

  it('discards banked time on reset', () => {
    const clock = new FrameClock();
    clock.advance(0, 50, 1);
    clock.advance(15, 50, 1); // 15ms banked, under one 20ms frame
    clock.reset();
    // Reset means the next tick seeds again, so the banked 15ms is gone and
    // a 5ms tick cannot complete a frame it had almost paid for.
    expect(clock.advance(100, 50, 1)).toBe(1); // seeding tick
    expect(clock.advance(105, 50, 1)).toBe(0);
  });

  it('ignores a clock that goes backwards', () => {
    const clock = new FrameClock();
    clock.advance(1000, 50, 1);
    expect(clock.advance(500, 50, 1)).toBe(0);
    // And carries on from the new timestamp rather than owing the difference.
    expect(clock.advance(520, 50, 1)).toBe(1);
  });
});
