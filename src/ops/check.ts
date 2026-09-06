/**
 * A program checked against what its author said it would do.
 *
 * The schedule is the same one a run can be given, with expectations mixed in
 * (`src/app/driveScript.ts`), and it is judged by the same operation the
 * assistant's own block is judged by - so a file written for one caller means
 * the same thing to the other, and neither can reach a verdict the other would
 * not.
 *
 * A check's product is its verdict, which is what separates it from a run: a
 * run reports the screen, and a caller who wants the picture at a moment asks
 * a run for it.
 *
 * The assistant does not have this operation, for the reason it does not have
 * `run`: its program is checked by the IDE on the user's own machine, and the
 * exemption table says so.
 */

import type { ScheduleStep } from '../app/driveScript';
import { RunError } from '../dialects/headless/runError';
import type { RunResult } from '../dialects/headless/runListing';
import type { MachineEmulator, MachineScreenText } from '../dialects/types';
import type { TokenizeError } from '../dialects/types';
import { expectOp, type ExpectOutcome } from './expect';
import { createHeadlessSession } from './headlessSession';
import { requireMachine } from './resolve';
import { checkSchedule } from './run';
import type { OpContext, Operation } from './types';

export interface CheckInput {
  machine: string;
  source: string;
  /** The actions and expectations, one per line, as the caller wrote them. */
  expectations: string;
  /** `public/` to read the ROMs from, when not the installation's own. */
  romRoot?: string;
}

export interface CheckOutcome {
  machine: RunResult['machine'];
  /** Tokenizer problems; a fatal one means nothing ran. */
  errors: TokenizeError[];
  programBytes: number;
  /** Every action carried out and every expectation held. */
  passed: boolean;
  /** One entry per step reached, in order. */
  steps: ScheduleStep[];
  /** How many expectations nobody here could settle. */
  unevaluated: number;
  /** Emulated frames the schedule cost. */
  frames: number;
  /** The screen as it stood when the check ended. */
  screen: MachineScreenText | null;
}

export const checkOp: Operation<CheckInput, CheckOutcome> = {
  name: 'check',
  summary:
    'Check a program against what it should do, and report a pass or a failure.',
  input: {
    type: 'object',
    properties: {
      machine: { type: 'string' },
      source: { type: 'string' },
      expectations: { type: 'string' },
      romRoot: { type: 'string' },
    },
    required: ['machine', 'source', 'expectations'],
    additionalProperties: false,
  },
  needs: 'runner',
  cli: { kind: 'operation', name: 'check' },
  mcp: { kind: 'tool' },
  run: async (input, ctx: OpContext): Promise<CheckOutcome> => {
    const runner = ctx.runner;
    if (!runner) throw new RunError('this caller cannot run a program');
    // Read before anything boots, so a line the tool cannot understand is the
    // caller's mistake rather than a check that got part-way.
    checkSchedule(input.expectations, 'the expectations');
    const dialect = requireMachine(input.machine);
    if (!ctx.roms.canRun(dialect, input.romRoot)) {
      // A verdict from a machine that ran nothing would say nothing about the
      // program: a ROM-less machine draws its missing-image notice, against
      // which every expectation would fail and every action would be driving
      // a notice.
      throw new RunError(
        `this installation carries no ROM for ${dialect.name}, so there is ` +
          'nothing to check the program against',
      );
    }

    // Held on one object so the closure below writes where this function
    // reads: the runner calls it, so a plain local narrows to never here.
    const seen: { checked: ExpectOutcome | null } = { checked: null };
    const result = await runner({
      machine: input.machine,
      source: input.source,
      drive: (machine: MachineEmulator, step: () => void) => {
        const session = createHeadlessSession({
          machine,
          dialect,
          step,
          source: input.source,
          measurements: null,
        });
        try {
          seen.checked = expectOp.run(
            { expectations: input.expectations },
            { ...ctx, session },
          ) as ExpectOutcome;
        } finally {
          // However the schedule ended, including part-way through a chord: a
          // key left down outlives the run and corrupts the screen it reports.
          session.releaseAll();
        }
      },
      romRoot: input.romRoot,
    });

    const outcome = seen.checked;
    return {
      machine: result.machine,
      errors: result.errors,
      programBytes: result.programBytes,
      // A fatal diagnostic means nothing ran, so there is nothing the program
      // can have got right.
      passed: outcome !== null && outcome.ok,
      steps: outcome?.steps ?? [],
      unevaluated:
        outcome?.steps.filter((step) => step.outcome === 'unevaluated')
          .length ?? 0,
      frames: outcome?.frames ?? 0,
      screen: outcome?.screen ?? result.screen,
    };
  },
  failed: (outcome) => !outcome.passed,
  describe: (outcome) =>
    outcome.passed
      ? 'Every expectation held.'
      : (outcome.steps.find((s) => s.outcome === 'failed')?.detail ??
        'The program did not run.'),
};
