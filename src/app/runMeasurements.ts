import type { MachineEmulator } from '../dialects/types';
import {
  PROFILE_PUBLISH_FRAMES,
  programLineNumbers,
  RunProfiler,
  type RunProfile,
} from './runProfile';
import { RunStopwatch, timingFrame, type RunTiming } from './runTiming';

/**
 * The measurements of one run, folded a frame at a time.
 *
 * The profiler and the stopwatch are built together when a run starts and
 * thrown away together when it ends, so a duration and a profile always
 * describe the same execution and can never disagree about how long it took:
 * the stopwatch reads the profiler's clock rather than keeping one of its own.
 *
 * Pure with respect to where the run is happening. The browser's run loop and
 * a headless run both fold every frame through {@link frame} and act on what
 * it says - publish, or stop measuring - so a measurement taken outside the
 * browser is the same accounting the IDE shows.
 */

/** What a machine has to answer for a frame to be folded in. */
export type MeasuredMachine = Pick<
  MachineEmulator,
  | 'drainProfile'
  | 'readMemoryStats'
  | 'setProfileRecording'
  | 'frameHz'
  | 'isProgramRunning'
  | 'readReport'
>;

/**
 * What the caller should do after a frame has been folded in.
 *
 * `settled` means the program is over and measuring has stopped with it;
 * `publish` means the profiler's publishing cadence has come round; `quiet`
 * means nothing, which is most frames.
 */
export type MeasurementStep = 'settled' | 'publish' | 'quiet';

export class RunMeasurements {
  readonly profiler: RunProfiler;
  readonly stopwatch: RunStopwatch;
  /** True once {@link frame} has reported the run settled. */
  private done = false;

  constructor(
    /** The buffer this run belongs to; a scratch buffer's id, or null. */
    bufferId: string | null,
    /** The program being measured, for the line numbers it has. */
    source: string,
  ) {
    this.profiler = new RunProfiler(bufferId, programLineNumbers(source));
    this.stopwatch = new RunStopwatch(bufferId);
  }

  /**
   * Arm the machine for this run: recording on, and whatever it charged while
   * booting discarded. Armed for every run rather than a mode the user has to
   * choose beforehand - it is only afterwards that they know they wanted the
   * run measured.
   */
  arm(machine: MeasuredMachine): void {
    machine.setProfileRecording?.(true);
    machine.drainProfile?.();
  }

  /**
   * Fold one emulated frame in: drain what the machine charged to each BASIC
   * line, sample its RAM figures on the profiler's own cadence, and advance the
   * stopwatch over the run.
   *
   * Once the program is over, measuring stops with it. The machine may run on -
   * it sits at its prompt, and a user may still be typing at it - but none of
   * that is the program, and folding it in would grow the elapsed time and the
   * memory record of a run that had ended. Recording is switched off at the
   * machine so it stops charging cycles to a line nobody is measuring.
   */
  frame(machine: MeasuredMachine): MeasurementStep {
    if (this.done) return 'quiet';
    this.profiler.frame(
      machine.drainProfile?.() ?? null,
      () => machine.readMemoryStats?.() ?? null,
      machine.frameHz,
    );
    this.stopwatch.frame(this.profiler.elapsedSeconds, timingFrame(machine));
    if (this.stopwatch.settled) {
      machine.setProfileRecording?.(false);
      this.done = true;
      return 'settled';
    }
    // Published on the profiler's cadence rather than every frame: the
    // duration is worth redrawing about twice a second, and the store is read
    // by the whole app.
    return this.profiler.frameCount % PROFILE_PUBLISH_FRAMES === 0
      ? 'publish'
      : 'quiet';
  }

  /** Whether the program has been observed to finish or to fail. */
  get settled(): boolean {
    return this.done;
  }

  /** The profile as it stands, or null when the machine has measured nothing. */
  profile(): RunProfile | null {
    return this.profiler.measured ? this.profiler.snapshot() : null;
  }

  timing(): RunTiming {
    return this.stopwatch.timing();
  }

  /**
   * The run was ended from outside - stopped, reset, torn down - so a timing
   * that has not settled on its own ends as "still running when the run was
   * stopped", which is the one thing a completion time must never be mistaken
   * for.
   */
  stop(): void {
    this.stopwatch.stop();
    this.done = true;
  }
}
