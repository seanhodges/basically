import type { MachineControl } from './machineControl';
import type { RunProfile } from './runProfile';
import type { RunTiming } from './runTiming';
import type { OutlineCapabilities } from '../editor/programOutline';

/**
 * One interface over a running machine, whoever is holding it.
 *
 * A session is the driver ({@link MachineControl}) plus everything a caller
 * asks of a machine that is up: a picture of its display, the measurements of
 * the run, how long the run took, and what its variables hold. The operations
 * in `src/ops/` are written against this and nothing else, so an operation
 * needing a machine works for the assistant holding the browser's machine and
 * for a headless run alike. The browser implementation is `./browserSession`;
 * the headless one is `src/ops/headlessSession.ts`.
 *
 * Everything here answers synchronously and from what is already known: a
 * session never boots, never runs the program on its own account, and reports
 * a machine that cannot answer as unable to rather than answering with
 * nothing.
 */
export interface MachineSession extends MachineControl {
  /** The display as a PNG, or null when no picture can be taken. */
  capture(): ScreenPicture | null;
  /** The run's measurements, and what they are read against. */
  measurements(): SessionMeasurements;
  /** The timing of the run, or null when nothing has been timed. */
  timing(): RunTiming | null;
}

/** A picture of the display, encoded so it survives being written as JSON. */
export interface ScreenPicture {
  width: number;
  height: number;
  /** PNG bytes, base64. */
  png: string;
}

export interface SessionMeasurements {
  /** False on a machine that cannot report which BASIC line it is executing. */
  canProfile: boolean;
  /** The run's profile, or null until one has been measured. */
  profile: RunProfile | null;
  /** The program the profile is of, for summing lines over its routines. */
  source: string;
  capabilities: OutlineCapabilities;
}

/**
 * The live session, registered by the emulator pane while a machine is up.
 *
 * Module-level rather than store state, exactly as the screen capture is:
 * neither is render data, and both are wanted by a module with no path to the
 * pane.
 */
let live: MachineSession | null = null;
/** Set while the assistant is driving, so the pane's own loop leaves the machine alone. */
let frozen = false;

/** Register the live session; returns the matching unregister. */
export function registerMachineSession(session: MachineSession): () => void {
  live = session;
  return () => {
    if (live === session) {
      live = null;
      frozen = false;
    }
  };
}

/** The session over the machine that is up, or null when there is none. */
export function machineSession(): MachineSession | null {
  return live;
}

/** Whether a machine can be driven at all right now. */
export function hasMachineSession(): boolean {
  return live !== null;
}

/**
 * Whether `session` is still the live one - that is, whether the turn holding
 * it still owns the machine.
 *
 * A driving turn takes its session once and then holds it across seconds of
 * network, and in that time the user may start a run of their own, which
 * registers a new session over this one. The old reference goes on working -
 * it closes over the machine - so without this check the turn would drive
 * whatever the user has since loaded.
 */
export function ownsMachine(session: MachineSession): boolean {
  return live === session;
}

/**
 * Freeze or thaw the machine for the assistant's turn.
 *
 * While frozen the pane's own run loop does not advance the machine, so the
 * frames a drive step spends are the only frames that run and every look sees
 * the screen the last action left. Thawing is the turn's job, and the
 * unregister thaws too, so a machine that goes away mid-turn is never stranded.
 */
export function freezeMachine(on: boolean): void {
  frozen = on;
}

export function machineFrozen(): boolean {
  return frozen;
}

/**
 * Drop the session outright, thawing the machine with it.
 *
 * The path a run the user started takes: the pane drops whatever session is
 * registered rather than unregistering a particular one, and a drop that left
 * the machine frozen would strand the very run that asked for it.
 */
export function forgetMachineSession(): void {
  live = null;
  frozen = false;
}
