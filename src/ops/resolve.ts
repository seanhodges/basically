// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which machine a program-reading operation works on, and the caller's
 * mistake when nothing settles it.
 *
 * Naming a machine is optional when the program declares one (`#MACHINE
 * <name>`); naming one anyway overrides the declaration; and a caller pinned
 * to one machine - the assistant's conversation - supplies it as the context's
 * default, tried after the declaration. Naming a machine that is not
 * registered is the caller's mistake, and so is naming none while the program
 * declares none either.
 */

import { RunError } from '../dialects/headless/runError';
import { findMachine } from '../dialects/machineLookup';
import {
  resolveListing,
  type ResolvedListing,
} from '../dialects/resolveListing';
import type { Dialect, TokenizeError } from '../dialects/types';
import type { OpContext } from './types';

/** The dialect a name resolves to, refusing a name that is not registered. */
export function requireMachine(name: string): Dialect {
  const dialect = findMachine(name);
  if (!dialect) throw new RunError(`no registered machine "${name}"`);
  return dialect;
}

/**
 * The listing resolved to its machine, or the caller's mistake.
 *
 * The context's default is tried only after the program's own declaration,
 * because a program that says which machine it is for is right about that
 * whichever conversation it arrives in.
 */
export function resolveProgram(
  operation: string,
  input: { source: string; machine?: string },
  ctx: Pick<OpContext, 'defaultMachine'>,
): ResolvedListing & { dialect: Dialect } {
  const explicit =
    input.machine === undefined ? undefined : requireMachine(input.machine);
  let resolved = resolveListing(input.source, explicit);
  if (
    !resolved.dialect &&
    resolved.problems.length === 0 &&
    ctx.defaultMachine !== undefined
  ) {
    resolved = resolveListing(input.source, requireMachine(ctx.defaultMachine));
  }
  if (!resolved.dialect) throw noMachineError(operation, resolved.problems);
  return resolved as ResolvedListing & { dialect: Dialect };
}

/**
 * When the declaration itself is the reason nothing resolved (an
 * unregistered name, a malformed line, a second declaration), name that
 * problem at its line and column rather than the generic message - it is
 * more specific, and it is what the caller needs fixed. Otherwise, neither
 * `-m` nor a declaration said anything at all.
 */
export function noMachineError(
  operation: string,
  problems: readonly TokenizeError[],
): RunError {
  const specific = problems[0];
  if (specific) {
    const where =
      specific.column === undefined
        ? `${specific.line}`
        : `${specific.line}:${specific.column + 1}`;
    return new RunError(`${where}: ${specific.message}`);
  }
  return new RunError(
    `${operation} wants a machine: -m <machine>, or a #MACHINE declaration ` +
      'in the program (basically machines lists them)',
  );
}
