import type { ControllerRole } from '../keyboard/layoutSchema';
import type { MachineScreenText, MachineVariable } from '../dialects/types';
import type { MachineControl } from './machineControl';

/**
 * The vocabulary a caller drives a running machine in and says what it should
 * find there: one action per line, read into {@link DriveAction}s and run
 * against a {@link MachineControl}.
 *
 * Beside the driver rather than in the assistant's module, because the
 * assistant is not the only caller: the command line's `run --keys` and
 * `check` read the same script, and one grammar with one parser is what makes
 * a schedule written for one caller mean the same thing to the other. Nothing
 * here is about the assistant, and nothing here touches a machine directly -
 * the control it is handed owns the machine and the clock.
 *
 * Acting and expecting are one vocabulary rather than two because the moment
 * an expectation is judged is a thing the caller says: `WAIT FOR` already
 * means "run until this appears, and fail if it never does", so "it printed
 * this at some point" is a wait and "this is on screen now" is an expectation,
 * written in the order they are meant.
 */

/**
 * Every action a schedule accepts, as both callers are told it.
 *
 * The parser below is the only reader of a schedule, so what it accepts and
 * what a caller is told it accepts can only agree if they come from one list.
 * The command line's help and the assistant's tool description both render
 * these rows, and `src/ops/parity.test.ts` parses each `example` to prove the
 * parser still takes every row. A `#` line is a comment and not an action.
 */
export interface DriveActionDescription {
  kind: Exclude<DriveAction['kind'], 'malformed'>;
  /** How the action is written. */
  syntax: string;
  /** What it does, as a phrase. */
  meaning: string;
  /** A line the parser must read as this kind. */
  example: string;
}

export const DRIVE_ACTIONS: readonly DriveActionDescription[] = [
  {
    kind: 'press',
    syntax: 'PRESS <key>[+<key>...] [n]',
    meaning: 'press keys together, held for n frames',
    example: 'PRESS SHIFT+P 3',
  },
  {
    kind: 'joystick',
    syntax: 'JOY <up|down|left|right|fire|fire2> [n]',
    meaning: 'hold a joystick control for n frames',
    example: 'JOY LEFT FIRE 5',
  },
  {
    kind: 'wait',
    syntax: 'WAIT <n>',
    meaning: 'let the program run on for n frames',
    example: 'WAIT 25',
  },
  {
    kind: 'waitFor',
    syntax: 'WAIT FOR "<text>" [n]',
    meaning: 'run until that text is on screen, giving up after n frames',
    example: 'WAIT FOR "READY" 100',
  },
  {
    kind: 'waitEnd',
    syntax: 'WAIT END [n]',
    meaning: 'run until the program stops, giving up after n frames',
    example: 'WAIT END 100',
  },
  {
    kind: 'expect',
    syntax: 'EXPECT "<text>"',
    meaning: 'fail unless that text is on screen now',
    example: 'EXPECT "GAME OVER"',
  },
  {
    kind: 'expect',
    syntax: 'EXPECT NOT "<text>"',
    meaning: 'fail if that text is on screen now',
    example: 'EXPECT NOT "ERROR"',
  },
  {
    kind: 'expect',
    syntax: 'EXPECT STOPPED',
    meaning: 'fail unless the program has stopped',
    example: 'EXPECT STOPPED',
  },
  {
    kind: 'expect',
    syntax: 'EXPECT RUNNING',
    meaning: 'fail unless the program is still running',
    example: 'EXPECT RUNNING',
  },
  {
    kind: 'expect',
    syntax: 'EXPECT VAR <name> = <value>',
    meaning: 'fail unless that variable holds that value',
    example: 'EXPECT VAR TOTAL = 42',
  },
  {
    kind: 'expect',
    syntax: 'EXPECT SHOWS <description>',
    meaning:
      'fail unless the screen looks like that; only the assistant, shown the ' +
      'display, can settle one, so anyone else reports it unevaluated',
    example: 'EXPECT SHOWS a circle in the middle of the screen',
  },
];

