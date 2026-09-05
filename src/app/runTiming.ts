/**
 * Timing one run of a program: how long it took, and how the timing ended.
 *
 * A timing is a difference between two readings of the run clock the profiler
 * keeps (`RunProfiler.elapsedSeconds`), so it is the emulated machine's own time
 * on exactly the terms every other duration the IDE reports is - unaffected by
 * the speed multiplier, by the display's refresh rate, and by the host. There is
 * no second clock here, deliberately: two clocks would drift and would
 * eventually disagree in front of the user about one run.
 *
 * A duration never travels without its ending. The same number means different
 * things under each - "1.4 seconds" for a program that ran to completion is a
 * measurement, and "1.4 seconds" for one the user got bored of is not a fact
 * about the program at all - so a reading that would have to be explained is
 * never handed over bare.
 */
import type { MachineEmulator } from '../dialects/types';
import { immediateRunOutcome, type AiRunFrame } from './aiRunCheck';

/**
 * How a timing ended, or that it has not.
 *
 * `running` is not an ending but a live reading: a program that keeps going has
 * a duration worth showing at any moment, and reporting it as still running is
 * what stops that number being read as the time the program takes.
 */
export type TimingEnding =
  /** Still going; the duration is what it has taken so far. */
  | 'running'
  /** The machine observed the program finish. */
  | 'finished'
  /** The program stopped on an error. */
  | 'errored'
  /** Still running when the user stopped the run. */
  | 'stopped'
  /** Execution paused - a breakpoint, or a step. */
  | 'paused';

/**
 * Endings a run does not come back from.
 *
 * A pause is not one of them: the user continues, frames run again, and the
 * timing goes on from where it stood.
 */
const FINAL: ReadonlySet<TimingEnding> = new Set<TimingEnding>([
  'finished',
  'errored',
  'stopped',
]);

/**
 * How each ending reads, so the user and the assistant are told the same thing
 * about one run. Whole clauses, because each of them has to follow a duration
 * and make a sentence of it.
 */
export const TIMING_ENDINGS: Readonly<Record<TimingEnding, string>> = {
  running: 'the program is still running',
  finished: 'the program finished',
  errored: 'the program stopped on an error',
  stopped: 'the program was still running when the run was stopped',
  paused: 'execution paused',
};

/** The timing of the run in progress, or of the one that just ended. */
export interface RunTiming {
  /** The buffer that ran: a scratch buffer's id, or null for the program. */
  bufferId: string | null;
  /** Emulated seconds from the program starting to where the timing stands. */
  seconds: number;
  ending: TimingEnding;
}

/**
 * Whether a published timing describes a run that is over.
 *
 * The reading of `RunStopwatch.settled` that survives the stopwatch: the
 * stopwatch is thrown away the moment a run settles, so everything downstream of
 * the store asks the timing it left behind. A null timing is a run that has not
 * been measured yet, which is not an ending.
 */
export function timingSettled(timing: RunTiming | null): boolean {
  return timing !== null && FINAL.has(timing.ending);
}

/** The stretch of a debugged run between one pause and the next. */
export interface PauseInterval {
  /** Emulated seconds since the previous pause, or since the program started. */
  seconds: number;
  /** The BASIC line the run paused on. */
  line: number | null;
  /** True for the first pause of a run, where the interval runs from its start. */
  fromStart: boolean;
}

/** A machine as the stopwatch reads it. */
type TimedMachine = Pick<MachineEmulator, 'isProgramRunning' | 'readReport'>;

/**
 * What to ask the machine for when folding a frame into a timing.
 *
 * Whether a program is running is a couple of reads on every machine. A report
 * is not: the Commodore and Acorn readers recognise an error by scanning the
 * whole screen for the line BASIC printed, which is a thousand memory reads. So
 * the report is read on the frame the machine says nothing is running - an
 * error is what put BASIC back at its prompt - and on no other.
 */
export function timingFrame(machine: TimedMachine): AiRunFrame {
  const running = machine.isProgramRunning();
  return {
    report: running === false ? (machine.readReport?.() ?? null) : null,
    running,
  };
}

