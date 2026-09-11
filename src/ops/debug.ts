/**
 * Stopping a program on a line, stepping it, continuing it, and asking where it
 * is - on the machine a caller holds.
 *
 * Four operations rather than one with a mode, because that is how this layer is
 * already shaped: `look`, `screenshot`, `profile`, `time` and `variables` are
 * five operations that all read one held machine, and the command line reads as
 * verbs because of it. Each of these four also differs in the two things a
 * declaration has to state - what it needs and what it does to a machine being
 * played - so folding them into one would make a single declaration that had to
 * answer both ways at once.
 *
 * Nothing here knows how a machine stops. The whole of that is the machine's own
 * stopping path, driven through the session's driver
 * (`src/app/machineControl.ts`), which is the same path the IDE's debugger
 * drives - so a machine that steps badly here is a machine that steps badly in
 * the IDE, and no machine gains code for this.
 *
 * The assistant has none of the four, and `./parity.ts` says why: it works
 * inside an IDE where the machine it would step is the one on the user's screen,
 * the breakpoints are the ones in the gutter of the buffer they are looking at,
 * and stepping and continuing are already on the toolbar.
 */

import { MAX_DRIVE_FRAMES, type DebugEnding } from '../app/machineControl';
import type { MachineSession } from '../app/machineSession';
import type { Operation } from './types';

/**
 * What a caller is told about a machine that cannot be stepped.
 *
 * Says what can still be done with it, because the alternative is a caller that
 * concludes the machine is unusable from a refusal about one thing.
 */
export const CANNOT_STEP =
  'This machine cannot say which BASIC line it is executing, so it cannot be ' +
  'stepped: a line named to stop before would never be reached. You can still ' +
  'run a program on it, drive it with a schedule of keys to press, look at its ' +
  'screen and take a picture of it. "info" says of any machine whether it can ' +
  'be stepped.';

/** The frames a step or a continue may spend when the caller names no bound. */
const DEFAULT_DEBUG_FRAMES = MAX_DRIVE_FRAMES;

/** How long a step or a continue may run for; the bound the waits already use. */
const FRAMES_PROPERTY = {
  type: 'integer',
  description:
    'Emulated frames this may spend before reporting that it reached ' +
    `neither a stop nor the end of the program. At most ${MAX_DRIVE_FRAMES}, ` +
    'which is twenty seconds of the machine’s own time.',
} as const;

function requireSession(session: MachineSession | null): MachineSession {
  if (!session) throw new Error('no machine session');
  return session;
}

export interface BreakInput {
  /**
   * The BASIC line numbers to stop before. An empty list clears them, so the
   * program stops nowhere.
   */
  lines: number[];
}

export interface BreakOutcome {
  /** False on a machine that cannot be stepped; nothing was set. */
  canStep: boolean;
  /** The lines in force afterwards, ascending. */
  lines: number[];
}

export function describeBreak(outcome: BreakOutcome): string {
  if (!outcome.canStep) return CANNOT_STEP;
  if (outcome.lines.length === 0) {
    return 'The program now stops nowhere: continuing runs it to its end.';
  }
  return (
    `The program stops before ${outcome.lines.length === 1 ? 'line' : 'lines'} ` +
    `${outcome.lines.join(', ')}. A line this program does not carry is kept ` +
    'and simply never reached.'
  );
}