/**
 * How one action is separated from the next, stated once for every caller.
 *
 * A newline separates actions, and so does a semicolon outside quotes - so a
 * whole schedule fits on one shell line, and a semicolon inside a quoted needle
 * stays part of the needle, because text on a screen is allowed to contain
 * one.
 */
export const DRIVE_SEPARATOR_RULE =
  'one action per line, or several on one line separated by ";"';

/** What an expectation says should be true of the machine at that moment. */
export type ScheduleExpectation =
  /** `needle` should be on the screen - or, negated, should not be. */
  | { kind: 'text'; needle: string; negated: boolean }
  /** The program should be running, or should have stopped. */
  | { kind: 'state'; running: boolean }
  /** A named variable should hold `value`. */
  | { kind: 'variable'; name: string; value: string }
  /**
   * The screen should look like `description` - the one form no machine can
   * evaluate, settled instead by showing the assistant the display and asking
   * it to judge its own program.
   */
  | { kind: 'shows'; description: string };

/**
 * One line of a schedule, already understood, beside where it was written and
 * how - so a failure can be reported where the caller can find it. Several
 * actions separated by semicolons share the line they were written on.
 */
export type DriveAction = ScheduleAction & {
  /** The 1-based line of the script it was written on. */
  line: number;
  /** The line as the caller wrote it, so a report can quote it back. */
  source: string;
};

/** An action as the parser reads it, before it is placed in the script. */
type ScheduleAction =
  | { kind: 'press'; names: string[]; holdFrames?: number }
  | { kind: 'joystick'; roles: ControllerRole[]; frames: number }
  | { kind: 'wait'; frames: number }
  | { kind: 'waitFor'; needle: string; maxFrames: number }
  | { kind: 'waitEnd'; maxFrames: number }
  | { kind: 'expect'; expectation: ScheduleExpectation }
  | { kind: 'malformed' };

const PRESS_RE = /^PRESS\s+(\S+)(?:\s+(\d+))?$/i;
const JOY_RE = /^JOY\s+([A-Z0-9\s]+?)(?:\s+(\d+))?$/i;
const WAIT_END_RE = /^WAIT\s+END(?:\s+(\d+))?$/i;
const WAIT_FOR_RE = /^WAIT\s+FOR\s+(.*)$/i;
const WAIT_RE = /^WAIT\s+(\d+)$/i;
/** A quoted needle, and the optional frame cap after it. */
const NEEDLE_RE = /^"([^"]*)"(?:\s+(\d+))?$/;

// Each named form is recognised by its keyword alone, so `EXPECT SHOWS` with
// nothing after it is a malformed `SHOWS` rather than an expectation that the
// word "SHOWS" is on the screen.
const EXPECT_NOT_RE = /^EXPECT\s+NOT\b\s*(.*)$/i;
const EXPECT_STOPPED_RE = /^EXPECT\s+STOPPED$/i;
const EXPECT_RUNNING_RE = /^EXPECT\s+RUNNING$/i;
const EXPECT_VAR_RE = /^EXPECT\s+VAR\b\s*(.*)$/i;
const EXPECT_SHOWS_RE = /^EXPECT\s+SHOWS\b\s*(.*)$/i;
const EXPECT_TEXT_RE = /^EXPECT\s+(.*)$/i;
/** The name and value of a variable expectation, in either spelling. */
const VAR_BINDING_RE = /^(\S+)\s*=\s*(.*)$/;

/**
 * The spellings the assistant wrote before the two vocabularies became one.
 *
 * Accepted but taught to nobody: conversations already saved contain them, and
 * a restored thread whose expectations came back as malformed would be a
 * record the IDE had stopped being able to read. The same courtesy the
 * machine-independent key names were given when they replaced the per-machine
 * ones - accept what is already written, teach only what is current.
 */
