import type { ControllerRole } from '../keyboard/layoutSchema';
import type { MachineControl } from './machineControl';

/**
 * The vocabulary a caller drives a running machine in: one action per line,
 * read into {@link DriveAction}s and run against a {@link MachineControl}.
 *
 * Beside the driver rather than in the assistant's module, because the
 * assistant is not the only caller: the command line's `run --keys` reads the
 * same script, and one grammar with one parser is what makes a schedule written
 * for one caller mean the same thing to the other. Nothing here is about the
 * assistant, and nothing here touches a machine directly - the control it is
 * handed owns the machine and the clock.
 */

/** One line of a drive script, already understood. */
export type DriveAction =
  | { kind: 'press'; names: string[]; holdFrames?: number }
  | { kind: 'joystick'; roles: ControllerRole[]; frames: number }
  | { kind: 'wait'; frames: number }
  | { kind: 'waitFor'; needle: string; maxFrames: number }
  | { kind: 'waitEnd'; maxFrames: number }
  | { kind: 'malformed'; source: string };

const PRESS_RE = /^PRESS\s+(\S+)(?:\s+(\d+))?$/i;
const JOY_RE = /^JOY\s+([A-Z0-9\s]+?)(?:\s+(\d+))?$/i;
const WAIT_END_RE = /^WAIT\s+END(?:\s+(\d+))?$/i;
const WAIT_FOR_RE = /^WAIT\s+FOR\s+(.*)$/i;
const WAIT_RE = /^WAIT\s+(\d+)$/i;
/** A quoted needle, and the optional frame cap after it. */
const NEEDLE_RE = /^"([^"]*)"(?:\s+(\d+))?$/;

/** How long a joystick direction is held when the script does not say. */
export const DEFAULT_JOY_FRAMES = 10;
/** How long to wait for text when the script does not say. */
export const DEFAULT_WAIT_FOR_FRAMES = 300;

const ROLES: Record<string, ControllerRole> = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  FIRE: 'fire1',
  FIRE1: 'fire1',
  FIRE2: 'fire2',
};

function unquote(text: string): string {
  const t = text.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"')
    ? t.slice(1, -1)
    : t;
}

/** `WAIT FOR` reads a quoted needle with an optional cap, else a bare needle. */
function waitForAction(line: string, rest: string): DriveAction {
  const quoted = NEEDLE_RE.exec(rest.trim());
  const needle = quoted ? quoted[1]! : unquote(rest);
  if (needle.trim() === '') return { kind: 'malformed', source: line };
  return {
    kind: 'waitFor',
    needle,
    maxFrames: quoted?.[2] ? Number(quoted[2]) : DEFAULT_WAIT_FOR_FRAMES,
  };
}

/**
 * Read a drive script, one action per line.
 *
 * Never throws and never drops a line: an action it cannot read comes back as
 * `malformed` and is reported to the caller, because a line silently ignored
 * reads as a line that worked - and the assistant would then blame its program
 * for a screen its own driving never reached.
 *
 * A `#` line is a comment and is the one thing that does vanish: a schedule
 * that cannot say why it presses what it presses is written for nobody but its
 * author.
 */
export function parseDriveScript(script: string): DriveAction[] {
  const out: DriveAction[] = [];
  for (const raw of script.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('#')) continue;
    const line = trimmed.replace(/[.;,]$/, '');
    if (line === '') continue;

    const waitEnd = WAIT_END_RE.exec(line);
    if (waitEnd) {
      out.push({
        kind: 'waitEnd',
        maxFrames: waitEnd[1] ? Number(waitEnd[1]) : DEFAULT_WAIT_FOR_FRAMES,
      });
      continue;
    }

    const waitFor = WAIT_FOR_RE.exec(line);
    if (waitFor) {
      out.push(waitForAction(line, waitFor[1]!));
      continue;
    }

    const wait = WAIT_RE.exec(line);
    if (wait) {
      out.push({ kind: 'wait', frames: Number(wait[1]) });
      continue;
    }

    const press = PRESS_RE.exec(line);
    if (press) {
      // `+` joins a chord, so a shifted legend is one action rather than two
      // presses the ROM never sees overlap.
      const names = press[1]!.split('+').filter((name) => name !== '');
      out.push(
        names.length > 0
          ? {
              kind: 'press',
              names,
              ...(press[2] ? { holdFrames: Number(press[2]) } : {}),
            }
          : { kind: 'malformed', source: line },
      );
      continue;
    }

    const joy = JOY_RE.exec(line);
    if (joy) {
      const roles = joy[1]!
        .trim()
        .split(/\s+/)
        .map((word) => ROLES[word.toUpperCase()]);
      out.push(
        roles.every(Boolean)
          ? {
              kind: 'joystick',
              roles: roles as ControllerRole[],
              frames: joy[2] ? Number(joy[2]) : DEFAULT_JOY_FRAMES,
            }
          : { kind: 'malformed', source: line },
      );
      continue;
    }

    out.push({ kind: 'malformed', source: line });
  }
  return out;
}

/** What running a script produced, as its caller is told it. */
export interface DriveReport {
  /** Whether every action was carried out. */
  ok: boolean;
  /** One line per action, in order, saying what happened. */
  lines: string[];
  /** Emulated frames the whole script cost. */
  frames: number;
  /** True when any action actually sent input, as opposed to only waiting. */
  sentInput: boolean;
}

/**
 * Run a script against the machine, stopping at the first action that fails.
 *
 * Stopping rather than pressing on: the actions of a script are a sequence, and
 * every one after a failure was written for a screen that never arrived. Doing
 * them anyway would drive the machine somewhere nobody asked for.
 */
export function runDriveScript(
  control: MachineControl,
  actions: readonly DriveAction[],
): DriveReport {
  const lines: string[] = [];
  let frames = 0;
  let sentInput = false;

  for (const action of actions) {
    if (action.kind === 'malformed') {
      lines.push(`could not understand "${action.source}"`);
      return { ok: false, lines, frames, sentInput };
    }

    const step =
      action.kind === 'press'
        ? control.pressKeys(action.names, action.holdFrames)
        : action.kind === 'joystick'
          ? control.joystick(action.roles, action.frames)
          : action.kind === 'wait'
            ? control.advance(action.frames)
            : action.kind === 'waitEnd'
              ? control.waitForEnd(action.maxFrames)
              : control.waitForText(action.needle, action.maxFrames);

    frames += step.frames;
    if (action.kind === 'press' || action.kind === 'joystick') {
      // Recorded even when the step failed part-way: a key that reached the
      // machine changed what happened, whether or not the rest of the line did.
      sentInput = true;
    }

    if (!step.ok) {
      lines.push(step.detail ?? 'did not work');
      return { ok: false, lines, frames, sentInput };
    }
    lines.push(describe(action));
  }

  return { ok: true, lines, frames, sentInput };
}

/** One carried-out action, as a sentence in the report. */
export function describe(action: DriveAction): string {
  switch (action.kind) {
    case 'press':
      return `pressed ${action.names.join('+')}`;
    case 'joystick':
      return `held ${action.roles.join('+')} for ${action.frames} frames`;
    case 'wait':
      return `waited ${action.frames} frames`;
    case 'waitFor':
      return `"${action.needle}" appeared`;
    case 'waitEnd':
      return 'the program stopped';
    default:
      return 'did nothing';
  }
}
