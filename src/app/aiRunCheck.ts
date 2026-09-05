import type { MachineReport } from '../dialects/types';
import type { ExpectationResult } from '../ai/expectations';
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

/**
 * Emulation speed multiplier while a check is armed.
 *
 * Nobody is watching a check run, so it need not be held to real time. The
 * windows above are counted in frames rather than seconds so that this can be
 * raised without moving a rule: at 1x the absolute cap is twelve seconds per
 * attempt, and an answer can take three attempts.
 *
 * Four rather than more because the check reads the machine after every frame
 * and a settled verdict ends the run, so going faster buys little.
 */
export const AI_CHECK_SPEED = 4;

/**
 * Milliseconds between ticks when a check is armed in a tab the user has
 * switched away from.
 *
 * Browsers stop delivering animation frames to a background tab, which for an
 * ordinary run is exactly right - a paused game is what the user expects to come
 * back to. For a check it is not: the assistant is waiting on a verdict, and one
 * that can never arrive leaves the whole conversation stuck on a machine nobody
 * is watching. So a check, and only a check, falls back to a clock the browser
 * still fires.
 */
export const AI_CHECK_HIDDEN_TICK_MS = 20;

/**
 * Whether a run should open a step-through debug session.
 *
 * A check never does, and that is not a nicety. `debuggable` is a property of
 * the machine rather than of whether the user is debugging right now, so a check
 * that inherited it would pause on any breakpoint the user happens to have set -
 * and a paused loop stops advancing frames, so the check would never reach a
 * verdict. Every reply would hang, for anyone with a breakpoint anywhere.
 *
 * The user's breakpoints are untouched by this: they are line numbers against a
 * program the check never modified, so their next run debugs exactly as before.
 */
export function shouldOpenDebugSession(opts: {
  /** This run is the IDE checking an answer the assistant returned. */
  checking: boolean;
  /** The dialect models BASIC-line debugging. */
  debuggable: boolean;
  /** The machine implements the step. */
  canStep: boolean;
}): boolean {
  return !opts.checking && opts.debuggable && opts.canStep;
}

/**
 * Whether a run should bring the emulator to the front and take keyboard focus.
 *
 * A run the user asked for does: they pressed Play (or applied an answer and ran
 * it), so the machine is what they are now looking at - on the tab layouts that
 * means switching to the preview tab, and on every layout it means the screen
 * takes the keys it is about to be sent.
 *
 * A check is not that run. Nobody asked for it, it happens while the user is
 * reading a reply, and the answer it is checking is not even in their editor.
 * Pulling the machine in front of the assistant mid-sentence - or quietly moving
 * the keys off whatever they were typing into - would make a background check
 * feel like something they did. So a check runs where it stands: unwatched if
 * the assistant is what is showing, and never taking focus from it.
 *
 * The check itself is unaffected by going unseen: it advances on a clock rather
 * than animation frames when the page is hidden (see
 * {@link AI_CHECK_HIDDEN_TICK_MS}), and a canvas draws the same whether or not
 * its pane is on screen.
 */
export function shouldRevealEmulator(opts: {
  /** This run is the IDE checking an answer the assistant returned. */
  checking: boolean;
}): boolean {
  return !opts.checking;
}

/**
 * Whether a run should take the machine back from the assistant.
 *
 * While the assistant is driving, the machine is held still between its actions
 * so that what it acts on is the screen it was last shown. That hold has to end
 * the moment the user starts a run of their own: they pressed Play, or applied
 * an answer and ran it, and a machine that stays held is one that shows their
 * program and never advances a frame. So a run the user asked for drops the
 * driver outright - which both thaws the machine and stops an in-flight turn
 * pressing keys into a program that is no longer the one it was driving.
 *
 * A check does not, and the ordering is why: the driver the assistant needs is
 * registered by the frame the check itself draws, so a check that dropped it on
 * the way in would be taking the machine back from nobody and handing it
 * straight back. Worse, a check refused before it reaches the machine at all -
 * an empty program, a lint error - would have destroyed a working driver for a
 * run that never happened.
 */
export function shouldTakeMachineBack(opts: {
  /** This run is the IDE checking an answer the assistant returned. */
  checking: boolean;
}): boolean {
  return !opts.checking;
}

/** What the machine said about itself this frame, as the check sees it. */
export interface AiRunFrame {
  /** `machine.readReport()` for this frame. */
  report: MachineReport | null;
  /**
   * `machine.isProgramRunning()` for this frame. The two the rules below turn
   * on: `false` is a machine that has taken the program and finished it, `null`
   * is one that could answer but isn't ready to.
   */
  running: boolean | null;
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
 * The outcome a single frame settles on its own, or null when this frame says
 * nothing conclusive.
 *
 * The two rules that need no window to decide, kept in one place because more
 * than one reader of a run needs them and two accounts of "has this program
 * finished" would eventually disagree in front of the user. An error ends a run
 * immediately, and so does a machine saying no program is running - a machine
 * only answers that once it has actually taken the program (see
 * `MachineEmulator.isProgramRunning`), so it can't be the prompt it hasn't left
 * yet.
 */
export function immediateRunOutcome(frame: AiRunFrame): AiRunOutcome | null {
  const { report, running } = frame;
  if (report?.isError) return { kind: 'errored', report };
  if (running === false) return { kind: 'ended-ok' };
  return null;
}

/**
 * Classify one frame of an armed post-run check.
 *
 * Pure on purpose: the caller owns the machine and the animation loop, this
 * owns the rules, and they meet over plain numbers so the rules are testable
 * without a canvas or an emulator.
 *
 * What {@link immediateRunOutcome} settles ends the check on the spot.
 * Otherwise the windows decide: the running window expiring means the program
 * is still going, which is a success, and the absolute cap with the machine
 * never up means it never started.
 */
export function classifyAiRunFrame(
  frame: AiRunFrame,
  counts: AiRunFrameCounts,
): AiRunVerdict {
  const { report, running } = frame;
  const settled = immediateRunOutcome(frame);
  if (settled) return { done: true, outcome: settled };

  // The machine is "up" once it says anything about itself: a report, or a
  // definite answer about whether a program is running.
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

/**
 * Turn the schedule's steps into the run's final answer, given how the run
 * ended.
 *
 * There is no longer anything to fold: the schedule was judged where it was
 * written, so a step that failed failed at the moment the assistant named.
 * What survives from the latch that used to live here is the one asymmetry
 * worth keeping - a program that never started cannot have produced anything,
 * so reporting its expectations as failures would send the assistant to fix a
 * program that never ran.
 *
 * An error is not judged at all: the error is the failure, and it already
 * travels as a correction of its own.
 */
export function finaliseExpectations(
  steps: readonly ExpectationResult[],
  outcome: AiRunOutcome,
): ExpectationResult[] {
  if (outcome.kind === 'errored') return [];
  if (outcome.kind !== 'never-started') return [...steps];
  return steps.map((step) =>
    step.outcome === 'failed'
      ? {
          action: step.action,
          outcome: 'unevaluated' as const,
          detail: 'the program never started',
        }
      : step,
  );
}