const LEGACY_SCREEN_RE = /^SCREEN\s+CONTAINS\s+(.*)$/i;
const LEGACY_SHOWS_RE = /^SCREEN\s+SHOWS\s+(.*)$/i;
const LEGACY_VAR_RE = /^VAR\b\s*(.*)$/i;

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
function waitForAction(rest: string): ScheduleAction | null {
  const quoted = NEEDLE_RE.exec(rest.trim());
  const needle = quoted ? quoted[1]! : unquote(rest);
  if (needle.trim() === '') return null;
  return {
    kind: 'waitFor',
    needle,
    maxFrames: quoted?.[2] ? Number(quoted[2]) : DEFAULT_WAIT_FOR_FRAMES,
  };
}

/** An expectation, or null for a line that states nothing to check. */
function expectation(line: string): ScheduleExpectation | null {
  const not = EXPECT_NOT_RE.exec(line);
  if (not) {
    const needle = unquote(not[1]!);
    return needle.trim() === ''
      ? null
      : { kind: 'text', needle, negated: true };
  }
  if (EXPECT_STOPPED_RE.test(line)) return { kind: 'state', running: false };
  if (EXPECT_RUNNING_RE.test(line)) return { kind: 'state', running: true };

  const variable = EXPECT_VAR_RE.exec(line) ?? LEGACY_VAR_RE.exec(line);
  if (variable) {
    const binding = VAR_BINDING_RE.exec(variable[1]!.trim());
    // `EXPECT VAR X =` states nothing to compare against.
    const value = binding?.[2]?.trim() ?? '';
    return value === ''
      ? null
      : { kind: 'variable', name: binding![1]!.trim(), value };
  }

  const shows = EXPECT_SHOWS_RE.exec(line) ?? LEGACY_SHOWS_RE.exec(line);
  if (shows) {
    // Nothing described is nothing to judge.
    const description = unquote(shows[1]!).trim();
    return description === '' ? null : { kind: 'shows', description };
  }

  const text = LEGACY_SCREEN_RE.exec(line) ?? EXPECT_TEXT_RE.exec(line);
  if (text) {
    // An empty needle matches every screen, so it asserts nothing.
    const needle = unquote(text[1]!);
    return needle.trim() === ''
      ? null
      : { kind: 'text', needle, negated: false };
  }
  return null;
}

/** True for a line that means to be an expectation, however it turns out. */
function looksLikeExpectation(line: string): boolean {
  return /^(EXPECT\b|SCREEN\s+CONTAINS\b|SCREEN\s+SHOWS\b|VAR\b)/i.test(line);
}

/**
 * Read a schedule, one action per line.
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
  for (const { text: raw, line: at } of splitActions(script)) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('#')) continue;
    const line = trimmed.replace(/[.;,]$/, '');
    if (line === '') continue;
    // Where it was written and how, carried by every action this line makes.
    const at_ = { line: at, source: line };
    const malformed: DriveAction = { kind: 'malformed', ...at_ };

    const waitEnd = WAIT_END_RE.exec(line);
    if (waitEnd) {
      out.push({
        kind: 'waitEnd',
        maxFrames: waitEnd[1] ? Number(waitEnd[1]) : DEFAULT_WAIT_FOR_FRAMES,
        ...at_,
      });
      continue;
    }

    const waitFor = WAIT_FOR_RE.exec(line);
    if (waitFor) {
      const action = waitForAction(waitFor[1]!);
      out.push(action ? { ...action, ...at_ } : malformed);
      continue;
    }

    const wait = WAIT_RE.exec(line);
    if (wait) {
      out.push({ kind: 'wait', frames: Number(wait[1]), ...at_ });
      continue;
    }

    if (looksLikeExpectation(line)) {
      const stated = expectation(line);
      out.push(
        stated ? { kind: 'expect', expectation: stated, ...at_ } : malformed,
      );
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
              ...at_,
            }
          : malformed,
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
              ...at_,
            }
          : malformed,
      );
      continue;
    }

    out.push(malformed);
  }
  return out;
}

/**
 * One action per entry, split at newlines and at semicolons outside quotes,
 * each carrying the 1-based line of the script it was written on.
 */
