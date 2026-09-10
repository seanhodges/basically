import { describe, expect, it } from 'vitest';
import { createPlayClock, MAX_CATCH_UP_FRAMES } from './clock';

/**
 * A virtual wall clock and the timers hanging off it.
 *
 * The pacing is the whole subject here, so real time would make every
 * assertion a tolerance and every failure a flake. `advance` moves the clock
 * and fires whatever came due on the way, which is what a machine paced
 * against wall-clock time actually experiences.
 */
function fakeTime() {
  let at = 0;
  let pending: { at: number; run: () => void } | null = null;
  return {
    now: () => at,
    schedule: (run: () => void, ms: number) => {
      pending = { at: at + ms, run };
      return () => {
        pending = null;
      };
    },
    /** Move time on by `ms`, firing every tick that falls inside it. */
    advance(ms: number) {
      const until = at + ms;
      // Bounded so a clock that schedules itself at zero cannot spin here for
      // ever if the pacing is broken; the assertions catch that as a count.
      for (let guard = 0; guard < 100_000; guard++) {
        if (!pending || pending.at > until) break;
        // Never backwards: a tick that came due during a stall fires at the
        // time the thread actually got to it, which is what made it late.
        at = Math.max(at, pending.at);
        const due = pending;
        pending = null;
        due.run();
      }
      at = until;
    },
    /** Move the clock without firing anything: the thread was not there. */
    stall(ms: number) {
      at += ms;
    },
  };
}

describe('the clock a played machine runs on', () => {
  it('keeps time on a machine whose rate is not a round number', () => {
    // The Sinclair machines run at 50.080128Hz, which no fixed interval hits.
    const time = fakeTime();
    let frames = 0;
    const clock = createPlayClock({
      frameHz: () => 50.080128205128204,
      frame: () => frames++,
      now: time.now,
      schedule: time.schedule,
    });
    clock.start();
    time.advance(10_000);
    clock.stop();
    // Ten seconds of a 50.08Hz machine is 501 frames; a clock that had rounded
    // the rate to 50 or to 20ms a frame would be out by five by now.
    expect(frames).toBe(501);
  });

  it('follows a machine whose rate changes mid-run', () => {
    // The CPC's rate comes from display registers a running program may
    // reprogram, so the rate at the first frame is not a promise about the
    // hundredth.
    const time = fakeTime();
    let hz = 50;
    let frames = 0;
    const clock = createPlayClock({
      frameHz: () => hz,
      frame: () => frames++,
      now: time.now,
      schedule: time.schedule,
    });
    clock.start();
    time.advance(1000);
    expect(frames).toBe(51);
    hz = 100;
    time.advance(1000);
    // A second at twice the rate: the frame already owed at the old period
    // lands first, so ninety-nine follow it. A clock that had cached 50Hz
    // would have run fifty.
    expect(frames - 51).toBe(99);
    clock.stop();
  });

  it('does not pay back a stall in a burst of catch-up frames', () => {
    const time = fakeTime();
    let frames = 0;
    const clock = createPlayClock({
      frameHz: () => 50,
      frame: () => frames++,
      now: time.now,
      schedule: time.schedule,
    });
    clock.start();
    expect(frames).toBe(1);
    // Five seconds during which the thread was not running at all: 250 frames
    // are owed and the cap is what stops them arriving together.
    time.stall(5000);
    time.advance(0);
    expect(frames - 1).toBeLessThanOrEqual(MAX_CATCH_UP_FRAMES);
    // And the machine goes on at its own rate rather than racing to make the
    // lost time up over the seconds that follow.
    const after = frames;
    time.advance(1000);
    expect(frames - after).toBe(50);
    clock.stop();
  });

  it('advances nothing while no machine is up, and nothing once stopped', () => {
    const time = fakeTime();
    let frames = 0;
    let hz: number | null = null;
    const clock = createPlayClock({
      frameHz: () => hz,
      frame: () => frames++,
      now: time.now,
      schedule: time.schedule,
    });
    clock.start();
    time.advance(1000);
    expect(frames).toBe(0);
    // A machine turning up is not a debt for the second it was not there.
    hz = 50;
    time.advance(1000);
    expect(frames).toBeLessThanOrEqual(51);
    clock.stop();
    expect(clock.running).toBe(false);
    const settled = frames;
    time.advance(1000);
    expect(frames).toBe(settled);
  });
});
