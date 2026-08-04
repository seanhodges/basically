import type { ControllerRole, KeyboardLayout } from '../keyboard/layoutSchema';
import type { MachineEmulator, MachineScreenText } from '../dialects/types';
import {
  indexKeyDefs,
  resolveControllerConfig,
  resolveRoleTokens,
  rolesToJoystick,
  type GamepadMode,
} from '../keyboard/controllerConfig';

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
  /** The key names this machine has, for telling the assistant what it may press. */
  keyNames(): string[];
  /**
   * Press keys together and release them, holding long enough for the ROM's
   * keyboard scan to see it. Fails, rather than throwing, on a name this
   * machine does not have.
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
  /** The characters on screen now, or null when the machine cannot say. */
  readText(): MachineScreenText | null;
  /** Release everything this driver is holding. */
  releaseAll(): void;
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
}

/**
 * Build a driver over one machine.
 *
 * Takes the machine and its layout rather than reaching for them, so this is
 * testable against a real emulator without a canvas or a React tree - which is
 * the only way to know the timings actually work on the ROMs.
 */
export function createMachineControl(deps: MachineControlDeps): MachineControl {
  const { machine, layout, gamepadMode, fireButtons, step } = deps;
  const index = indexKeyDefs(layout);
  const holdDefault =
    layout.options?.minHoldFrames ?? DEFAULT_DRIVE_HOLD_FRAMES;
  // Every token this driver has pressed and not yet released, so a step that
  // fails part-way cannot leave a key stuck down for the rest of the run.
  const held = new Set<string>();

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
    keyNames: () => [...index.keys()].sort(),

    pressKeys(names, holdFrames) {
      const tokens: string[] = [];
      for (const name of names) {
        const key = index.get(name);
        if (!key) {
          return {
            ok: false,
            frames: 0,
            detail: `this machine has no key called "${name}"`,
          };
        }
        tokens.push(...key.emits);
      }
      if (!tokens.length) {
        return { ok: false, frames: 0, detail: 'no keys named' };
      }
      return { ok: true, frames: press(tokens, holdFrames ?? holdDefault) };
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

    readText: () => machine.readScreenText?.() ?? null,

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

/**
 * The live driver, registered by the emulator pane while a machine is up.
 *
 * Module-level rather than store state, exactly as the screen capture is:
 * neither is render data, and both are wanted by a module with no path to the
 * pane.
 */
let live: MachineControl | null = null;
/** Set while the assistant is driving, so the pane's own loop leaves the machine alone. */
let frozen = false;

/** Register the live driver; returns the matching unregister. */
export function registerMachineControl(control: MachineControl): () => void {
  live = control;
  return () => {
    if (live === control) {
      live = null;
      frozen = false;
    }
  };
}

/** The driver for the machine that is up, or null when there is none. */
export function machineControl(): MachineControl | null {
  return live;
}

/** Whether a machine can be driven at all right now. */
export function hasMachineControl(): boolean {
  return live !== null;
}

/**
 * Whether `control` is still the live driver - that is, whether the turn
 * holding it still owns the machine.
 *
 * A driving turn takes its driver once and then holds it across seconds of
 * network, and in that time the user may start a run of their own, which
 * registers a new driver over this one. The turn's own reference keeps working
 * regardless - it closes over the machine object - so without asking, it would
 * go on typing into whatever program the user has since loaded. Asking first is
 * what keeps driving confined to the run it was armed for.
 */
export function ownsMachine(control: MachineControl): boolean {
  return live === control;
}

/**
 * Hold the machine still, or let it go again.
 *
 * A tool round trip is seconds of network, and the pane's loop keeps ticking
 * after a check settles. Left running, the assistant would act on a screen that
 * had moved on between deciding and doing - so what it acts on is the screen it
 * was last shown. Costs nothing: a check runs unwatched and never takes focus,
 * so there is no animation anyone is looking at to interrupt.
 */
export function freezeMachine(on: boolean): void {
  frozen = on;
}

/** Whether the pane's loop should leave the machine alone this tick. */
export function machineFrozen(): boolean {
  return frozen;
}

/** Drop the driver, so a machine that is no longer the active one cannot be driven. */
export function forgetMachineControl(): void {
  live = null;
  frozen = false;
}