function splitActions(text: string): { text: string; line: number }[] {
  const actions: { text: string; line: number }[] = [];
  let action = '';
  let line = 1;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if ((ch === ';' || ch === '\n') && !quoted) {
      actions.push({ text: action, line });
      action = '';
      if (ch === '\n') line++;
      continue;
    }
    action += ch;
  }
  actions.push({ text: action, line });
  return actions;
}

/** How a step of a schedule went. */
export type StepOutcome =
  /** Carried out, or - for an expectation - held. */
  | 'done'
  /** Not carried out, or did not hold. The schedule stops here. */
  | 'failed'
  /**
   * Nobody present could settle it. Neither a pass nor a failure, and never
   * folded into either: a silent pass would be a claim nobody made, and a
   * failure would fail correct programs.
   */
  | 'unevaluated';

/** One step of a schedule, as its caller is told it. */
export interface ScheduleStep {
  action: DriveAction;
  outcome: StepOutcome;
  /** What it did, or why it did not, as a sentence. */
  detail: string;
}

/** What running a schedule produced, as its caller is told it. */
export interface DriveReport {
  /** Whether every action was carried out and every expectation held. */
  ok: boolean;
  /** One entry per step reached, in order. */
  steps: ScheduleStep[];
  /** Emulated frames the whole schedule cost. */
  frames: number;
  /** True when any action actually sent input, as opposed to only waiting. */
  sentInput: boolean;
}

/** A number as BASIC would print one - no hex, no leading `+.`, no bare sign. */
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Compare a stated value with the machine's reported one.
 *
 * `MachineVariable.value` is documented as already formatted for display, so a
 * string arrives carrying its own quotes and a number arrives however that
 * machine prints it. Rather than add a raw-value channel to the seam, the
 * comparison meets the display convention halfway: quotes are optional on both
 * sides, and two things that both parse as numbers are compared numerically so
 * `42`, `42.0` and a machine that pads to ` 42` all agree.
 *
 * Lenient in the one direction that cannot cause a false pass: it forgives
 * formatting, never a different value.
 */
export function valuesAgree(expected: string, actual: string): boolean {
  const e = unquote(expected);
  const a = unquote(actual);
  if (NUMBER_RE.test(e) && NUMBER_RE.test(a)) {
    // Exact equality after parsing - no epsilon. A tolerance that suits one
    // machine's float format is wrong for another's, and the caller can always
    // state the printed form instead.
    return Number(e) === Number(a);
  }
  return e === a;
}

/** Collapse runs of spaces so predicted text survives a machine's padding. */
function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Whether the needle is on the screen, matched the way a reader would. */
function onScreen(screen: MachineScreenText, needle: string): boolean {
  // Matched a row at a time, never across a row boundary: a fixed-width
  // machine breaks a line wherever its width falls, so a match that spanned
  // rows would be a claim about the width.
  const wanted = collapseSpaces(needle);
  return screen.lines.some((line) => collapseSpaces(line).includes(wanted));
}

function named(
  variables: readonly MachineVariable[],
  name: string,
): MachineVariable | undefined {
  const wanted = name.trim().toUpperCase();
  return variables.find((v) => v.name.trim().toUpperCase() === wanted);
}

/**
 * Judge one expectation against the machine as it stands, costing no frames.
 *
 * Where the reading it needs cannot be had, the answer is `unevaluated` rather
 * than a verdict: a machine that cannot report its variables has not said the
 * variable is wrong.
 */
