// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A check's problems as a compiler places them. The check itself is the
 * `lint` operation's (`src/ops/lint.ts`).
 */

import { describeProblem, type LintProblem } from '../ops/lintProblem';

export type { LintOutcome, LintProblem } from '../ops/lintProblem';

/** One problem per line, placed the way a compiler places one. */
export function formatProblems(problems: readonly LintProblem[]): string {
  return problems.map(describeProblem).join('\n');
}
