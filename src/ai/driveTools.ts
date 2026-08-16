import type { ControllerRole } from '../keyboard/layoutSchema';
import type { MachineControl } from '../app/machineControl';
import type { ToolDefinition } from './providers/types';
import {
  lineAllocations,
  lineShares,
  routineAllocations,
  routineShares,
  totalAllocated,
  type RunProfile,
} from '../app/runProfile';
import { formatTiming, TIMING_ENDINGS, type RunTiming } from '../app/runTiming';
import type { OutlineCapabilities } from '../editor/programOutline';

/** Lines and routines listed before the answer becomes a wall of small shares. */
const PROFILE_TOOL_LINES = 12;

/**
 * The tools the assistant is given when it drives its own program: act on the
 * machine, look at it, ask where its last run's time went, and ask how long that
 * run took.
 *
 * Four, not eight. Driving is bounded by round trips - each one appends two
 * content blocks to a prefix a cache breakpoint can only walk twenty back
 * through - so the thing worth optimising is how much a single call can say. A
 * script lets "wait for the prompt, type an answer, let it run" cost one round
 * trip where three separate tools would cost three, and burn most of the bound
 * on a sequence the assistant already knew in full.
 *
 * The profile and the timing are tools rather than something appended to every
 * request for the same reason: they would vary on every turn by construction,
 * and varying content inside the cached prefix is what makes the whole prefix be
 * paid for at the write premium. Fetched only when the assistant is actually
 * working on speed.
 */
export const DRIVE_TOOL = 'drive';
export const LOOK_TOOL = 'look';
export const PROFILE_TOOL = 'profile';
export const TIME_TOOL = 'time';

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
    {
      name: PROFILE_TOOL,
      description:
        'Where the last run of this program spent its time and memory, as the ' +
        'IDE measured it and as the user is shown it. ' +
        'Returns the hottest BASIC lines as shares of the run, the same shares ' +
        'summed over the program’s routines, and BASIC RAM use across the run. ' +
        'Durations are the emulated machine’s own time, not time in the browser. ' +
        'A line’s cost is the time spent on that line alone: time inside a ' +
        'routine it calls is charged to that routine’s lines, so a call site ' +
        'reads as cheap however much work it sets off. ' +
        'Ask when the question is about speed or memory; the answer says so ' +
        'plainly when nothing has been measured yet.',
      input: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: TIME_TOOL,
      description:
        'How long the last run of this program took, in the emulated machine’s ' +
        'own time, and how that timing ended - the program finished, it stopped ' +
        'on an error, it was still running when the run was stopped, or ' +
        'execution paused. The duration and the ending come back together, ' +
        'because a duration without its ending says nothing: the seconds a ' +
        'program ran before someone stopped it are not the time it takes. ' +
        'The emulation speed does not change the answer, and neither does the ' +
        'machine you are running on. ' +
        'A timing COSTS A RUN: this describes the run that has already ' +
        'happened, so measuring a change means handing over the program and ' +
        'having it run again. Ask when the answer turns on how long something ' +
        'takes - is this version faster than the last one - and not by reflex.',
      input: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ];
}

/**
 * The timing of the last run, as the assistant is told it.
 *
 * The duration never travels alone. Its ending is what says whether the number
 * is a fact about the program or about when somebody got bored, and an assistant
 * holding two bare durations would compare two things that are not comparable.
 *
 * Where the machine cannot observe a program finishing, that is stated outright
 * rather than left to be inferred from an ending that never says "finished" -
 * otherwise the natural reading of "still running when the run was stopped" is
 * that the program is slow, when it may have finished long before.
 */
export function describeTiming(
  timing: RunTiming | null,
  /** False on a machine that cannot tell whether a program is still running. */
  canObserveFinish: boolean,
): string {
  const caveat = canObserveFinish
    ? ''
    : '\nThis machine CANNOT tell whether a BASIC program is still running, so it ' +
      'never observes one finishing: a timing on it ends when the run is stopped ' +
      'or when execution pauses, and never reports a finish however the program ' +
      'went. Do not read its duration as the time the program takes to complete.';
  if (!timing) {
    return 'Nothing has been timed: this program has not been run.' + caveat;
  }
  return (
    `The last run took ${formatTiming(timing.seconds)} of this machine's own ` +
    `time; ${TIMING_ENDINGS[timing.ending]}.` +
    caveat
  );
}