export function judgeExpectation(
  control: Pick<MachineControl, 'readText' | 'programState' | 'variables'>,
  expectation: ScheduleExpectation,
): { outcome: StepOutcome; detail: string } {
  switch (expectation.kind) {
    case 'text': {
      const screen = control.readText();
      if (!screen) {
        return { outcome: 'unevaluated', detail: 'the screen cannot be read' };
      }
      const there = onScreen(screen, expectation.needle);
      const quoted = `"${expectation.needle}"`;
      if (there === !expectation.negated) {
        return {
          outcome: 'done',
          detail: expectation.negated
            ? `${quoted} is not on the screen`
            : `${quoted} is on the screen`,
        };
      }
      return {
        outcome: 'failed',
        detail: expectation.negated
          ? `${quoted} is on the screen`
          : `${quoted} is not on the screen`,
      };
    }
    case 'state': {
      const running = control.programState();
      if (running === null) {
        return {
          outcome: 'unevaluated',
          detail: 'this machine cannot say whether the program is running',
        };
      }
      const wanted = expectation.running ? 'running' : 'stopped';
      return running === expectation.running
        ? { outcome: 'done', detail: `the program is ${wanted}` }
        : {
            outcome: 'failed',
            detail: `the program is ${running ? 'running' : 'stopped'}, not ${wanted}`,
          };
    }
    case 'variable': {
      const variables = control.variables();
      if (variables === null) {
        return {
          outcome: 'unevaluated',
          detail: 'this machine cannot report its variables',
        };
      }
      const found = named(variables, expectation.name);
      if (!found) {
        return {
          outcome: 'failed',
          detail: `there is no variable called ${expectation.name}`,
        };
      }
      return valuesAgree(expectation.value, found.value)
        ? { outcome: 'done', detail: `${found.name} holds ${found.value}` }
        : {
            outcome: 'failed',
            detail: `${found.name} holds ${found.value}, not ${expectation.value}`,
          };
    }
    case 'shows':
      // Never judged from the machine: no reader answers "does this look
      // right". Settled only by showing the assistant the display, so every
      // other caller reports it as unevaluated rather than refusing the
      // schedule it arrived in.
      return {
        outcome: 'unevaluated',
        detail: 'only the assistant, shown the screen, can settle this',
      };
  }
}

/**
 * Run a schedule against the machine, stopping at the first step that fails.
 *
 * Stopping rather than pressing on: the steps of a schedule are a sequence,
 * and every one after a failure was written for a screen that never arrived.
 * Doing them anyway would drive the machine somewhere nobody asked for, and
 * would check expectations against it.
 */
export function runDriveScript(
  control: MachineControl,
  actions: readonly DriveAction[],
): DriveReport {
  const steps: ScheduleStep[] = [];
  let frames = 0;
  let sentInput = false;

  for (const action of actions) {
    if (action.kind === 'malformed') {
      steps.push({
        action,
        outcome: 'failed',
        detail: `could not understand "${action.source}"`,
      });
      return { ok: false, steps, frames, sentInput };
    }

    // An expectation costs no frames: it asks what is true now, at the point
    // in the schedule where it was written.
    if (action.kind === 'expect') {
      const judged = judgeExpectation(control, action.expectation);
      steps.push({ action, ...judged });
      if (judged.outcome === 'failed') {
        return { ok: false, steps, frames, sentInput };
      }
      continue;
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
      steps.push({
        action,
        outcome: 'failed',
        detail: step.detail ?? 'did not work',
      });
      return { ok: false, steps, frames, sentInput };
    }
    steps.push({ action, outcome: 'done', detail: describe(action) });
  }

  return { ok: true, steps, frames, sentInput };
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

/** One step per line, as a caller reading prose is shown them. */
export function stepLines(steps: readonly ScheduleStep[]): string[] {
  return steps.map((step) =>
    step.outcome === 'unevaluated'
      ? `${step.detail} (unevaluated)`
      : step.detail,
  );
}
