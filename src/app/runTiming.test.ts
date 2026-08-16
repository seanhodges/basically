import { describe, expect, it } from 'vitest';
import type { MachineReport } from '../dialects/types';
import {
  RunStopwatch,
  TIMING_ENDINGS,
  formatTiming,
  timingFrame,
  timingSettled,
  type PauseInterval,
  type RunTiming,
} from './runTiming';

/** A machine saying a program is running, and reporting nothing wrong. */
const RUNNING = { report: null, running: true } as const;
/** A machine that has taken the program and finished it. */
const FINISHED = { report: null, running: false } as const;
/** A machine that can never answer whether a program is running. */
const SILENT = { report: null, running: undefined } as const;

const ERROR: MachineReport = {
  isError: true,
  message: '2 Variable not found, 20:1',
  line: 20,
};

/**
 * Drive a stopwatch the way the run loop does: one reading of the run clock per
 * emulated frame, at this machine's frame rate.
 */
function runFrames(
  watch: RunStopwatch,
  count: number,
  frame: Parameters<RunStopwatch['frame']>[1],
  from = 0,
  frameHz = 50,
): number {
  let elapsed = from;
  for (let i = 0; i < count; i++) {
    elapsed += 1 / frameHz;
    watch.frame(elapsed, frame);
  }
  return elapsed;
}

describe('timing a whole run', () => {
  it('is the difference between two readings of the run clock', () => {
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 100, RUNNING); // two seconds at 50Hz
    // The mark is the frame the program was first seen running, which is the
    // first frame here, so the timing is the clock's own advance since.
    expect(watch.timing().seconds).toBeCloseTo(1.98, 5);
    expect(watch.timing().ending).toBe('running');
  });

  it('reports the same duration however fast the host ran the frames', () => {
    // The reading is the machine's own time - frames over its frame rate - so
    // nothing about the speed multiplier or the display reaches it. The two
    // stopwatches below see the same frames; only the wall clock they were fed
    // at would have differed.
    const realTime = new RunStopwatch(null, true);
    const fastForward = new RunStopwatch(null, true);
    runFrames(realTime, 250, RUNNING);
    runFrames(fastForward, 250, RUNNING);
    expect(fastForward.timing().seconds).toBeCloseTo(
      realTime.timing().seconds,
      10,
    );
  });

  it('does not charge the program for being handed over', () => {
    // The machine answers `null` while it is still being given the program -
    // typing a RUN into a Commodore's keyboard buffer takes a good fraction of
    // a second - so the start is marked when it first says a program is
    // running, not at the run clock's zero.
    const watch = new RunStopwatch(null, true);
    const injected = runFrames(watch, 50, { report: null, running: null });
    runFrames(watch, 50, RUNNING, injected);
    expect(watch.timing().seconds).toBeCloseTo(0.98, 5);
  });

  it('runs from the start of the run on a machine that never answers', () => {
    const watch = new RunStopwatch(null, false);
    runFrames(watch, 50, SILENT);
    expect(watch.timing().seconds).toBeCloseTo(1, 5);
  });
});

describe('how a timing ends', () => {
  it('ends in a finish only when the machine observed one', () => {
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 50, RUNNING);
    watch.frame(1.02, FINISHED);
    expect(watch.timing().ending).toBe('finished');
  });

  it('stops counting once the program has finished', () => {
    // The loop runs on - the machine sits at its prompt - and none of that is
    // the program's time.
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 50, RUNNING);
    watch.frame(1.02, FINISHED);
    const settled = watch.timing().seconds;
    runFrames(watch, 500, FINISHED, 1.02);
    expect(watch.timing().seconds).toBe(settled);
  });

  it('settles when the run is over, so measuring stops with it', () => {
    // What tells the run loop to stop folding frames into this run's figures.
    // The machine goes on running afterwards - it sits at its prompt - and
    // none of that is the program.
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 50, RUNNING);
    expect(watch.settled).toBe(false);
    watch.pause(20); // a pause is not settled: the user continues
    expect(watch.settled).toBe(false);
    watch.resume();
    watch.frame(1.04, FINISHED);
    expect(watch.settled).toBe(true);
  });

  it('does not settle on a machine that cannot observe a finish', () => {
    // Nothing the machine says can end the run, so measuring runs until the
    // user stops it.
    const watch = new RunStopwatch(null, false);
    runFrames(watch, 500, SILENT);
    expect(watch.settled).toBe(false);
  });

  it('ends on an error with the time up to it', () => {
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 50, RUNNING);
    // The error is what returned BASIC to its prompt, so both arrive together;
    // the error is what the ending must say, not the finish.
    watch.frame(1.02, { report: ERROR, running: false });
    expect(watch.timing().ending).toBe('errored');
    expect(watch.timing().seconds).toBeCloseTo(1, 2);
  });

  it('never reports a completion time for a run the user stopped', () => {
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 200, RUNNING);
    watch.stop();
    const timing = watch.timing();
    expect(timing.ending).toBe('stopped');
    expect(TIMING_ENDINGS[timing.ending]).toContain('stopped');
    expect(timing.ending).not.toBe('finished');
  });

  it('keeps the finish a stop cannot undo', () => {
    // Stopping a machine that is already sitting at its prompt turns off a
    // finished program; reading that as "still running when stopped" would
    // understate what was measured.
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 50, RUNNING);
    watch.frame(1.02, FINISHED);
    watch.stop();
    expect(watch.timing().ending).toBe('finished');
  });

  it('reports a program that keeps going as still running', () => {
    // Not "no result yet": a duration with `running` against it is a true
    // reading of a program that has not stopped, and is what the user is shown
    // while it runs.
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 5000, RUNNING);
    expect(watch.timing().ending).toBe('running');
    expect(watch.timing().seconds).toBeGreaterThan(90);
  });

  it('ends only on a stop or a pause where a finish cannot be observed', () => {
    const stopped = new RunStopwatch(null, false);
    runFrames(stopped, 200, SILENT);
    expect(stopped.timing().ending).toBe('running'); // nothing ended it
    stopped.stop();
    expect(stopped.timing().ending).toBe('stopped');

    const paused = new RunStopwatch(null, false);
    runFrames(paused, 200, SILENT);
    paused.pause(20);
    expect(paused.timing().ending).toBe('paused');
    expect(paused.timing().observesFinish).toBe(false);
  });

  it('still ends on an error where a finish cannot be observed', () => {
    // The Sinclairs cannot say whether a program is running, but they do report
    // what stopped it.
    const watch = new RunStopwatch(null, false);
    runFrames(watch, 50, SILENT);
    watch.frame(1.02, { report: ERROR, running: undefined });
    expect(watch.timing().ending).toBe('errored');
  });
});