export const breakOp: Operation<BreakInput, BreakOutcome> = {
  name: 'break',
  summary: 'Say which BASIC lines the running program is to stop before.',
  description:
    'Name the BASIC lines the program on the running machine is to stop ' +
    'before, replacing whatever was in force; an empty list clears them. ' +
    'Returns the lines in force afterwards, so nothing has to be remembered. ' +
    'A line the program does not carry is accepted and simply never reached. ' +
    'Breakpoints for the first run of a program are given to the run itself, ' +
    'because by the time a machine is up the program has already finished; ' +
    'this is how they are changed between stops. Says so plainly on a machine ' +
    'that cannot be stepped.',
  input: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        items: { type: 'integer' },
        description:
          'The BASIC line numbers to stop before; empty clears them.',
      },
    },
    required: ['lines'],
    additionalProperties: false,
  },
  needs: 'session',
  cli: { kind: 'operation', name: 'break' },
  mcp: { kind: 'tool' },
  // The lines a played machine would be told to stop before are lines it will
  // run straight past: it is advancing on its own clock, so accepting them
  // would leave the caller holding breakpoints that never fire.
  played: 'refuse',
  run: (input, ctx) => {
    const session = requireSession(ctx.session);
    if (!session.canStep()) return { canStep: false, lines: [] };
    session.setBreakpoints(input.lines);
    return { canStep: true, lines: session.breakpoints() };
  },
  describe: describeBreak,
};

export interface DebugRunInput {
  /** Frames this may spend; the bound every other wait uses when absent. */
  maxFrames?: number;
}

/** What a step or a continue did, as an outcome a caller can read back. */
export interface DebugRunOutcome {
  /** False on a machine that cannot be stepped; nothing was run. */
  canStep: boolean;
  ending: DebugEnding;
  /** The BASIC line the program is now stopped before, or null. */
  line: number | null;
  /** Emulated frames it cost. */
  frames: number;
  /** Emulated seconds of the machine's own time it cost. */
  seconds: number;
  /** Whether a program is running now. */
  running: boolean | null;
}

/**
 * How a step or a continue reads.
 *
 * The cost travels with the outcome rather than being a second question,
 * because timing a stretch of a program a line at a time is most of what
 * stepping it is for.
 */
export function describeDebugRun(
  outcome: DebugRunOutcome,
  verb: 'Stepping' | 'Continuing',
): string {
  if (!outcome.canStep) return CANNOT_STEP;
  const cost =
    ` It cost ${outcome.seconds.toFixed(2)}s of this machine's own time ` +
    `(${outcome.frames} frame${outcome.frames === 1 ? '' : 's'}).`;
  switch (outcome.ending) {
    case 'stopped':
      return (
        `The program is stopped before line ${outcome.line}.` +
        cost +
        ' Read its variables, look at its screen, or step it on.'
      );
    case 'ended':
      return `The program ended, so it is stopped before no line.${cost}`;
    case 'exhausted':
      return (
        `${verb} reached neither a stop nor the end of the program within ` +
        `${outcome.frames} frames, and the machine is left running. A program ` +
        'that loops forever is an ordinary BASIC program; continue again, or ' +
        'name a line to stop before.'
      );
    case 'cannot-step':
      return CANNOT_STEP;
  }
}

export const stepOp: Operation<DebugRunInput, DebugRunOutcome> = {
  name: 'step',
  summary: 'Run the stopped program on to its next BASIC line.',
  description:
    'Run the stopped program on until the line about to be executed differs ' +
    'from the one it stopped at, so a line the program dwells on is one step ' +
    'rather than many. Returns the line it is now stopped before and what the ' +
    'step cost in the machine’s own emulated time, so a stretch of a program ' +
    'can be timed a line at a time. A step that ends the program says so ' +
    'rather than naming a line it never reached.',
  input: {
    type: 'object',
    properties: { maxFrames: FRAMES_PROPERTY },
    additionalProperties: false,
  },
  needs: 'session',
  cli: { kind: 'operation', name: 'step' },
  mcp: { kind: 'tool' },
  // A machine being played advances as fast as whoever is playing it, so a step
  // would be a request to move it one line while a person moves it many.
  played: 'refuse',
  run: (input, ctx) => {
    const session = requireSession(ctx.session);
    return outcomeOf(session, () =>
      session.stepLine(input.maxFrames ?? DEFAULT_DEBUG_FRAMES),
    );
  },
  describe: (outcome) => describeDebugRun(outcome, 'Stepping'),
};

