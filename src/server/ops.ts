// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One call, dispatched onto the operation it names.
 *
 * Every caller a host serves asks the same three questions of a call - is
 * there such an operation, does its input fit, and is there a machine if it
 * needs one - and then has to handle the one subtlety of running a program on a
 * machine that stays up. Written once here, and rendered by each caller in its
 * own shape: the agent's server turns the answer into the protocol's content
 * blocks, the command line's client turns it into columns and an exit code.
 *
 * A call that cannot be carried out is refused rather than thrown past: a
 * caller told what was wrong can correct itself and carry on, where one handed
 * a dead host has to start again from a cold machine. {@link CallRefused}
 * carries which of the two failures it was, so the answer a caller reports is
 * the one the host reached rather than one re-derived from a message.
 *
 * The host is passed in rather than imported so that nothing here depends on
 * how a machine is held - which is what lets the same dispatch serve a machine
 * held in this thread and one held in a worker.
 */

import { RunError } from '../dialects/headless/runError';
import { profileOp, timeOp } from '../ops/measure';
import { findOperation } from '../ops/registry';
import { schemaProblem } from '../ops/schema';
import type { OpContext, Operation } from '../ops/types';
import type { FailureKind } from './protocol';

/** What a caller is told when it asks for something needing a machine. */
export const WITHOUT_A_MACHINE =
  'No machine is up. Run a program first: the machine it runs on stays up, ' +
  'and every later request acts on it.';

/** A call that could not be carried out, and which kind of failure that is. */
export class CallRefused extends Error {
  readonly failure: FailureKind;

  constructor(message: string, failure: FailureKind = 'request') {
    super(message);
    this.failure = failure;
  }
}

/**
 * What the dispatch needs of whoever is holding the machine.
 *
 * Structural rather than the machine's own type, so this module depends on
 * nothing that boots one and can be tested without a ROM.
 */
export interface CallHost {
  /**
   * The context as it stands now. Built per call rather than once, so a call
   * arriving after a program has been run is given the machine that program
   * left running rather than the absence there was at startup.
   */
  context(): OpContext;
  /** The machine held now, named, or null when none is. */
  heldMachine(): { name: string; token: unknown } | null;
}

/**
 * The measurements a run reports for a caller whose machine stays up.
 *
 * A caller holding no machine folds them into the run, because by the time it
 * could ask, the machine is gone. Where the machine stays up the reading is
 * taken from it afterwards - and taken once, because draining a machine's
 * per-line costs takes them, and a second fold over the same run would see what
 * the first left. The caller is answered either way; only where the number
 * comes from differs.
 */
const MEASURED_AFTERWARDS: readonly Operation[] = [profileOp, timeOp];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface CallOutcome {
  outcome: unknown;
  /** What the host has to say about what this call did to the machine it holds. */
  notes: string[];
  /** Whether the outcome is the operation not having done what was asked. */
  failed: boolean;
}

/**
 * Run one call. `reaches` is the caller's own answer to whether it offers that
 * operation, which differs between callers and is the parity table's business
 * rather than this one's. `noun` is what that caller calls one, so a client is
 * refused in the vocabulary its own protocol uses rather than in this layer's.
 */
export async function runOperation(
  name: string,
  input: unknown,
  host: CallHost,
  reaches: (op: Operation) => boolean,
  noun = 'operation',
): Promise<CallOutcome> {
  const op = findOperation(name);
  if (!op || !reaches(op)) {
    throw new CallRefused(`there is no ${noun} called "${name}"`);
  }
  const ctx = host.context();
  if (op.needs === 'session' && ctx.session === null) {
    throw new CallRefused(WITHOUT_A_MACHINE);
  }
  const problem = schemaProblem(op.input, input);
  if (problem) throw new CallRefused(problem);

  // Read before the run, because a run replaces it.
  const before = host.heldMachine();
  let asked = input;
  const afterwards: Operation[] = [];
  if (op.needs === 'runner' && isObject(input)) {
    for (const measure of MEASURED_AFTERWARDS) {
      if (input[measure.name] === true) {
        asked = { ...(asked as object), [measure.name]: false };
        afterwards.push(measure);
      }
    }
  }

  let outcome: unknown;
  try {
    outcome = await op.run(asked, ctx);
  } catch (error) {
    if (error instanceof RunError) throw new CallRefused(error.message);
    throw error;
  }

  const notes: string[] = [];
  const after = host.heldMachine();
  if (before && after && before.token !== after.token) {
    notes.push(
      `The ${before.name} that was up has been let go; one machine is held ` +
        'at a time.',
    );
  }
  // Read from the machine the run left up, through the same operations a
  // caller could ask for itself. A run that never booted one - a program with a
  // fatal problem in it - has its errors as the answer, and nothing to measure.
  if (after) {
    const held = host.context();
    for (const measure of afterwards) {
      notes.push(measure.describe(await measure.run({}, held)));
    }
  }
  return { outcome, notes, failed: op.failed?.(outcome) === true };
}
