/**
 * Saying what a program should produce, and checking it against the machine
 * that is up.
 *
 * The vocabulary is the schedule's (`src/app/driveScript.ts`), shared with
 * nothing to translate: what the assistant states in a `basic-expect` block
 * and what the command line reads from a file of expectations are the same
 * lines, read by one parser and judged by one evaluator, so the two callers
 * cannot reach different verdicts about the same program.
 *
 * Expectations sit among actions rather than after them, because the moment an
 * expectation is judged is a thing the caller says: `WAIT FOR` means "run
 * until this appears", and an expectation on its own means "this is true now".
 */

import {
  parseDriveScript,
  runDriveScript,
  stepLines,
  type ScheduleStep,
} from '../app/driveScript';
import type { MachineScreenText } from '../dialects/types';
import type { MachineSession } from '../app/machineSession';
import { describeScreen } from './drive';
import type { Operation } from './types';

export interface ExpectInput {
  /** The actions and expectations, one per line, as the caller wrote them. */
  expectations: string;
}

export interface ExpectOutcome {
  /** Whether every action was carried out and every expectation held. */
  ok: boolean;
  /** One entry per step reached, in order. */
  steps: ScheduleStep[];
  /** Emulated frames the whole schedule cost. */
  frames: number;
  /** The screen the last step left. */
  screen: MachineScreenText | null;
}

function requireSession(session: MachineSession | null): MachineSession {
  if (!session) throw new Error('no machine session');
  return session;
}

/** The step that stopped the schedule, when one did. */
export function failingStep(outcome: ExpectOutcome): ScheduleStep | undefined {
  return outcome.steps.find((step) => step.outcome === 'failed');
}

/** Expectations nobody present could settle - counted, never folded in. */
export function unevaluatedSteps(outcome: ExpectOutcome): ScheduleStep[] {
  return outcome.steps.filter((step) => step.outcome === 'unevaluated');
}

export const expectOp: Operation<ExpectInput, ExpectOutcome> = {
  name: 'expect',
  summary:
    'Say what a program should produce, and check it against the machine.',
  input: {
    type: 'object',
    properties: { expectations: { type: 'string' } },
    required: ['expectations'],
    additionalProperties: false,
  },
  needs: 'session',
  cli: { kind: 'option', operation: 'check', option: '--expect' },
  assistant: { kind: 'block', fence: 'basic-expect', example: 'EXPECT "HI"' },
  run: (input, ctx) => {
    const session = requireSession(ctx.session);
    const report = runDriveScript(
      session,
      parseDriveScript(input.expectations),
    );
    return {
      ok: report.ok,
      steps: report.steps,
      frames: report.frames,
      screen: session.readText(),
    };
  },
  failed: (outcome) => !outcome.ok,
  describe: (outcome) =>
    `${stepLines(outcome.steps).join('\n')}\n\n${describeScreen(outcome.screen)}`,
};