export const continueOp: Operation<DebugRunInput, DebugRunOutcome> = {
  name: 'continue',
  summary: 'Run the stopped program on to its next stop or its end.',
  description:
    'Run the stopped program on until it stops before another of the lines in ' +
    'force or until it ends, and say which happened. Continuing off a line ' +
    'that is itself one of them runs on rather than stopping again at once. ' +
    'Bounded by the frames you give it: exhausting them reports that neither ' +
    'a stop nor the end was reached and is an ordinary outcome, because a ' +
    'program that loops forever is an ordinary BASIC program.',
  input: {
    type: 'object',
    properties: { maxFrames: FRAMES_PROPERTY },
    additionalProperties: false,
  },
  needs: 'session',
  cli: { kind: 'operation', name: 'continue' },
  mcp: { kind: 'tool' },
  // Continuing a machine that is already running on its own clock asks it to do
  // what it is doing anyway, and would report a stop nobody could rely on.
  played: 'refuse',
  run: (input, ctx) => {
    const session = requireSession(ctx.session);
    return outcomeOf(session, () =>
      session.continueRun(input.maxFrames ?? DEFAULT_DEBUG_FRAMES),
    );
  },
  describe: (outcome) => describeDebugRun(outcome, 'Continuing'),
};

/**
 * Run one of the two and report where the machine then is.
 *
 * `running` is read after the fact rather than inferred from the ending, so a
 * caller is told the same thing by a step as by asking where - and a machine
 * that ended its program between the two says so once.
 */
function outcomeOf(
  session: MachineSession,
  act: () => ReturnType<MachineSession['stepLine']>,
): DebugRunOutcome {
  if (!session.canStep()) {
    return {
      canStep: false,
      ending: 'cannot-step',
      line: null,
      frames: 0,
      seconds: 0,
      running: session.programState(),
    };
  }
  const ran = act();
  return {
    canStep: true,
    ending: ran.ending,
    line: ran.line,
    frames: ran.frames,
    seconds: ran.seconds,
    running: session.programState(),
  };
}

export interface WhereOutcome {
  /** Whether this machine can be stepped a BASIC line at a time. */
  canStep: boolean;
  /** The BASIC line about to execute, or null when none can be determined. */
  line: number | null;
  /** Whether a program is running; null on a machine still taking one. */
  running: boolean | null;
  /** The lines in force to stop before, ascending. */
  breakpoints: number[];
}

export function describeWhere(outcome: WhereOutcome): string {
  // Where the program is, then what it is set to stop on: a caller that has
  // just been handed a machine is told both, in that order, because the second
  // is what it needs in order to ask for the first to change.
  const where = !outcome.canStep
    ? CANNOT_STEP
    : outcome.running === false
      ? 'No program is running, so it is stopped before no line.'
      : outcome.line === null
        ? 'A program is running, and which line it is on cannot be determined right now.'
        : `The program is stopped before line ${outcome.line}.`;
  const stops = !outcome.canStep
    ? ''
    : outcome.breakpoints.length === 0
      ? ' No line is set to stop on.'
      : ` Set to stop before ${outcome.breakpoints.join(', ')}.`;
  return `${where}${stops}`;
}

export const whereOp: Operation<Record<never, never>, WhereOutcome> = {
  name: 'where',
  summary: 'Report where the running machine’s program is.',
  description:
    'Where the program on the running machine is: the BASIC line it is ' +
    'stopped before, whether a program is running at all, which lines are in ' +
    'force to stop on, and whether this machine can be stepped. Changes ' +
    'nothing and spends none of the machine’s frames, so a caller that has ' +
    'just been handed a machine and remembers nothing can ask.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'operation', name: 'where' },
  mcp: { kind: 'tool' },
  // Only reads, so it is answered of a played machine under the rule that
  // already covers reading a moving one: two answers may differ, and that is
  // not a fault.
  played: 'answer',
  run: (_input, ctx) => requireSession(ctx.session).position(),
  describe: describeWhere,
};
