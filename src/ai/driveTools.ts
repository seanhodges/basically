import type { ControllerRole } from '../keyboard/layoutSchema';
import type { MachineControl } from '../app/machineControl';
import type { ToolDefinition } from './providers/types';

/**
 * The tools the assistant is given when it drives its own program.
 *
 * Two, not seven. Driving is bounded by round trips - each one appends two
 * content blocks to a prefix a cache breakpoint can only walk twenty back
 * through - so the thing worth optimising is how much a single call can say. A
 * script lets "wait for the prompt, type an answer, let it run" cost one round
 * trip where three separate tools would cost three, and burn most of the bound
 * on a sequence the assistant already knew in full.
 */
export const DRIVE_TOOL = 'drive';
export const LOOK_TOOL = 'look';

/** One line of a drive script, already understood. */
export type DriveAction =
  | { kind: 'press'; names: string[]; holdFrames?: number }
  | { kind: 'joystick'; roles: ControllerRole[]; frames: number }
  | { kind: 'wait'; frames: number }
  | { kind: 'waitFor'; needle: string; maxFrames: number }
  | { kind: 'malformed'; source: string };

const PRESS_RE = /^PRESS\s+(\S+)(?:\s+(\d+))?$/i;
const JOY_RE = /^JOY\s+([A-Z0-9\s]+?)(?:\s+(\d+))?$/i;
const WAIT_FOR_RE = /^WAIT\s+FOR\s+(.*)$/i;
const WAIT_RE = /^WAIT\s+(\d+)$/i;

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

/**
 * Read a drive script, one action per line.
 *
 * Never throws and never drops a line: an action it cannot read comes back as
 * `malformed` and is reported to the assistant, because a line silently ignored
 * reads as a line that worked - and the assistant would then blame its program
 * for a screen its own driving never reached.
 */
export function parseDriveScript(script: string): DriveAction[] {
  const out: DriveAction[] = [];
  for (const raw of script.split('\n')) {
    const line = raw.trim().replace(/[.;,]$/, '');
    if (line === '') continue;

    const waitFor = WAIT_FOR_RE.exec(line);
    if (waitFor) {
      const needle = unquote(waitFor[1]!);
      out.push(
        needle.trim() === ''
          ? { kind: 'malformed', source: line }
          : { kind: 'waitFor', needle, maxFrames: DEFAULT_WAIT_FOR_FRAMES },
      );
      continue;
    }

    const wait = WAIT_RE.exec(line);
    if (wait) {
      out.push({ kind: 'wait', frames: Number(wait[1]) });
      continue;
    }

    const press = PRESS_RE.exec(line);
    if (press) {
      out.push({
        kind: 'press',
        names: [press[1]!],
        ...(press[2] ? { holdFrames: Number(press[2]) } : {}),
      });
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

/** What running a script produced, as the assistant is told it. */
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

function describe(action: DriveAction): string {
  switch (action.kind) {
    case 'press':
      return `pressed ${action.names.join('+')}`;
    case 'joystick':
      return `held ${action.roles.join('+')} for ${action.frames} frames`;
    case 'wait':
      return `waited ${action.frames} frames`;
    case 'waitFor':
      return `"${action.needle}" appeared`;
    default:
      return 'did nothing';
  }
}

/**
 * What the user is told about driving, or an empty string when there is nothing
 * worth telling them.
 *
 * Stated only when input actually reached the machine. Waiting and looking
 * change nothing the user could not have seen for themselves, where a keypress
 * produces a screen they cannot otherwise account for - and an unexplained
 * screen reads as the IDE having done something odd rather than as the
 * assistant having tried the program.
 */
export function describeDriving(reports: readonly DriveReport[]): string {
  const done = reports
    .filter((r) => r.sentInput)
    .flatMap((r) => r.lines)
    .filter((line) => line.startsWith('pressed') || line.startsWith('held'));
  return done.length ? `Tried the program: ${done.join(', ')}.` : '';
}

/**
 * The tool definitions, which must be the same bytes for every turn of a
 * conversation or the cached prefix behind them is lost.
 *
 * Built from a constant rather than from the machine: what varies per dialect
 * is the *key names*, and those live in the system prompt, which is already a
 * per-dialect constant. Keeping them out of here means one tool block for every
 * machine.
 */
export function driveToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: DRIVE_TOOL,
      description:
        'Act on the running machine, one action per line, stopping at the first that fails. ' +
        'Actions: `PRESS <key> [frames]` presses a key this machine has; ' +
        '`JOY <up|down|left|right|fire|fire2> [frames]` holds a joystick control; ' +
        '`WAIT <frames>` lets the program run on; ' +
        '`WAIT FOR "<text>"` runs until that text is on screen, which is more reliable than guessing a frame count. ' +
        'Returns what each action did and the screen afterwards.',
      input: {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description: 'The actions to perform, one per line.',
          },
        },
        required: ['script'],
        additionalProperties: false,
      },
    },
    {
      name: LOOK_TOOL,
      description:
        'Look at the machine without changing anything. Returns the characters on screen.',
      input: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ];
}

/** The screen as the assistant is shown it, or a note that it cannot be read. */
export function describeScreen(control: MachineControl): string {
  const screen = control.readText();
  if (!screen) return 'The screen cannot be read right now.';
  return `The screen (${screen.cols}x${screen.rows}):\n${screen.lines.join('\n')}`;
}
