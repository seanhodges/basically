/**
 * What the primary run control offers, derived from the run's state - one
 * derivation behind every surface that offers to pause or continue a run: the
 * round control over the editor on the touch layout, the toolbar's run buttons,
 * the run actions on the machine's tab, and the keyboard.
 *
 * Kept apart from the components so it can be tested without a renderer, and
 * type-only against the store so importing it does not pull in the store's
 * module-load reads of localStorage.
 */
import type { EmulatorStatus } from './store';

/** The three positions of the run control, one per run state. */
export type RunControlState = 'play' | 'pause' | 'continue';

/**
 * A total map, not a switch with a default: a fourth run state has to be given
 * a position here rather than silently falling through to Play, which would
 * offer to restart a program the user is watching.
 */
const CONTROL_STATE: Record<EmulatorStatus, RunControlState> = {
  stopped: 'play',
  running: 'pause',
  paused: 'continue',
};

/** What the control's position depends on besides the run's state. */
export interface RunControlConditions {
  /** The machine offers a pause, because it offers a Continue to release it. */
  pausable: boolean;
  /**
   * The program has ended - it finished, or it stopped on an error - while the
   * machine goes on running at its prompt.
   */
  programEnded: boolean;
}

/**
 * What the run control offers while the machine is in `status`.
 *
 * A machine that cannot be paused keeps the plain Play the control has always
 * been, because pausing is only offered where continuing is: the machines with
 * a line-level debugger. Without that pairing a run could be held still on a
 * machine whose toolbar has no Continue to release it.
 *
 * `paused` still maps to Continue even when pausing is off, so a run paused
 * before the machine was switched is never left with no way out.
 *
 * A program that has ended puts the control back to Play, ahead of everything
 * else: the machine is still running - it sits at its prompt, and the user may
 * be typing at it - but Pause and Continue are offered against a program, and
 * there is no longer one to hold still or to carry on. What the control offers
 * is then what it offers to a machine that has never run: build the program and
 * run it again. This holds on every machine, since every machine reports
 * whether a program is running (`MachineEmulator.isProgramRunning`).
 */
export function runControlStateOf(
  status: EmulatorStatus,
  { pausable, programEnded }: RunControlConditions,
): RunControlState {
  if (programEnded) return 'play';
  if (status === 'running' && !pausable) return 'play';
  return CONTROL_STATE[status];
}

/**
 * What a surface that carries its own separate Play shows for the pause and
 * the continue: two faces and a refusal, rather than the control-over-the-
 * editor's three positions.
 */
export interface PauseToggle {
  /** Which face to wear. Never Play - that surface has a Play of its own. */
  face: Exclude<RunControlState, 'play'>;
  /** Whether pressing it would do anything. */
  offered: boolean;
}

/**
 * The two-face reading of {@link runControlStateOf}, for the toolbar's run
 * buttons and the overflow menu's Run actions.
 *
 * Where the control over the editor falls back to Play - the run is stopped, the
 * machine offers no pause, or the program has ended and left the machine at its
 * prompt - a surface with its own Play refuses instead. Falling back would give
 * such a surface two buttons that both start the program, and would let a
 * mis-aimed press restart a run at the moment it ended. The refused face is
 * Continue, which is what those surfaces show at rest today.
 */
export function pauseToggleOf(state: RunControlState): PauseToggle {
  if (state === 'pause') return { face: 'pause', offered: true };
  if (state === 'continue') return { face: 'continue', offered: true };
  return { face: 'continue', offered: false };
}

/**
 * Text glyphs, matching the toolbar's set (▶ ■ ⤵). Continue is the left half of
 * the Pause bars followed by the play triangle, so it is told apart from Play
 * by its mark rather than by fill colour alone - the two actions it matters
 * most not to confuse, since one carries the run on and the other throws it
 * away and starts over. Both codepoints are already in the set: no glyph here
 * is one the app was not already rendering.
 *
 * Pause is U+275A rather than U+23F8, and Continue is that bar with U+25B6
 * rather than U+23EF: browsers give the U+23Ex range emoji presentation and
 * colour, and U+23EF means a play/pause toggle rather than a resume.
 */
const GLYPH: Record<RunControlState, string> = {
  play: '▶',
  pause: '❚❚',
  continue: '❚▶',
};

/**
 * The one-word name of each position, for the surfaces that set a word beside
 * the glyph (the toolbar's buttons, the overflow menu's items). One word per
 * action wherever it is offered; the sentence form is {@link runControlLabel}.
 */
const WORD: Record<RunControlState, string> = {
  play: 'Play',
  pause: 'Pause',
  continue: 'Continue',
};

/** The word the run control sets beside its glyph in `state`. */
export function runControlWord(state: RunControlState): string {
  return WORD[state];
}

/** The glyph the run control shows in `state`. */
export function runControlGlyph(state: RunControlState): string {
  return GLYPH[state];
}

/**
 * What pressing the control does, for its title and accessible name. Play names
 * the target where there is one, matching the toolbar's Play.
 */
export function runControlLabel(
  state: RunControlState,
  runTargetName?: string | null,
): string {
  if (state === 'pause') return 'Pause the running program';
  if (state === 'continue') return 'Continue the paused program';
  return runTargetName
    ? `Build and run ${runTargetName} in the emulator`
    : 'Build and run in the emulator';
}

/** The state of the run loop that decides whether a pause is safe to take. */
export interface PauseConditions {
  /** The machine offers line-level debugging, and so a Continue to match. */
  debuggable: boolean;
  /** A run the IDE started to check an answer the assistant gave. */
  checking: boolean;
  /** The assistant is advancing the machine itself, outside the frame loop. */
  driving: boolean;
  /** The machine has rendered a frame. */
  drawn: boolean;
}

/**
 * Whether a running machine can be paused. Each refusal is a case where a
 * paused frame loop strands something that has no other way out: a machine
 * with no debugger has no Continue to release the pause, an assistant check
 * reaches its verdict from inside the loop, a machine the assistant is driving
 * would keep moving while claiming to be paused, and the loading overlay is
 * dismissed by the first rendered frame.
 */
export function canPauseRun({
  debuggable,
  checking,
  driving,
  drawn,
}: PauseConditions): boolean {
  return debuggable && !checking && !driving && drawn;
}
