import type { MachineReport } from '../dialects/types';
import type { AiRunOutcome } from './store';

/**
 * Frames of *running* emulation to watch a freshly-started AI-checked run
 * before calling it a success. A genuine error surfaces within a handful of
 * frames; a clean program (or a game that keeps running) simply never reports
 * one. Only frames where the machine is actually up count, so a slow async boot
 * (BBC/C64) doesn't eat the window before the program runs.
 */
export const AI_CHECK_MAX_FRAMES = 150;
/** Absolute frame cap so a machine that never comes up can't poll forever. */
export const AI_CHECK_ABS_MAX_FRAMES = 600;

/** What the machine said about itself this frame, as the check sees it. */
export interface AiRunFrame {
  /** `machine.readReport()` for this frame. */
  report: MachineReport | null;
  /**
   * `machine.isProgramRunning()` for this frame, or `undefined` when the
   * machine doesn't implement it. The three defined values differ in ways the
   * rules below depend on: `false` is a machine that has taken the program and
   * finished it, `null` is one that could answer but isn't ready to, and
   * `undefined` is one that can never answer - so its runs never end in
   * `ended-ok`.
   */
  running: boolean | null | undefined;
}

/** How many frames of each kind the check has counted so far. */
export interface AiRunFrameCounts {
  /** Frames where the machine was up - it said something about itself. */
  readyFrames: number;
  /** Every frame since the check armed, however little the machine said. */
  totalFrames: number;
}

/** Either keep watching (with the counts advanced) or a verdict. */
export type AiRunVerdict =
  | ({ done: false } & AiRunFrameCounts)
  | { done: true; outcome: AiRunOutcome };

/**
 * Classify one frame of an armed post-run check.
 *
 * Pure on purpose: the caller owns the machine and the animation loop, this
 * owns the rules, and they meet over plain numbers so the rules are testable
 * without a canvas or an emulator.
 *
 * An error ends the check immediately, and so does a machine saying no program
 * is running - a machine only answers that once it has actually taken the
 * program (see `MachineEmulator.isProgramRunning`), so it can't be the prompt
 * it hasn't left yet. Otherwise the windows decide: the running window expiring
 * means the program is still going, which is a success, and the absolute cap
 * with the machine never up means it never started.
 */
export function classifyAiRunFrame(
  frame: AiRunFrame,
  counts: AiRunFrameCounts,
): AiRunVerdict {
  const { report, running } = frame;
  if (report?.isError) {
    return { done: true, outcome: { kind: 'errored', report } };
  }
  if (running === false) return { done: true, outcome: { kind: 'ended-ok' } };

  // The machine is "up" once it says anything about itself: a report, or a
  // definite answer about whether a program is running. A machine that can't
  // answer at all (`undefined`) says nothing either way, so only its report
  // counts - which is the rule the check has always used.
  const up = report !== null || running === true;
  const readyFrames = counts.readyFrames + (up ? 1 : 0);
  const totalFrames = counts.totalFrames + 1;

  if (readyFrames >= AI_CHECK_MAX_FRAMES) {
    return { done: true, outcome: { kind: 'still-running' } };
  }
  if (totalFrames >= AI_CHECK_ABS_MAX_FRAMES) {
    return {
      done: true,
      // Up at some point but never finishing is a program that kept going;
      // never up at all is a machine that never came alive.
      outcome:
        readyFrames > 0 ? { kind: 'still-running' } : { kind: 'never-started' },
    };
  }
  return { done: false, readyFrames, totalFrames };
}
