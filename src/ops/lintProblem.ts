// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a problem is, and how one reads.
 *
 * Apart from the operation that finds them, because a caller that only renders
 * a problem should not have to carry what it takes to find one: the operation
 * reaches the dialect registry, and through it every emulator, which is most of
 * a bundle for a program that is only formatting a line of text. Nothing here
 * imports anything, so a caller pays for the shape and the sentence alone.
 */

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

/** One problem as a sentence, placed the way a compiler places one. */
export function describeProblem(p: LintProblem): string {
  // Columns are 0-based on the seam and 1-based to a reader, as they are in
  // the editor's own gutter.
  const where =
    p.column === undefined ? `${p.line}` : `${p.line}:${p.column + 1}`;
  return `${where}: ${p.fatal ? 'error' : 'warning'}: ${p.message}`;
}
