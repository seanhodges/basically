// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The one point, above the `Dialect` seam, where a `#MACHINE` declaration is
 * honoured. Every path that turns a listing into bytes - running, exporting,
 * sharing, checking, the byte count behind the RAM budget - routes through
 * this module rather than calling `dialect.tokenize`/`dialect.lint` on the
 * user's text directly, so a missed path cannot behave differently from the
 * rest.
 *
 * A future above-the-seam text substitution (resolving a name to a number
 * before tokenizing, say) wants the same single point rather than a second
 * one of its own; extend {@link resolveListing} for that instead.
 */

import { findMachine } from './machineLookup';
import { readMachineDirective } from './machineDirective';
import type { Dialect, TokenizeError, TokenizeResult } from './types';

export interface ResolvedListing {
  /**
   * The dialect to tokenize/lint against: `dialect` when one was given (an
   * explicit choice always wins over the declaration), else the one the
   * listing declares, else undefined when neither says.
   */
  dialect: Dialect | undefined;
  /** The source to hand to `dialect.tokenize`/`dialect.lint` - the declaration removed. */
  source: string;
  /**
   * Problems with the declaration itself (a malformed line, a second
   * declaration, a name that names no registered machine), positioned
   * against the text the user typed. Fatal, like any other framing problem -
   * see {@link import('./types').hasFatalErrors}.
   */
  problems: TokenizeError[];
  /**
   * Map a 1-based line number in {@link source} back to the line in the text
   * the user typed, so a problem `dialect.tokenize`/`dialect.lint` reports
   * against the stripped source is placed where the user sees it. See
   * {@link remapErrors}.
   */
  remapLine(strippedLine: number): number;
}

/**
 * Read and strip a listing's `#MACHINE` declaration, and resolve the dialect
 * to read it as. `dialect`, when given, is an explicit instruction (a `-m`
 * flag, the IDE's active target) and always wins over the declaration; pass
 * undefined to let the declaration itself choose.
 */
export function resolveListing(
  source: string,
  dialect?: Dialect,
): ResolvedListing {
  const directive = readMachineDirective(source);
  const problems: TokenizeError[] = directive.problems.map((p) => ({ ...p }));

  let resolved = dialect;
  if (directive.name !== undefined) {
    const found = findMachine(directive.name);
    if (!found) {
      problems.push({
        line: directive.line!,
        column: directive.column,
        message: `No registered machine "${directive.name}"`,
      });
    } else if (resolved === undefined) {
      resolved = found;
    }
  }

  return {
    dialect: resolved,
    source: directive.source,
    problems,
    remapLine: directive.mapLine,
  };
}

/** Map every error's line back through {@link ResolvedListing.remapLine}. */
export function remapErrors(
  errors: readonly TokenizeError[],
  remapLine: (strippedLine: number) => number,
): TokenizeError[] {
  return errors.map((e) => ({ ...e, line: remapLine(e.line) }));
}

/**
 * `dialect.tokenize`, with the declaration honoured: stripped before
 * tokenizing, its own problems and the tokenizer's merged into one list
 * positioned against what the user typed.
 */
export function resolveTokenize(
  dialect: Dialect,
  source: string,
  opts?: { programName?: string },
): TokenizeResult {
  const resolved = resolveListing(source, dialect);
  const result = resolved.dialect!.tokenize(resolved.source, opts);
  return {
    ...result,
    errors: [
      ...resolved.problems,
      ...remapErrors(result.errors, resolved.remapLine),
    ],
  };
}

/** `dialect.lint`, with the declaration honoured (see {@link resolveTokenize}). */
export function resolveLint(dialect: Dialect, source: string): TokenizeError[] {
  const resolved = resolveListing(source, dialect);
  return [
    ...resolved.problems,
    ...remapErrors(resolved.dialect!.lint(resolved.source), resolved.remapLine),
  ];
}
