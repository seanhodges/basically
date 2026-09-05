/**
 * A program checked against its machine, without running it.
 *
 * The dialect's own dry-run linter answers this, so what any caller reports
 * and what the editor underlines are the same reading of the same program.
 * Nothing here tokenizes to an image, boots a machine or looks for a ROM: a
 * check is a question about the text.
 */

import { hasFatalErrors } from '../dialects/types';
import { remapErrors } from '../dialects/resolveListing';
import { resolveProgram } from './resolve';
import type { OpContext, Operation } from './types';

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

export interface LintInput {
  /** The program's text. */
  source: string;
  /** A machine's id or name; see {@link resolveProgram} for what absence means. */
  machine?: string;
}

export function lintListing(input: LintInput, ctx: OpContext): LintOutcome {
  const resolved = resolveProgram('lint', input, ctx);
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

/** One problem as a sentence, placed the way a compiler places one. */
export function describeProblem(p: LintProblem): string {
  // Columns are 0-based on the seam and 1-based to a reader, as they are in
  // the editor's own gutter.
  const where =
    p.column === undefined ? `${p.line}` : `${p.line}:${p.column + 1}`;
  return `${where}: ${p.fatal ? 'error' : 'warning'}: ${p.message}`;
}

export const lintOp: Operation<LintInput, LintOutcome> = {
  name: 'lint',
  summary: "Report a program's problems without running it.",
  description:
    'Check a program against its machine without running it, and report ' +
    'every problem the editor would underline: fatal ones, which stop the ' +
    'program being built or run, and advisory ones, which the machine stores ' +
    'and only complains about when the line executes. Check a program you ' +
    'are about to return, so a problem you could have found yourself is ' +
    'found before the user is asked to look at it.',
  input: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'The whole program.' },
      machine: {
        type: 'string',
        description:
          "A machine's id or name; the program's own #MACHINE line, else " +
          "this conversation's machine, when absent.",
      },
    },
    required: ['source'],
    additionalProperties: false,
  },
  needs: 'nothing',
  cli: { kind: 'operation', name: 'lint' },
  assistant: { kind: 'tool' },
  mcp: { kind: 'tool' },
  run: lintListing,
  describe: (outcome) => {
    const count = outcome.problems.length;
    const head =
      count === 0
        ? `${outcome.machine.name}: no problems.`
        : `${outcome.machine.name}: ${count} problem${count === 1 ? '' : 's'}` +
          `${outcome.fatal ? ', at least one fatal' : ''}.`;
    return [head, ...outcome.problems.map(describeProblem)].join('\n');
  },
};
