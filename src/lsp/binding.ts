// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which machine a document is for, decided in the order the editor capability
 * spec requires: the listing's own `#MACHINE` declaration, whenever present,
 * always wins; failing that, what the user has configured; failing that,
 * inference from the listing itself; and inference declines rather than
 * guessing among several machines that read the program equally.
 *
 * Nothing here talks to the protocol - it is a pure function of a document's
 * text and the one configured-machine name the connection layer resolved
 * (from `basically.machine` were the client pulls configuration, or from
 * `initializationOptions` for one that doesn't - the two are one input here,
 * because both mean "the user configured this" and neither out-ranks the
 * other).
 */
import { findMachine } from '../dialects/headless/runListing';
import { readMachineDirective } from '../dialects/machineDirective';
import { computeCompatibleDialects } from '../share/compatibility';
import type { Dialect } from '../dialects/types';

/** Where a binding's machine came from, most specific first. */
export type MachineSource = 'declared' | 'configured' | 'inferred';

export interface BoundMachine {
  kind: 'bound';
  dialect: Dialect;
  source: MachineSource;
}

export interface DeclinedMachine {
  kind: 'declined';
  /** Human-readable reason, shown to the user as the one diagnostic a declined binding publishes. */
  reason: string;
}

export type MachineBinding = BoundMachine | DeclinedMachine;

/**
 * Infer a listing's machine from its text alone: bind when exactly one
 * registered dialect's tokenizer accepts it with zero errors, decline on none
 * or several. Built on {@link computeCompatibleDialects}, the same answer the
 * share flow already gives - a user who has seen the product say a program is
 * compatible with several machines should not then see this server assert it
 * is for one of them.
 */
export function inferMachine(source: string): Dialect | undefined {
  const compatible = computeCompatibleDialects(source);
  if (compatible.length !== 1) return undefined;
  return findMachine(compatible[0]!);
}

/**
 * Resolve which machine `source` is for. `configuredMachine` is the one name
 * the user has configured, by whichever means the connection layer read it;
 * absent when they have configured none.
 */
export function bindMachine(
  source: string,
  configuredMachine?: string,
): MachineBinding {
  const directive = readMachineDirective(source);
  if (directive.name !== undefined) {
    const declared = findMachine(directive.name);
    if (declared)
      return { kind: 'bound', dialect: declared, source: 'declared' };
    return {
      kind: 'declined',
      reason:
        `The program declares "#MACHINE ${directive.name}", which is not a ` +
        'registered machine.',
    };
  }

  if (configuredMachine !== undefined) {
    const configured = findMachine(configuredMachine);
    if (configured) {
      return { kind: 'bound', dialect: configured, source: 'configured' };
    }
    return {
      kind: 'declined',
      reason:
        `"basically.machine" is set to "${configuredMachine}", which is not ` +
        'a registered machine.',
    };
  }

  const inferred = inferMachine(source);
  if (inferred) return { kind: 'bound', dialect: inferred, source: 'inferred' };
  return {
    kind: 'declined',
    reason:
      'Could not tell which machine this program is for. Set ' +
      '"basically.machine" in your editor, or add a "#MACHINE <name>" line ' +
      'to the top of the program.',
  };
}
