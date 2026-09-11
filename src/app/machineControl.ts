import type { ControllerRole, KeyboardLayout } from '../keyboard/layoutSchema';
import type {
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineScreenText,
  MachineVariable,
} from '../dialects/types';
import {
  resolveControllerConfig,
  resolveRoleTokens,
  rolesToJoystick,
  type GamepadMode,
} from '../keyboard/controllerConfig';
import { resolveKeyName } from '../keyboard/keyNames';

/**
 * Driving the running machine: pressing its keys, working its joystick, and
 * waiting for what that produced.
 *
 * Reached the same module-level way the screen capture is (`./screenCapture`),
 * and for the same reason: the machine lives in a ref inside the emulator pane,
 * and the AI store - which orchestrates every answer and already reacts to run
 * outcomes - has no prop path to it. The store's own convention forbids the
 * alternative (cross-module commands bump a counter; no shared handles), and
 * that convention is built for one round trip per run, where driving is many
 * round trips inside one.
 *
 * Everything here is synchronous. The driver owns its own frame advance rather
 * than registering a frame hook, because `registerFrameHook` is a single slot
 * already contended by the virtual keyboard and the game controller - a third
 * consumer would silently clobber whichever overlay is open. Advancing here
 * also keeps driving deterministic: a step costs exactly the frames it says.
 */
export interface MachineControl {
  /**
   * Press keys together and release them, holding long enough for the ROM's
   * keyboard scan to see it. Names are the machine-independent vocabulary
   * (`src/keyboard/keyNames.ts`), and this machine's own key ids as well.
   * Fails, rather than throwing, on a name this machine does not have.
   */
  pressKeys(names: string[], holdFrames?: number): DriveStep;
  /** Hold controller roles for `holdFrames`, through the port or mapped keys. */
  joystick(roles: ControllerRole[], holdFrames: number): DriveStep;
  /** Run the machine on for `frames` with nothing held. */
  advance(frames: number): DriveStep;
  /**
   * Run until the screen shows `needle`, or until `maxFrames` have passed
   * without it. Failing is an ordinary outcome, not an error: it means the
   * program did not get where the assistant expected.
   */
  waitForText(needle: string, maxFrames: number): DriveStep;
  /**
   * Run until the program has stopped, or until `maxFrames` have passed with it
   * still going. Fails the same ordinary way a wait for text does.
   */
  waitForEnd(maxFrames: number): DriveStep;
  /**
   * Whether BASIC is running the program: true, false, or null on a machine
   * that has not yet taken it. Tri-state because a program cannot un-begin, so
   * a `false` before the machine has started is not the program having ended.
   */
  programState(): boolean | null;
  /** The characters on screen now, or null when the machine cannot say. */
  readText(): MachineScreenText | null;
  /**
   * The program's variables, or null on a machine that cannot report them.
   * Here rather than only on the session because a schedule may expect a
   * variable to hold a value, and a schedule runs against the driver.
   */
  variables(): MachineVariable[] | null;
  /**
   * Whether this machine can be stopped on a BASIC line at all, which is
   * whether its holder handed over a stopping path. False on a machine that
   * cannot say which line it is executing; everything below then answers
   * {@link DebugRun.ending} `cannot-step` rather than pretending.
   */
  canStep(): boolean;
  /** The BASIC lines a program is to stop before, ascending. */
  breakpoints(): number[];
  /**
   * Name the BASIC lines a program is to stop before, replacing whatever was
   * in force. An empty list stops the program nowhere. A line no line of the
   * program carries is kept and simply never reached: a caller may breakpoint
   * a line it is about to write.
   */
  setBreakpoints(lines: readonly number[]): void;
  /**
   * One slice of the stopping path - up to a frame's worth of stepping that may
   * stop early - with the resumed-from line threaded through it and advanced
   * where it pauses.
   *
   * Here as well as the two loops below because a caller spending its own
   * frames needs the same account of "run until this line" they get: a run that
   * was told where to stop keeps its own loop (it yields between frames so the
   * ROM loads that settle on timers can land) and takes this for each of them,
   * so the line it stops on and the line a later continue resumes from are one
   * piece of bookkeeping rather than two. Null on a machine with no stopping
   * path.
   */
  debugSlice(mode: DebugStepOptions['mode']): DebugStepResult | null;
  /**
   * Run a stopped program on until the line about to execute differs from the
   * one it stopped at, so a line the program dwells on is one step.
   */
  stepLine(maxFrames?: number): DebugRun;
  /** Run a stopped program on until it stops again or until it ends. */
  continueRun(maxFrames?: number): DebugRun;
  /** Where the program is now, without advancing the machine. */
  position(): DebugPosition;
  /** Release everything this driver is holding. */
  releaseAll(): void;
}

