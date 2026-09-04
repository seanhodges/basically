// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The `#MACHINE <name>` source directive: one physical line naming the
 * machine a listing is for, in the same shape `#BIN` (`binaryDirective.ts`)
 * uses for a different fact. Dialect-agnostic and universal - every dialect
 * must never see one, so this module knows nothing about any dialect and
 * imports nothing but a type: recognising and stripping the line is this
 * module's whole job, and resolving the named machine against the registry
 * is the caller's (see `resolveListing.ts`, the single point every path that
 * turns text into bytes routes through).
 */

import type { TokenizeError } from './types';

/** `#MACHINE` (any case) at line start, after optional indent, as a whole word. */
const PREFIX_RE = /^[ \t]*#machine(?![^\s])/i;

export type ParsedMachineDirective =
  | { name: string }
  | { error: string; column: number };

/** The 0-based column of whatever follows the directive keyword and its whitespace. */
function payloadColumn(prefixLength: number, rest: string): number {
  return prefixLength + (rest.length - rest.trimStart().length);
}

/** The 0-based column of the payload on a line already known to match {@link PREFIX_RE}. */
function directiveColumn(lineText: string): number {
  const m = PREFIX_RE.exec(lineText)!;
  return payloadColumn(m[0].length, lineText.slice(m[0].length));
}

/** Whether this physical line is a `#MACHINE` directive (well-formed or not). */
export function isMachineDirective(lineText: string): boolean {
  return PREFIX_RE.test(lineText);
}

/**
 * Parse a physical line as a `#MACHINE` directive. Returns null when the line
 * is not a directive at all, the named machine (verbatim, untrimmed of
 * nothing but surrounding whitespace - a display name may itself contain
 * spaces) on success, or an error message with the 0-based column of the
 * fault.
 */
export function parseMachineDirective(
  lineText: string,
): ParsedMachineDirective | null {
  const m = PREFIX_RE.exec(lineText);
  if (!m) return null;
  const rest = lineText.slice(m[0].length);
  const column = payloadColumn(m[0].length, rest);
  const name = rest.trim();
  if (name === '') {
    return { error: 'Missing machine name after #MACHINE', column };
  }
  return { name };
}

/** One problem `readMachineDirective` found, in the {@link TokenizeError} shape. */
export type MachineDirectiveProblem = Pick<
  TokenizeError,
  'line' | 'column' | 'message'
>;

export interface MachineDirectiveResult {
  /** The declared machine name (verbatim), or undefined when none declared. */
  name: string | undefined;
  /** 1-based line the declaration was read from, or undefined when none. */
  line: number | undefined;
  /** 0-based column {@link name} starts at, or undefined when none. */
  column: number | undefined;
  /**
   * The source with every `#MACHINE` line removed - malformed and
   * duplicate ones included, since none of them is ever BASIC text.
   */
  source: string;
  /**
   * Problems found reading the directive itself: a malformed line, or a
   * second declaration. Resolving the name against the registry is not this
   * module's business (it has no registry to check against) - that error is
   * the caller's, once it knows what "registered" means.
   */
  problems: MachineDirectiveProblem[];
  /**
   * Map a 1-based line number in {@link source} back to the line number in
   * the text the user typed, so a problem the tokenizer reports against the
   * stripped source lands where the user sees it.
   */
  mapLine(strippedLine: number): number;
}

/**
 * Read the `#MACHINE` declaration out of a listing, if any. At most one
 * declaration is honoured; every line matching the directive - the one
 * honoured, a malformed one, or a repeat - is removed from {@link
 * MachineDirectiveResult.source} so none of them ever reaches a tokenizer.
 */
export function readMachineDirective(source: string): MachineDirectiveResult {
  const lines = source.split('\n');
  const kept: string[] = [];
  const keptOriginalLines: number[] = [];
  let name: string | undefined;
  let declLine: number | undefined;
  let declColumn: number | undefined;
  const problems: MachineDirectiveProblem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!;
    const lineNo = i + 1;
    const parsed = parseMachineDirective(lineText);
    if (parsed === null) {
      kept.push(lineText);
      keptOriginalLines.push(lineNo);
      continue;
    }
    if ('error' in parsed) {
      problems.push({
        line: lineNo,
        column: parsed.column,
        message: parsed.error,
      });
      continue;
    }
    if (name === undefined) {
      name = parsed.name;
      declLine = lineNo;
      declColumn = directiveColumn(lineText);
    } else {
      problems.push({
        line: lineNo,
        column: directiveColumn(lineText),
        message: 'A listing can declare only one machine',
      });
    }
  }

  return {
    name,
    line: declLine,
    column: declColumn,
    source: kept.join('\n'),
    problems,
    mapLine: (strippedLine: number) =>
      keptOriginalLines[strippedLine - 1] ?? strippedLine,
  };
}