/**
 * The measurements of the last run, as the assistant is told them.
 *
 * The same accounting the user is shown, from the same store: the point of the
 * tool is that the two are never reading two different accounts of one run.
 *
 * A machine that cannot be measured, and a program that has not been run, are
 * said in words rather than answered with an empty list - an empty result reads
 * as "measured, and nothing took any time", which would have the assistant
 * conclude the program is already fast. The memory breakdown is said the same
 * way, and for a sharper version of the same reason: a machine whose figures
 * cannot see where a program's memory goes would otherwise have the assistant
 * report the program as taking none.
 */
export function describeProfile(
  profile: RunProfile | null,
  source: string,
  caps: OutlineCapabilities,
  /** False on a machine that cannot report which BASIC line it is executing. */
  canProfile: boolean,
): string {
  if (!canProfile) {
    return 'This machine cannot report which BASIC line it is executing, so runs on it are not measured.';
  }
  const shares = lineShares(profile?.lines ?? []);
  if (!profile || shares.length === 0) {
    return 'Nothing has been measured: this program has not been run, or has been edited since it was.';
  }

  const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
  const out = [
    `Where the last run's time went (${profile.elapsed.toFixed(1)}s of this machine's own time).`,
    "A line's cost EXCLUDES the routines it calls; that time is charged to the routine's own lines.",
    '',
    'Hottest lines:',
    ...shares
      .slice(0, PROFILE_TOOL_LINES)
      .map((s) => `  line ${s.line}: ${pct(s.share)}`),
  ];

  const routines = routineShares(source, caps, shares);
  if (routines.length > 0) {
    out.push('', 'Summed over each routine and jump destination:');
    for (const r of routines.slice(0, PROFILE_TOOL_LINES)) {
      out.push(`  line ${r.lineNo} (${r.title}): ${pct(r.share)}`);
    }
  }

  out.push('');
  if (profile.memory) {
    const { peakUsed, totalBytes, samples, partial } = profile.memory;
    const last = samples[samples.length - 1];
    out.push(
      `BASIC RAM: peaked at ${peakUsed} bytes of ${totalBytes} fitted` +
        (last ? `, ${last.used} bytes in use at the end of the run` : '') +
        '.' +
        (partial
          ? ' The run outlasted the retained record, so the peak covers the whole run but the series does not.'
          : ''),
    );
  } else {
    out.push('BASIC RAM: this machine does not report its memory figures.');
  }

  const account = profile.allocations;
  const taken = lineAllocations(account?.lines ?? []);
  out.push('');
  if (!account) {
    out.push('No memory readings were taken over this run.');
  } else if (taken.length === 0) {
    // Said rather than left as an empty list, for the reason the doc block
    // above gives: an empty list would read as a program that takes no memory,
    // and this one may simply be taking it where the machine's own figure
    // cannot see it.
    out.push('No line took memory this machine can account for over the run.');
  } else {
    out.push(
      `Which lines took the memory (${totalAllocated(account.lines)} bytes in ` +
        'all). Memory BASIC reclaimed afterwards is NOT subtracted - a line ' +
        'that builds strings and lets them go still reads as having taken them.',
    );
    if (account.accuracy === 'measured') {
      out.push(
        'A line is charged what it took itself, not what the routines it calls ' +
          'took.',
      );
    } else {
      // Capitals for the same reason the flat accounting has them, and instead
      // of it: nothing was charged to a line here, so the sentence about what a
      // line is charged would contradict this one.
      out.push(
        'These figures are APPROXIMATE. The machine never left a line while ' +
          'memory was moving, so nothing could be charged to the line that ' +
          'took it; each rise is spread over the lines running at the time in ' +
          "proportion to their share of the run's time. Treat the ranking as a " +
          'suggestion of where to look, not as a measurement.',
      );
    }
    for (const a of taken.slice(0, PROFILE_TOOL_LINES)) {
      out.push(`  line ${a.line}: ${a.bytes} bytes`);
    }
    const byRoutine = routineAllocations(source, caps, account.lines);
    if (byRoutine.length > 0) {
      out.push('', 'Summed over each routine and jump destination:');
      for (const r of byRoutine.slice(0, PROFILE_TOOL_LINES)) {
        out.push(`  line ${r.lineNo} (${r.title}): ${r.bytes} bytes`);
      }
    }
  }
  return out.join('\n');
}

/** The screen as the assistant is shown it, or a note that it cannot be read. */
export function describeScreen(control: MachineControl): string {
  const screen = control.readText();
  if (!screen) return 'The screen cannot be read right now.';
  return `The screen (${screen.cols}x${screen.rows}):\n${screen.lines.join('\n')}`;
}
