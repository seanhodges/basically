// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A verdict as a person reads it. The check itself is the `check` operation's
 * (`src/ops/check.ts`).
 */

import type { CheckOutcome } from '../ops/check';

/** How a step is marked in the report, one column wide. */
const MARK: Record<string, string> = {
  done: 'ok  ',
  failed: 'FAIL',
  unevaluated: '?   ',
};

/**
 * The verdict: one line per step, then the answer.
 *
 * The failing step is named by its line in the file of expectations, because
 * that is where the caller has to go to change it, and the screen as it stood
 * follows so they can see what the program produced instead.
 */
export function formatVerdict(outcome: CheckOutcome): string {
  const steps = outcome.steps.map(
    (step) =>
      `  ${MARK[step.outcome] ?? '    '} line ${step.action.line}: ${step.detail}`,
  );
  const failed = outcome.steps.find((step) => step.outcome === 'failed');
  const unevaluated =
    outcome.unevaluated > 0 ? `, ${outcome.unevaluated} unevaluated` : '';
  const verdict = outcome.passed
    ? `passed: ${outcome.steps.length} step${outcome.steps.length === 1 ? '' : 's'}${unevaluated}`
    : failed
      ? `FAILED at line ${failed.action.line}: ${failed.detail}${unevaluated}`
      : 'FAILED: the program did not run';
  const screen =
    !outcome.passed && outcome.screen
      ? `\n\nthe screen as it stood:\n${outcome.screen.lines.join('\n')}`
      : '';
  return `${[...steps, verdict].join('\n')}${screen}`;
}
