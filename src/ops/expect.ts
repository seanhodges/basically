/**
 * Stating what a program should produce once it has run, and checking it.
 *
 * The assistant states expectations in a `basic-expect` block beside its
 * code, and the IDE checks them against the run as it goes. The command line
 * has no route to this yet: its absence is a declared entry in the exemption
 * table, and the vocabulary is the assistant's own until the two are
 * reconciled.
 */

import {
  evaluateExpectations,
  parseExpectations,
  type ExpectationResult,
} from '../ai/expectations';
import type { MachineSession } from '../app/machineSession';
import type { Operation } from './types';

export interface ExpectInput {
  /** The expectations, one per line, as a `basic-expect` block carries them. */
  expectations: string;
}

export interface ExpectOutcome {
  results: ExpectationResult[];
}

function requireSession(session: MachineSession | null): MachineSession {
  if (!session) throw new Error('no machine session');
  return session;
}

export const expectOp: Operation<ExpectInput, ExpectOutcome> = {
  name: 'expect',
  summary: 'State what a program should produce once it has run, and check it.',
  input: {
    type: 'object',
    properties: { expectations: { type: 'string' } },
    required: ['expectations'],
    additionalProperties: false,
  },
  needs: 'session',
  assistant: { kind: 'block', fence: 'basic-expect', example: 'VAR A = 1' },
  run: (input, ctx) => {
    const session = requireSession(ctx.session);
    return {
      results: evaluateExpectations(parseExpectations(input.expectations), {
        variables: session.variables(),
        screen: session.readText(),
      }),
    };
  },
  failed: (outcome) => outcome.results.some((r) => r.status === 'failed'),
  describe: (outcome) =>
    outcome.results
      .map((r) => {
        const detail =
          r.actual !== undefined
            ? ` (got ${r.actual})`
            : r.reason
              ? ` (${r.reason})`
              : '';
        return `${r.expectation.source}: ${r.status}${detail}`;
      })
      .join('\n'),
};
