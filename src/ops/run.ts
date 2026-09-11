/**
 * A program run on its machine, and everything a caller can ask of that run.
 *
 * The command line holds no machine between invocations, so what the
 * assistant asks of a machine it is holding - press these keys, look, measure
 * - the command line asks of one run, as options on it. Each of those is the
 * same operation the assistant calls, run over a headless session inside this
 * one while the machine is still up.
 *
 * The assistant does not have this operation: its program is run by the IDE on
 * the user's own machine as part of checking an answer, and the exemption
 * table says so.
 */

import { parseDriveScript, type ScheduleStep } from '../app/driveScript';
import { RunMeasurements } from '../app/runMeasurements';
import type { RunObserver, RunResult } from '../dialects/headless/runTypes';
import { RunError } from '../dialects/headless/runError';
import type {
  MachineEmulator,
  MachineScreenText,
  TokenizeError,
} from '../dialects/types';
import { encodeBytes } from './bytes';
import { CANNOT_STEP } from './debug';
import { driveOp, type DriveOutcome } from './drive';
import { createHeadlessSession } from './headlessSession';
import { noRomHere } from './romless';
import {
  profileOp,
  timeOp,
  variablesOp,
  type ProfileOutcome,
  type TimeOutcome,
  type VariablesOutcome,
} from './measure';
import { requireMachine } from './resolve';
import type { HeadlessPainting, OpContext, Operation } from './types';

export interface RunInput {
  machine: string;
  source: string;
  /** Run exactly this many frames; with a schedule, this many more after it. */
  frames?: number;
  /** Cap on the wait for the program to end; not with a schedule. */
  maxFrames?: number;
  /** A schedule of what to press and when, as the caller wrote it. */
  keys?: string;
  /**
   * BASIC line numbers this run is to stop before, so a program can be stopped
   * part-way through the first time it is run. The machine is left where the
   * stop left it, for the operations that act on one.
   */
  breakpoints?: number[];
  /** Report the screen as text. */
  screenText: boolean;
  /** Paint the screen and return it as a picture. */
  screenshot: boolean;
  /** Report where the run's time and memory went. */
  profile: boolean;
  /** Report how long the run took and how it ended. */
  time: boolean;
  /** Report what the program's variables hold at the end of the run. */
  variables: boolean;
  /** `public/` to read the ROMs from, when not the installation's own. */
  romRoot?: string;
}

export interface RunOutcome {
  machine: RunResult['machine'];
  /** Tokenizer problems; a fatal one means nothing ran. */
  errors: TokenizeError[];
  programBytes: number;
  frames: number;
  driveFrames: number;
  /** What the schedule did, or null when none was given. */
  keys: { ok: boolean; steps: ScheduleStep[] } | null;
  started: boolean;
  ended: boolean;
  /**
   * The BASIC line the run stopped before, or null when it did not stop. The
   * third way a run can finish, told apart from ending and from using up its
   * frames without reading any prose.
   */
  stoppedAt: number | null;
  screen: MachineScreenText | null;
  picture: {
    width: number;
    height: number;
    colours: number;
    hostFontGlyphs: number;
    /** PNG bytes, base64. */
    png: string;
  } | null;
  timings: RunResult['timings'];
  /** Present when asked for. */
  profile?: ProfileOutcome;
  time?: TimeOutcome;
  variables?: VariablesOutcome;
}

/**
 * The schedule read before anything boots, so a schedule the tool cannot
 * understand is the caller's mistake rather than a run that got part-way.
 * Thrown where the parser merely records, naming the line and where it is.
 */
export function checkSchedule(text: string, called = '--keys'): void {
  const bad = parseDriveScript(text).find((a) => a.kind === 'malformed');
  if (bad) {
    throw new RunError(
      `cannot read line ${bad.line} of ${called}: ${bad.source}`,
    );
  }
}

