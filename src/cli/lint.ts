// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A program checked against its machine, without running it.
 *
 * The dialect's own dry-run linter answers this, so what the command line
 * reports and what the editor underlines are the same reading of the same
 * program. Nothing here tokenizes to an image, boots a machine or looks for a
 * ROM: a check is a question about the text.
 */

import { findMachine, RunError } from '../dialects/headless/runListing';
import { hasFatalErrors } from '../dialects/types';
import { remapErrors, resolveListing } from '../dialects/resolveListing';
import { noMachineError } from './machineResolution';

export interface LintProblem {
  /** 1-based line. */
  line: number;
  /** 0-based column, when the dialect knows it. */
  column?: number;
  /** 0-based column just past the offending token, when the dialect knows it. */
  endColumn?: number;
  message: string;
  /**
   * Whether this problem stops the program being built or run. Advisory
   * problems - a statement shape the machine would happily store and only
   * complain about when the line executes - are false.
   */
  fatal: boolean;
}

export interface LintOutcome {
  machine: { id: string; name: string };
  problems: LintProblem[];
  /** True when at least one problem is fatal. */
  fatal: boolean;
}

/**
 * Naming a machine is optional when the program declares one (`#MACHINE
 * <name>`); naming one anyway overrides the declaration. Naming a machine
 * that is not registered, or naming none while the program declares none
 * either, is the caller's mistake.
 */
export function lintListing(
  machine: string | undefined,
  source: string,
): LintOutcome {
  const explicit = machine === undefined ? undefined : findMachine(machine);
  if (machine !== undefined && !explicit) {
    throw new RunError(`no registered machine "${machine}"`);
  }
  const resolved = resolveListing(source, explicit);
  if (!resolved.dialect) throw noMachineError('lint', resolved.problems);
  const errors = [
    ...resolved.problems,
    ...remapErrors(resolved.dialect.lint(resolved.source), resolved.remapLine),
  ];
  return {
    machine: { id: resolved.dialect.id, name: resolved.dialect.name },
    problems: errors.map((e) => ({
      line: e.line,
      column: e.column,
      endColumn: e.endColumn,
      message: e.message,
      fatal: e.fatal !== false,
    })),
    fatal: hasFatalErrors(errors),
  };
}

/** One problem per line, placed the way a compiler places one. */
export function formatProblems(problems: readonly LintProblem[]): string {
  return problems
    .map((p) => {
      // Columns are 0-based on the seam and 1-based to a reader, as they are in
      // the editor's own gutter.
      const where =
        p.column === undefined ? `${p.line}` : `${p.line}:${p.column + 1}`;
      return `${where}: ${p.fatal ? 'error' : 'warning'}: ${p.message}`;
    })
    .join('\n');
}