/**
 * A stopwatch over one run, marked at the moments that end a timing.
 *
 * Owned by the run loop alongside the profiler, and thrown away with it: a
 * timing describes one execution, so it is built when a run starts rather than
 * accumulated across several.
 *
 * Emulated time does not accrue while the debugger is paused, and that falls out
 * of the design rather than being enforced - the clock this reads only advances
 * when frames are run, and a paused session runs none. So a user who leaves a
 * breakpoint to examine it for a minute does not find that minute charged to
 * their program.
 */
export class RunStopwatch {
  /** The clock reading the program was first seen running at. */
  private startMark = 0;
  /** The reading the current interval is measured from: the last pause. */
  private pauseMark = 0;
  /** The latest reading folded in. */
  private now = 0;
  /** True once the program has been seen running, so the start is marked. */
  private marked = false;
  private sawPause = false;
  private ending: TimingEnding = 'running';

  constructor(
    /** The buffer this run belongs to; a scratch buffer's id, or null. */
    readonly bufferId: string | null,
  ) {}

  /**
   * Fold in one frame: where the run clock now stands, and what the machine
   * says about itself.
   *
   * The start is marked at the first frame the machine reports a program
   * running rather than at the run clock's zero, so the seconds a machine spends
   * being handed the program - typing a RUN into the Commodore's keyboard buffer
   * takes a good fraction of a second - are not charged to the program.
   */
  frame(elapsed: number, frame: AiRunFrame): void {
    if (FINAL.has(this.ending)) return;
    this.now = elapsed;
    if (!this.marked && frame.running === true) {
      this.marked = true;
      this.startMark = elapsed;
      if (!this.sawPause) this.pauseMark = elapsed;
    }
    if (this.ending !== 'running') return;
    const outcome = immediateRunOutcome(frame);
    if (outcome?.kind === 'errored') this.ending = 'errored';
    else if (outcome?.kind === 'ended-ok') this.ending = 'finished';
  }

  /**
   * Mark a pause of the debugged run, and report the interval since the last
   * one.
   *
   * Marked where execution actually pauses rather than where a breakpointed line
   * is reached, because those are not the same event: a breakpoint on the line
   * execution resumed from is deliberately not re-triggered until execution
   * leaves it (see `DebugStepOptions.fromLine`), so marking on the line would
   * mark at moments the user never experiences as a pause.
   */
  pause(line: number | null): PauseInterval {
    const interval: PauseInterval = {
      seconds: Math.max(0, this.now - this.pauseMark),
      line,
      fromStart: !this.sawPause,
    };
    this.pauseMark = this.now;
    this.sawPause = true;
    if (!FINAL.has(this.ending)) this.ending = 'paused';
    return interval;
  }

  /** The debugged run was continued or stepped: the timing is live again. */
  resume(): void {
    if (this.ending === 'paused') this.ending = 'running';
  }

  /**
   * The user stopped the run.
   *
   * A run already observed to finish or to fail keeps that ending: the stop that
   * follows it turned off a machine that was sitting at its prompt, and reading
   * it as "stopped while still running" would understate what was measured.
   */
  stop(): void {
    if (!FINAL.has(this.ending)) this.ending = 'stopped';
  }

  /**
   * Whether the run is over, so nothing more about it is worth measuring.
   *
   * True once the program has been observed to finish or to fail, which is what
   * tells the run loop to stop folding frames into this run's figures: the
   * machine sitting at its prompt afterwards is not the program, and counting it
   * would grow the elapsed time and the memory record of a run that had ended.
   *
   * A pause is not settled - the user continues and the run goes on.
   */
  get settled(): boolean {
    return FINAL.has(this.ending);
  }

  /** The timing as it stands, for the store and everything reading from it. */
  timing(): RunTiming {
    return {
      bufferId: this.bufferId,
      seconds: Math.max(0, this.now - this.startMark),
      ending: this.ending,
    };
  }
}

/**
 * A duration as every surface writes it.
 *
 * Two decimals under ten seconds, one above: a stopwatch is read to compare two
 * versions of a program, and rounding a 0.42s run to 0.4s throws away the digit
 * that comparison turns on. Past ten seconds that digit is noise.
 */
export function formatTiming(seconds: number): string {
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
}