export async function runProgram(
  input: RunInput,
  ctx: OpContext,
  painting: HeadlessPainting,
): Promise<RunOutcome> {
  const runner = ctx.runner;
  if (!runner) throw new RunError('this caller cannot run a program');
  if (input.keys !== undefined) checkSchedule(input.keys);
  const dialect = requireMachine(input.machine);
  if (input.keys !== undefined && !ctx.roms.canRun(dialect, input.romRoot)) {
    // An undriven run on a ROM-less machine draws its missing-image notice,
    // which at least says the machine boots. A driven one has nothing to
    // drive, so it is refused before a step is taken rather than reporting a
    // schedule that failed against a notice.
    throw new RunError(noRomHere(dialect.name, 'nothing for --keys to drive'));
  }
  const stops = input.breakpoints ?? [];
  if (stops.length > 0) {
    // The same reason, in its own words: without the ROM no BASIC line is ever
    // executed, so the stop the caller asked for could never come.
    if (!ctx.roms.canRun(dialect, input.romRoot)) {
      throw new RunError(
        noRomHere(dialect.name, 'no BASIC line is ever reached to stop before'),
      );
    }
    // Asked of the machine rather than discovered after a run that never
    // stopped: steppability is what the machine declares, and a caller told now
    // can still run the program without a stop.
    if (dialect.debuggable !== true) throw new RunError(CANNOT_STEP);
  }

  const measuring = input.profile || input.time;
  // Filled in by the hooks below, which run inside the runner; held on one
  // object so the closures write where this function reads.
  const seen: {
    measurements: RunMeasurements | null;
    drive: DriveOutcome | null;
    profile?: ProfileOutcome;
    time?: TimeOutcome;
    variables?: VariablesOutcome;
  } = { measurements: null, drive: null };

  const sessionOver = (machine: MachineEmulator, step: () => void) =>
    createHeadlessSession({
      machine,
      dialect,
      step,
      source: input.source,
      measurements: seen.measurements,
      paint: painting.painter(machine),
      encodePng: painting.encodePng,
    });

  const observe: RunObserver = {
    loaded: (machine) => {
      if (!measuring) return;
      seen.measurements = new RunMeasurements(null, input.source);
      seen.measurements.arm(machine);
    },
    frame: (machine) => {
      seen.measurements?.frame(machine);
    },
    finished: async (machine) => {
      // A run the program did not end on its own was stopped by the cap, and
      // its timing says so rather than reading as the time the program takes.
      seen.measurements?.stop();
      const session = sessionOver(machine, () => {
        machine.runFrame();
        seen.measurements?.frame(machine);
      });
      const inner: OpContext = { ...ctx, session };
      if (input.profile) seen.profile = await profileOp.run({}, inner);
      if (input.time) seen.time = await timeOp.run({}, inner);
      if (input.variables) seen.variables = await variablesOp.run({}, inner);
    },
  };

  const result = await runner({
    machine: input.machine,
    source: input.source,
    frames: input.frames,
    maxFrames: input.maxFrames,
    breakpoints: stops,
    drive:
      input.keys === undefined
        ? undefined
        : (machine, step) => {
            const session = sessionOver(machine, step);
            try {
              seen.drive = driveOp.run(
                { script: input.keys! },
                { ...ctx, session },
              ) as DriveOutcome;
            } finally {
              // However the schedule ended, including part-way through a chord:
              // a key left down outlives the run and corrupts the screen it
              // reports.
              session.releaseAll();
            }
          },
    observe,
    pixels: input.screenshot,
    romRoot: input.romRoot,
  });

  const { drive, profile, time, variables } = seen;
  return {
    machine: result.machine,
    errors: result.errors,
    programBytes: result.programBytes,
    frames: result.frames,
    driveFrames: result.driveFrames,
    keys: drive ? { ok: drive.ok, steps: drive.steps } : null,
    started: result.started,
    ended: result.ended,
    stoppedAt: result.stoppedAt,
    screen: result.screen,
    picture: result.picture
      ? {
          width: result.picture.width,
          height: result.picture.height,
          colours: result.picture.colours,
          hostFontGlyphs: result.picture.hostFontGlyphs,
          png: encodeBytes(
            painting.encodePng(
              result.picture.rgba,
              result.picture.width,
              result.picture.height,
            ),
          ),
        }
      : null,
    timings: result.timings,
    ...(profile !== undefined ? { profile } : {}),
    ...(time !== undefined ? { time } : {}),
    ...(variables !== undefined ? { variables } : {}),
  };
}

/**
 * The declaration. Its `run` needs the painting the caller supplies, which
 * the context carries as {@link OpContext.painting}; see {@link runProgram}.
 */
export const runOp: Operation<RunInput, RunOutcome> = {
  name: 'run',
  summary: 'Run a program on its machine and report what the screen shows.',
  description:
    'Run a program on its machine and report what the screen shows. ' +
    '`breakpoints` names BASIC lines the program is to stop before: a run ' +
    'that stopped says which line it stopped at and leaves the machine there, ' +
    'for "where", "variables", "step" and "continue" to act on. They are given ' +
    'here rather than afterwards because a machine is held by having run ' +
    'something, so by the time one could be asked to stop, the program it was ' +
    'to stop has finished.',
  input: {
    type: 'object',
    properties: {
      machine: { type: 'string' },
      source: { type: 'string' },
      frames: { type: 'integer' },
      maxFrames: { type: 'integer' },
      keys: { type: 'string' },
      breakpoints: { type: 'array', items: { type: 'integer' } },
      screenText: { type: 'boolean' },
      screenshot: { type: 'boolean' },
      profile: { type: 'boolean' },
      time: { type: 'boolean' },
      variables: { type: 'boolean' },
      romRoot: { type: 'string' },
    },
    required: [
      'machine',
      'source',
      'screenText',
      'screenshot',
      'profile',
      'time',
      'variables',
    ],
    additionalProperties: false,
  },
  needs: 'runner',
  cli: { kind: 'operation', name: 'run' },
  mcp: { kind: 'tool' },
  run: (input, ctx) => {
    if (!ctx.painting) throw new RunError('this caller cannot paint a screen');
    return runProgram(input, ctx, ctx.painting);
  },
  failed: (outcome) =>
    outcome.errors.some((e) => e.fatal !== false) ||
    (outcome.keys !== null && !outcome.keys.ok),
  describe: (outcome) =>
    outcome.screen
      ? outcome.screen.lines.join('\n')
      : 'The screen cannot be read.',
};
