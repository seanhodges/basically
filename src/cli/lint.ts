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

export function lintListing(machine: string, source: string): LintOutcome {
  const dialect = findMachine(machine);
  if (!dialect) throw new RunError(`no registered machine "${machine}"`);
  const errors = dialect.lint(source);
  return {
    machine: { id: dialect.id, name: dialect.name },
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