describe('timingSettled', () => {
  /** The published timing of a run that reached `ending`. */
  const timing = (ending: RunTiming['ending']): RunTiming => ({
    bufferId: null,
    seconds: 1,
    ending,
    observesFinish: true,
  });

  it('reads a published timing the way the stopwatch read itself', () => {
    // The stopwatch is thrown away the moment a run settles, so everything
    // downstream asks the timing it left behind and must get the same answer.
    const watch = new RunStopwatch(null, true);
    runFrames(watch, 50, RUNNING);
    expect(timingSettled(watch.timing())).toBe(watch.settled);
    watch.frame(1.02, FINISHED);
    expect(timingSettled(watch.timing())).toBe(watch.settled);
    expect(timingSettled(watch.timing())).toBe(true);
  });

  it('counts every ending a run does not come back from', () => {
    expect(timingSettled(timing('finished'))).toBe(true);
    expect(timingSettled(timing('errored'))).toBe(true);
    expect(timingSettled(timing('stopped'))).toBe(true);
  });

  it('leaves a live or paused run unsettled', () => {
    // A pause is not an ending: the user continues and the run goes on.
    expect(timingSettled(timing('running'))).toBe(false);
    expect(timingSettled(timing('paused'))).toBe(false);
  });

  it('treats an unmeasured run as no ending at all', () => {
    // Null is what the store holds before the first run and while a fresh one
    // is being armed - nothing has ended, so nothing may be read as ended.
    expect(timingSettled(null)).toBe(false);
  });
});

