/**
 * Every declared operation, in the order each surface lists them.
 *
 * The order is load-bearing for the assistant: its tool definitions render in
 * this order and must be the same bytes on every turn of a conversation, so
 * this list is what pins them. `src/ops/parity.test.ts` holds both callers to
 * it.
 */

import { buildOp } from './build';
import { driveOp, lookOp, screenshotOp } from './drive';
import { expectOp } from './expect';
import { infoOp } from './info';
import { lintOp } from './lint';
import { machinesOp } from './machines';
import { profileOp, timeOp, variablesOp } from './measure';
import { runOp } from './run';
import type { Operation } from './types';

// Each is typed over its own input and outcome; the list is over `unknown`
// because a caller dispatching by name has neither until it has looked up.
export const OPERATIONS: readonly Operation[] = [
  machinesOp,
  infoOp,
  lintOp,
  buildOp,
  runOp,
  driveOp,
  lookOp,
  screenshotOp,
  profileOp,
  timeOp,
  variablesOp,
  expectOp,
] as Operation[];

/** The operation of that name, or undefined. */
export function findOperation(name: string): Operation | undefined {
  return OPERATIONS.find((op) => op.name === name);
}