/**
 * How a step or a continue ended.
 *
 * `exhausted` is an ordinary outcome rather than a failure: continuing a
 * program that loops forever is continuing an ordinary BASIC program, and
 * `10 GOTO 10` is one.
 */
export type DebugEnding =
  /** Execution stopped before a BASIC line; {@link DebugRun.line} names it. */
  | 'stopped'
  /** The program ended, so there is no line it is stopped before. */
  | 'ended'
  /** The frames ran out with neither a stop nor an end reached. */
  | 'exhausted'
  /** This machine cannot be stepped, and nothing was run. */
  | 'cannot-step';

/** What one step or continue did. */
export interface DebugRun {
  ending: DebugEnding;
  /** The BASIC line the program is now stopped before, or null. */
  line: number | null;
  /** Emulated frames it cost. */
  frames: number;
  /**
   * Emulated seconds of the machine's own time it cost - the same clock
   * everything else is measured in, so a stretch of a program timed a line at
   * a time adds up to the time the whole of it takes.
   */
  seconds: number;
}

/** Where a program is, as a caller that remembers nothing is told it. */
export interface DebugPosition {
  /** Whether this machine can be stepped a BASIC line at a time. */
  canStep: boolean;
  /**
   * The BASIC line about to execute, or null where none can be determined -
   * nothing is running, or the machine is sitting at its prompt.
   */
  line: number | null;
  /** Whether a program is running; tri-state as {@link MachineControl.programState} is. */
  running: boolean | null;
  /** The lines in force to stop before, ascending. */
  breakpoints: number[];
}

/**
 * How one step went.
 *
 * A step that could not be carried out reports it rather than throwing, so the
 * assistant can pick another key or stop waiting and look instead. A turn that
 * died on a bad step would waste everything the model did before it.
 */
export interface DriveStep {
  ok: boolean;
  /** Why it did not work, when it did not. */
  detail?: string;
  /** Emulated frames this step actually cost. */
  frames: number;
}

/**
 * Frames a matrix press is held when the layout does not say.
 *
 * Matches the virtual keyboard's own default: a press shorter than the ROM's
 * keyboard scan interval is a press the program never sees.
 */
export const DEFAULT_DRIVE_HOLD_FRAMES = 3;

/** Frames run after a release so the ROM sees the key go up before the next step. */
export const DRIVE_SETTLE_FRAMES = 2;

/**
 * The most emulated frames one drive step may spend.
 *
 * A bound on the machine's time rather than the assistant's patience: fifty
 * frames is a second of machine time, so this is twenty seconds. Long enough
 * for any boot or title screen, short enough that a wait for text that never
 * appears ends while the user is still reading the reply.
 */
export const MAX_DRIVE_FRAMES = 1000;

export interface MachineControlDeps {
  machine: MachineEmulator;
  layout: KeyboardLayout;
  /** How the controller is wired for this machine and user (see controllerConfig). */
  gamepadMode: GamepadMode;
  fireButtons: 1 | 2;
  /** Advance one frame and render, so a look sees what the user would see. */
  step: () => void;
  /**
   * Advance one slice of the machine's own stopping path, folding whatever the
   * holder folds into a frame.
   *
   * Handed in beside {@link step} rather than reached for on the machine, for
   * the reason `step` is: the frames the driver spends are frames the holder
   * saw, so a sampled view still paints them, a run still counts them and a
   * profile is still charged them. A holder whose machine has no stopping path
   * - `machine.debugStep` absent - hands none, and the driver reports the
   * machine cannot be stepped.
   */
  debugSlice?: (opts: DebugStepOptions) => DebugStepResult;
}

