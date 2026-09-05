/**
 * Which caller deliberately lacks which operation, and why.
 *
 * Every operation is reachable from both callers unless it is listed here, and
 * `src/ops/parity.test.ts` fails in both directions: an operation absent from
 * a surface with no entry, and an entry for an operation that is in fact
 * present on both. The second direction is what stops this becoming a list of
 * things nobody rechecked - wiring an operation up forces its entry out.
 *
 * An entry is a decision, read in review as one. A provider that cannot be
 * given tools at all is not an entry: that gates the assistant's whole surface
 * and is a property of the provider, not of any operation.
 */

import type { Operation } from './types';

export type Caller = 'assistant' | 'cli';

export interface Exemption {
  operation: string;
  caller: Caller;
  reason: string;
}

export const EXEMPTIONS: readonly Exemption[] = [
  {
    operation: 'run',
    caller: 'assistant',
    reason:
      "The assistant's program is run by the IDE on the user's own machine " +
      'as part of checking an answer, and the assistant is then given that ' +
      'machine to drive. A second run path, headless or otherwise, would ' +
      "check an answer against a machine that is not the user's.",
  },
  {
    operation: 'check',
    caller: 'assistant',
    reason:
      "Checking boots a machine and runs the program on it. The assistant's " +
      "program is checked by the IDE on the user's own machine, against the " +
      'expectations its reply states, and a second path would reach a ' +
      "verdict about a machine that is not the user's.",
  },
];

/** Whether the operation is reachable from that caller. */
export function reachable(op: Operation, caller: Caller): boolean {
  return caller === 'cli' ? op.cli !== undefined : op.assistant !== undefined;
}

/** The exemption for that operation on that caller, if one is declared. */
export function exemptionFor(
  op: Operation,
  caller: Caller,
): Exemption | undefined {
  return EXEMPTIONS.find((e) => e.operation === op.name && e.caller === caller);
}
