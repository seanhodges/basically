/**
 * Which caller deliberately lacks which operation, and why.
 *
 * Every operation is reachable from every caller unless it is listed here, and
 * `src/ops/parity.test.ts` fails in both directions: an operation absent from
 * a surface with no entry, and an entry for an operation that is in fact
 * present. The second direction is what stops this becoming a list of things
 * nobody rechecked - wiring an operation up forces its entry out.
 *
 * An entry is a decision, read in review as one, and its reason is about the
 * circumstances one caller works in rather than about the operation. So a
 * reason does not travel: a caller those circumstances do not describe is
 * offered the operation, which is why adding a caller widens what the
 * toolchain offers rather than inheriting what was withheld from another.
 *
 * A provider that cannot be given tools at all is not an entry: that gates the
 * assistant's whole surface and is a property of the provider, not of any
 * operation.
 */

import type { Operation } from './types';

export type Caller = 'assistant' | 'cli' | 'mcp';

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
      'The assistant works inside an IDE which runs its program on the ' +
      "user's own machine as part of checking an answer, and then hands the " +
      'assistant that machine to drive. A second run path, headless or ' +
      'otherwise, would check an answer against a machine that is not the ' +
      "user's. The reason is the IDE around this caller, so it reaches no " +
      'caller that has none.',
  },
  {
    operation: 'check',
    caller: 'assistant',
    reason:
      'Checking boots a machine and runs the program on it, and the IDE ' +
      "around the assistant already checks its program on the user's own " +
      'machine against the expectations its reply states. A second path ' +
      "would reach a verdict about a machine that is not the user's. Again " +
      'the reason is that IDE, and holds only for a caller inside one.',
  },
  {
    operation: 'convert',
    caller: 'assistant',
    reason:
      "The assistant's tool inputs travel as JSON matching a declared " +
      'schema, with no path from the model to bytes sitting on the ' +
      "user's disk - every existing tool's input is text already in the " +
      "editor or already produced by another operation. The browser's " +
      'own Import dialog already gives the user this exact capability ' +
      'from inside the IDE, which is the reason this reaches no caller ' +
      'without one.',
  },
];

/** Whether the operation is reachable from that caller. */
export function reachable(op: Operation, caller: Caller): boolean {
  switch (caller) {
    case 'cli':
      return op.cli !== undefined;
    case 'assistant':
      return op.assistant !== undefined;
    case 'mcp':
      return op.mcp !== undefined;
  }
}

/** The exemption for that operation on that caller, if one is declared. */
export function exemptionFor(
  op: Operation,
  caller: Caller,
): Exemption | undefined {
  return EXEMPTIONS.find((e) => e.operation === op.name && e.caller === caller);
}