/**
 * Build a driver over one machine.
 *
 * Takes the machine and its layout rather than reaching for them, so this is
 * testable against a real emulator without a canvas or a React tree - which is
 * the only way to know the timings actually work on the ROMs.
 */
export function createMachineControl(deps: MachineControlDeps): MachineControl {
  const { machine, layout, gamepadMode, fireButtons, step, debugSlice } = deps;
  const holdDefault =
    layout.options?.minHoldFrames ?? DEFAULT_DRIVE_HOLD_FRAMES;
  // Every token this driver has pressed and not yet released, so a step that
  // fails part-way cannot leave a key stuck down for the rest of the run.
  const held = new Set<string>();
  // The lines a program is to stop before. This caller's alone: a driver is
  // made over one machine, and two callers holding two machines stop in two
  // different places.
  let stops: number[] = [];
  /**
   * The line the caller resumed from, threaded through every slice.
   *
   * Beside the driver rather than in the machine, because it is the caller's
   * intention and not the machine's state: a slice may exhaust its budget while
   * still on this line, and it is what makes continuing off a line that is
   * itself a stop run on instead of stopping again on the spot.
   */
  let fromLine: number | null = null;

  const slice = (mode: DebugStepOptions['mode']): DebugStepResult | null => {
    if (!debugSlice) return null;
    const result = debugSlice({
      breakpoints: new Set(stops),
      mode,
      fromLine,
    });
    if (result.paused) {
      fromLine = result.line;
      // Nothing stays held while a program is stopped, exactly as the IDE's
      // debugger releases: a key still down would go on being scanned by the
      // next thing that runs the machine on.
      machine.releaseAllKeys();
      held.clear();
    }
    return result;
  };

  /**
   * Run slices until something stops, the program ends, or the frames run out.
   *
   * The end of the program is read the same tri-state way every other loop over
   * this machine reads it: a program cannot un-begin, so only a `false` after a
   * `true` is the program having ended - which is what lets a run that has not
   * started yet take this path as well as a continue from a stop.
   */
  const debugRun = (
    mode: DebugStepOptions['mode'],
    maxFrames: number,
  ): DebugRun => {
    const cost = (frames: number) => ({
      frames,
      seconds: machine.frameHz > 0 ? frames / machine.frameHz : 0,
    });
    if (!debugSlice) {
      return { ending: 'cannot-step', line: null, ...cost(0) };
    }
    const limit = Math.max(0, Math.min(maxFrames, MAX_DRIVE_FRAMES));
    let started = machine.isProgramRunning() === true;
    for (let i = 0; i < limit; i++) {
      const result = slice(mode)!;
      if (result.paused) {
        return { ending: 'stopped', line: result.line, ...cost(i + 1) };
      }
      const running = machine.isProgramRunning();
      if (running === true) started = true;
      else if (running === false && started) {
        fromLine = null;
        return { ending: 'ended', line: null, ...cost(i + 1) };
      }
    }
    return {
      ending: 'exhausted',
      line: machine.currentLine?.() ?? null,
      ...cost(limit),
    };
  };

  const run = (frames: number): number => {
    const capped = Math.max(0, Math.min(frames, MAX_DRIVE_FRAMES));
    for (let i = 0; i < capped; i++) step();
    return capped;
  };

  const press = (tokens: string[], holdFrames: number): number => {
    for (const t of tokens) {
      machine.setKey(t, true);
      held.add(t);
    }
    const down = run(Math.max(1, holdFrames));
    for (const t of tokens) {
      machine.setKey(t, false);
      held.delete(t);
    }
    return down + run(DRIVE_SETTLE_FRAMES);
  };

  return {
    pressKeys(names, holdFrames) {
      // Deduplicated because a chord's names can name one cell twice: PRESS
      // SHIFT+LEFT on a Spectrum resolves to CapsShift and then to
      // CapsShift+Digit5, and pressing and releasing one cell twice in a step
      // is bookkeeping nobody needs.
      const tokens = new Set<string>();
      for (const name of names) {
        const resolved = resolveKeyName(layout, name);
        if (!resolved) {
          return {
            ok: false,
            frames: 0,
            detail: `this machine has no key called "${name}"`,
          };
        }
        for (const token of resolved) tokens.add(token);
      }
      if (tokens.size === 0) {
        return { ok: false, frames: 0, detail: 'no keys named' };
      }
      return {
        ok: true,
        frames: press([...tokens], holdFrames ?? holdDefault),
      };
    },

    joystick(roles, holdFrames) {
      const held = new Set(roles);
      // Through the machine's own port where it has one the user selected, and
      // as the mapped keys where it does not - the same fallback the on-screen
      // controller makes, so driving reaches a program exactly as a person
      // playing it would.
      if (gamepadMode !== 'keymapped' && machine.setJoystick) {
        machine.setJoystick(gamepadMode, rolesToJoystick(held, fireButtons));
        const frames = run(Math.max(1, holdFrames));
        machine.setJoystick(
          gamepadMode,
          rolesToJoystick(new Set(), fireButtons),
        );
        return { ok: true, frames: frames + run(DRIVE_SETTLE_FRAMES) };
      }
      const config = resolveControllerConfig(layout);
      const byRole = resolveRoleTokens(layout, config, {});
      const tokens = roles.flatMap((r) => byRole[r] ?? []);
      if (!tokens.length) {
        return {
          ok: false,
          frames: 0,
          detail: 'this machine has no key bound to that control',
        };
      }
      return { ok: true, frames: press(tokens, Math.max(1, holdFrames)) };
    },

    advance(frames) {
      return { ok: true, frames: run(frames) };
    },

    waitForText(needle, maxFrames) {
      const wanted = collapseSpaces(needle);
      if (wanted === '') {
        return { ok: false, frames: 0, detail: 'nothing to wait for' };
      }
      const limit = Math.max(0, Math.min(maxFrames, MAX_DRIVE_FRAMES));
      for (let i = 0; i < limit; i++) {
        const screen = machine.readScreenText?.() ?? null;
        // Matched a row at a time, never across a row boundary: a fixed-width
        // machine breaks a line wherever its width falls, so a match that
        // spanned rows would be a claim about the width.
        if (
          screen?.lines.some((line) => collapseSpaces(line).includes(wanted))
        ) {
          return { ok: true, frames: i };
        }
        step();
      }
      return {
        ok: false,
        frames: limit,
        detail: `"${needle}" did not appear within ${limit} frames`,
      };
    },

    waitForEnd(maxFrames) {
      const limit = Math.max(0, Math.min(maxFrames, MAX_DRIVE_FRAMES));
      for (let i = 0; i < limit; i++) {
        // A machine that cannot yet say answers null, so only an explicit
        // `false` ends the wait. A program that has already stopped satisfies
        // it at once, which is what a schedule saying "make sure it finished"
        // after waiting for the last thing it printed actually means.
        if (machine.isProgramRunning() === false)
          return { ok: true, frames: i };
        step();
      }
      return {
        ok: false,
        frames: limit,
        detail: `the program was still running after ${limit} frames`,
      };
    },

    programState: () => machine.isProgramRunning(),

    canStep: () => debugSlice !== undefined,

    breakpoints: () => [...stops],

    setBreakpoints(lines) {
      // Sorted and deduplicated so the lines a caller is told are in force read
      // the same however it named them, and held as numbers the machine's own
      // set is built from per slice.
      stops = [...new Set(lines)].sort((a, b) => a - b);
    },

    debugSlice: (mode) => slice(mode),

    stepLine: (maxFrames) => debugRun('step', maxFrames ?? MAX_DRIVE_FRAMES),

    continueRun: (maxFrames) => debugRun('run', maxFrames ?? MAX_DRIVE_FRAMES),

    position: () => {
      const running = machine.isProgramRunning();
      return {
        canStep: debugSlice !== undefined,
        // No line where nothing is running, rather than whatever the machine
        // still has in its cell: several machines leave the line being executed
        // pointing at the last line of a program that has finished, which is
        // fine for labelling a pause and wrong as an answer to where the
        // program is.
        line: running === false ? null : (machine.currentLine?.() ?? null),
        running,
        breakpoints: [...stops],
      };
    },

    readText: () => machine.readScreenText?.() ?? null,

    variables: () => machine.readVariables?.() ?? null,

    releaseAll() {
      for (const t of held) machine.setKey(t, false);
      held.clear();
      machine.releaseAllKeys();
    },
  };
}

/** Compare screen text the way a reader would, not the way a grid stores it. */
function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