describe('timing between pauses', () => {
  it('reports the stretch since the previous pause', () => {
    const watch = new RunStopwatch(null, true);
    const at = runFrames(watch, 100, RUNNING);
    const first = watch.pause(20);
    expect(first.fromStart).toBe(true);
    expect(first.seconds).toBeCloseTo(1.98, 5);

    watch.resume();
    runFrames(watch, 50, RUNNING, at);
    const second = watch.pause(40);
    expect(second.fromStart).toBe(false);
    expect(second.seconds).toBeCloseTo(1, 5);
    expect(second.line).toBe(40);
  });

  it('does not count the time a pause is examined for', () => {
    // Emulated time only advances when frames are run, and a paused session
    // runs none - so a breakpoint stared at for a minute costs the program
    // nothing. Stated as a test because it is the behaviour a user would
    // otherwise doubt.
    const watch = new RunStopwatch(null, true);
    const at = runFrames(watch, 100, RUNNING);
    watch.pause(20);
    const held = watch.timing().seconds;
    // ...a minute passes in the browser, and not one frame is run...
    watch.resume();
    const next = runFrames(watch, 10, RUNNING, at);
    expect(watch.timing().seconds).toBeCloseTo(held + 0.2, 5);
    expect(next).toBeCloseTo(at + 0.2, 5);
  });

  it('takes a pause that is on no line at all', () => {
    // The user's own pause stops the machine between frames rather than before
    // a BASIC line, so there is no line to name - and it must still hold the
    // run's ending and its elapsed time the way a breakpoint pause does.
    const watch = new RunStopwatch(null, true);
    const at = runFrames(watch, 100, RUNNING);
    const held = watch.timing().seconds;

    const interval = watch.pause(null);
    expect(interval.line).toBe(null);
    expect(watch.timing().ending).toBe('paused');
    expect(watch.settled).toBe(false);
    expect(watch.timing().seconds).toBe(held);

    watch.resume();
    expect(watch.timing().ending).toBe('running');
    runFrames(watch, 50, RUNNING, at);
    expect(watch.timing().seconds).toBeCloseTo(held + 1, 5);
  });

  it('reports an interval for every step of a line-by-line walk', () => {
    const watch = new RunStopwatch(null, true);
    let at = 0;
    const steps: PauseInterval[] = [];
    for (let i = 0; i < 4; i++) {
      at = runFrames(watch, 25, RUNNING, at);
      steps.push(watch.pause(10 + i * 10));
      watch.resume();
    }
    expect(steps.map((s) => s.line)).toEqual([10, 20, 30, 40]);
    // Half a second each, give or take the frame the first one's mark was set
    // on - each step reports what that step cost, not a running total.
    for (const step of steps) expect(step.seconds).toBeCloseTo(0.5, 1);
    expect(steps.filter((s) => s.fromStart)).toHaveLength(1);
  });

  it('marks nothing while a continue runs off a breakpointed line', () => {
    // The interval is marked where execution actually pauses, and continuing
    // off a breakpointed line deliberately does not re-trigger on it until
    // execution has left it - the behaviour `DebugStepOptions.fromLine`
    // produces. So the frames a run spends still on the line it resumed from
    // mark no interval, however breakpointed that line is.
    //
    // Which BASIC line each frame ends on. Line 20 is breakpointed and takes
    // three frames of its own, so a continue leaves two frames sitting on it.
    const TRACE = [20, 20, 20, 30, 30, 10, 20, 20, 20, 30, 10, 20];
    const breakpoints = new Set([20]);
    let armed = true; // nothing resumed from yet
    const watch = new RunStopwatch(null, true);
    const marks: PauseInterval[] = [];
    let onBreakpointedLineWithoutPausing = 0;
    let at = 0;

    for (const line of TRACE) {
      at += 1 / 50;
      watch.frame(at, RUNNING);
      const paused = armed && breakpoints.has(line);
      if (paused) {
        marks.push(watch.pause(line));
        watch.resume();
        armed = false; // continuing off this line; it re-arms on leaving it
        continue;
      }
      if (breakpoints.has(line)) onBreakpointedLineWithoutPausing++;
      if (!armed && !breakpoints.has(line)) armed = true; // execution left it
    }

    // Three genuine pauses out of seven frames spent on the breakpointed line.
    expect(marks).toHaveLength(3);
    expect(onBreakpointedLineWithoutPausing).toBe(4);
    // The first pause lands on the frame the program was first seen running,
    // so nothing had run yet; the two after it are the laps between pauses.
    expect(marks.map((m) => Number(m.seconds.toFixed(2)))).toEqual([
      0, 0.12, 0.1,
    ]);
  });

  it('keeps a pause out of the whole-run timing’s way', () => {
    // A pause is not an ending a run cannot come back from: continuing puts the
    // timing live again, and the run can still be observed to finish.
    const watch = new RunStopwatch(null, true);
    const at = runFrames(watch, 50, RUNNING);
    watch.pause(20);
    expect(watch.timing().ending).toBe('paused');
    watch.resume();
    expect(watch.timing().ending).toBe('running');
    watch.frame(at + 0.02, FINISHED);
    expect(watch.timing().ending).toBe('finished');
  });
});

describe('what the stopwatch asks the machine for', () => {
  it('reads the report only once a machine that answers says nothing is running', () => {
    // The Commodore and Acorn readers recognise an error by scanning the whole
    // screen: a thousand memory reads, which must not happen fifty times a
    // second for every run.
    let reports = 0;
    const machine = {
      isProgramRunning: () => running,
      readReport: () => {
        reports++;
        return null;
      },
    };
    let running: boolean | null = null;
    timingFrame(machine); // still being handed the program
    running = true;
    timingFrame(machine);
    expect(reports).toBe(0);

    running = false;
    expect(timingFrame(machine)).toMatchObject({ running: false });
    expect(reports).toBe(1);
  });

  it('answers with no report for a machine that has none', () => {
    // Every machine answers whether a program is running; an error report is
    // still optional, and a machine without one simply has nothing to add.
    expect(timingFrame({ isProgramRunning: () => false })).toEqual({
      report: null,
      running: false,
    });
  });
});

describe('formatTiming', () => {
  it('keeps the digit a comparison turns on', () => {
    expect(formatTiming(0.42)).toBe('0.42s');
    expect(formatTiming(9.999)).toBe('10.00s');
    expect(formatTiming(64.27)).toBe('64.3s');
  });
});
