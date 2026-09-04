/**
 * Acting on the running machine through a schedule, and looking at what that
 * produced.
 *
 * The schedule's grammar is `src/app/driveScript.ts`, shared with nothing to
 * translate: a script the assistant writes and a `--keys` option on the
 * command line are read by the same parser and run over the same session.
 */

import {
  DRIVE_ACTIONS,
  DRIVE_SEPARATOR_RULE,
  parseDriveScript,
  runDriveScript,
} from '../app/driveScript';
import type { MachineScreenText } from '../dialects/types';
import type { MachineSession } from '../app/machineSession';
import type { Operation } from './types';

export interface DriveInput {
  /** The actions to perform; see {@link DRIVE_ACTIONS}. */
  script: string;
}

export interface DriveOutcome {
  /** Whether every action was carried out. */
  ok: boolean;
  /** One line per action, in order, saying what happened. */
  lines: string[];
  /** Emulated frames the whole script cost. */
  frames: number;
  /** True when any action actually sent input, as opposed to only waiting. */
  sentInput: boolean;
  /** The screen the last action left. */
  screen: MachineScreenText | null;
}

/** The screen as a model is shown it, or a note that it cannot be read. */
export function describeScreen(screen: MachineScreenText | null): string {
  if (!screen) return 'The screen cannot be read right now.';
  return `The screen (${screen.cols}x${screen.rows}):\n${screen.lines.join('\n')}`;
}

/** The actions as a model is told them, one per sentence. */
function describeActions(): string {
  return DRIVE_ACTIONS.map((a) => `\`${a.syntax}\` ${a.meaning}`).join('; ');
}

/** The session the context holds, which the tools layer has already checked for. */
function requireSession(session: MachineSession | null): MachineSession {
  if (!session) throw new Error('no machine session');
  return session;
}

export const driveOp: Operation<DriveInput, DriveOutcome> = {
  name: 'drive',
  summary:
    'Act on the running machine through a schedule of what to press and when.',
  description:
    'Act on the running machine, stopping at the first action that fails. ' +
    `Actions, ${DRIVE_SEPARATOR_RULE}: ${describeActions()}. ` +
    '`WAIT FOR` is more reliable than guessing a frame count. ' +
    'A `#` line is a comment. ' +
    'Returns what each action did and the screen afterwards.',
  input: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: `The actions to perform, ${DRIVE_SEPARATOR_RULE}.`,
      },
    },
    required: ['script'],
    additionalProperties: false,
  },
  needs: 'session',
  cli: { kind: 'option', operation: 'run', option: '--keys' },
  assistant: { kind: 'tool' },
  run: (input, ctx) => {
    const session = requireSession(ctx.session);
    const report = runDriveScript(session, parseDriveScript(input.script));
    return { ...report, screen: session.readText() };
  },
  // An action that could not be carried out is the driving failing, not the
  // program: flagged so a model corrects its driving rather than rewriting
  // code that may be perfectly correct.
  failed: (outcome) => !outcome.ok,
  describe: (outcome) =>
    `${outcome.lines.join('\n')}\n\n${describeScreen(outcome.screen)}`,
};

export interface LookOutcome {
  screen: MachineScreenText | null;
}

export const lookOp: Operation<Record<never, never>, LookOutcome> = {
  name: 'look',
  summary: 'Read the characters on the screen without changing anything.',
  description:
    'Look at the machine without changing anything. Returns the characters on screen.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'option', operation: 'run', option: '--screen-text' },
  assistant: { kind: 'tool' },
  run: (_input, ctx) => ({ screen: requireSession(ctx.session).readText() }),
  describe: (outcome) => describeScreen(outcome.screen),
};

export interface ScreenshotOutcome {
  picture: { width: number; height: number; png: string } | null;
}

/**
 * A picture of the display.
 *
 * The assistant's route is its view block rather than a tool: a tool's answer
 * is text, and a picture reaches a model only as an image on a turn, which is
 * what `SCREEN IMAGE` in a `basic-view` block asks for. Whether the picture
 * can be shown at all is a property of the provider, on the same terms as
 * being given tools.
 */
export const screenshotOp: Operation<
  Record<never, never>,
  ScreenshotOutcome
> = {
  name: 'screenshot',
  summary: 'Capture the display as a picture.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'option', operation: 'run', option: '--screenshot' },
  assistant: { kind: 'block', fence: 'basic-view', example: 'SCREEN IMAGE' },
  run: (_input, ctx) => ({ picture: requireSession(ctx.session).capture() }),
  describe: (outcome) =>
    outcome.picture
      ? `A ${outcome.picture.width}x${outcome.picture.height} picture of the screen.`
      : 'No picture of the screen could be taken.',
};
