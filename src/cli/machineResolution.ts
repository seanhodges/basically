// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The caller's mistake when `-m`, the program's own `#MACHINE` declaration,
 * or both together, still leave no dialect to work with. Shared by `lint`
 * and `build`, the two operations naming a machine is optional for.
 */

import { RunError } from '../dialects/headless/runListing';
import type { TokenizeError } from '../dialects/types';

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
