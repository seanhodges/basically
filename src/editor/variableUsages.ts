// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where else a variable is used, answered the way the machine would answer it.
 *
 * Given a position in the program, this finds the variable written there and
 * every other occurrence of *that same variable* - which is not the same as
 * every occurrence of the same spelling. Three machine facts separate the two:
 *
 * - **Case.** Most of these ROMs fold case, so `score` and `SCORE` are one
 *   variable - but not Acorn's BBC BASIC, where they are two.
 * - **Significance.** Microsoft BASIC keeps two characters of a name, so on a
 *   C64, PET, VIC-20, TRS-80 or Altair `SCORE` and `SCOTT` are the same two
 *   bytes of RAM. Reporting them together is the truth of the machine, and the
 *   variable lint already warns about the collision.
 * - **Kind and scope.** A scalar and an array of one name live in separate
 *   tables, so `A` and `A(0)` are different variables; and a BBC procedure's
 *   parameters and `LOCAL`s are private to it, so a global of the same
 *   spelling is a different variable again.
 *
 * Recognition itself is the scanner's ({@link ./variables}): keywords, string
 * literals, comments, PROC/FN calls and - where the ROM keeps them verbatim -
 * DATA items are never variables, and crunched runs split ROM-style.
 */
import type { EditorKeyword } from '../dialects/types';
import { outlineCapabilities } from './programOutline';
import {
  collectVariables,
  eachOccurrence,
  eachOccurrenceInLine,
  enclosingRegion,
  type Occurrence,
  type ProcRegion,
  type VarNameRules,
} from './variables';
import {
  VARIABLE_LEXIS,
  variableRules,
  type VariableLexis,
} from './variableLexis';

/** A half-open document offset range. */
export interface UsageRange {
  from: number;
  to: number;
}

export interface VariableUsages {
  /** The variable as written at the picked position, for display. */
  name: string;
  /** The picked token's own range, to anchor a tooltip on. */
  token: UsageRange;
  /** Every usage in document order, the picked one included. */
  ranges: UsageRange[];
}

/** Scalar and array of one name are different variables on every machine. */
type VarKind = 'scalar' | 'array';

/** What identifies a variable to the machine, as opposed to on the page. */
interface Identity {
  key: string;
  kind: VarKind;
}

/**
 * The name as the ROM holds it: case folded unless the machine distinguishes it,
 * cut to the characters it keeps, with the type marker (`$`, `%`, `!`, `#`)
 * still attached - a marker names a separate table, so `A` and `A$` never merge.
 */
function identityKey(name: string, lexis: VariableLexis): string {
  const cased = lexis.caseSensitive ? name : name.toUpperCase();
  const suffixChars = lexis.suffixChars ?? '$';
  const last = cased[cased.length - 1];
  const suffix = last && suffixChars.includes(last) ? last : '';
  const bare = suffix ? cased.slice(0, -1) : cased;
  const significant = lexis.significantChars;
  return (significant ? bare.slice(0, significant) : bare) + suffix;
}

/**
 * Spaces are skipped before looking for the `(`: the crunching machines ignore
 * them outright, and reading `A (5)` as a scalar would split one variable's
 * usages in two on any machine that tolerates the space.
 */
function kindOf(occ: Occurrence): VarKind {
  return occ.nextNonSpace === '(' ? 'array' : 'scalar';
}

function identityOf(occ: Occurrence, lexis: VariableLexis): Identity {
  return { key: identityKey(occ.name, lexis), kind: kindOf(occ) };
}

/** Whether a procedure makes `key` private to itself. */
function declaresLocal(
  region: ProcRegion,
  key: string,
  lexis: VariableLexis,
): boolean {
  // Compared by key, not by spelling: a differently-cased LOCAL declares the
  // same variable, and would otherwise leak out of its procedure.
  for (const local of region.locals)
    if (identityKey(local, lexis) === key) return true;
  return false;
}

/** Offset of the start of each line of `docText`. */
function lineStarts(docText: string): number[] {
  const starts = [0];
  for (
    let i = docText.indexOf('\n');
    i !== -1;
    i = docText.indexOf('\n', i + 1)
  )
    starts.push(i + 1);
  return starts;
}

/** The line index (0-based) containing `pos`. */
function rowAt(starts: number[], pos: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The variable occurrence covering `pos`, or null. Scans only its own line. */
function occurrenceAt(
  docText: string,
  rules: VarNameRules,
  starts: number[],
  pos: number,
): Occurrence | null {
  const row = rowAt(starts, pos);
  const start = starts[row]!;
  const end = starts[row + 1] ?? docText.length + 1;
  const raw = docText.slice(start, Math.max(start, end - 1));
  const column = pos - start;
  let found: Occurrence | null = null;
  eachOccurrenceInLine(raw, row + 1, rules, (occ) => {
    // Both edges count, so clicking either end of a name still picks it.
    if (column >= occ.column && column <= occ.endColumn) found = occ;
  });
  return found;
}

/**
 * The variable written at `pos`, or null. Scans only the line `pos` is on, so
 * the tooltip can ask on every click without walking the program; the full walk
 * waits until {@link findVariableUsages} is actually asked for the usages.
 */
export function variableTokenAt(
  docText: string,
  dialectId: string,
  keywords: EditorKeyword[],
  pos: number,
): (UsageRange & { name: string }) | null {
  const lexis = VARIABLE_LEXIS[dialectId] ?? {};
  const starts = lineStarts(docText);
  const occ = occurrenceAt(
    docText,
    variableRules(lexis, keywords),
    starts,
    pos,
  );
  if (!occ) return null;
  const start = starts[occ.line - 1]!;
  return {
    name: occ.name,
    from: start + occ.column,
    to: start + occ.endColumn,
  };
}

/**
 * The variable at `pos` and everywhere else it is used, or null when `pos` is
 * not on a variable.
 *
 * `dialectId` selects the machine's name lexis; an id that is not registered
 * falls back to the Sinclair defaults rather than throwing, matching
 * {@link ./variableLexis}.
 */
export function findVariableUsages(
  docText: string,
  dialectId: string,
  keywords: EditorKeyword[],
  pos: number,
): VariableUsages | null {
  const lexis = VARIABLE_LEXIS[dialectId] ?? {};
  const rules = variableRules(lexis, keywords);
  const starts = lineStarts(docText);

  const picked = occurrenceAt(docText, rules, starts, pos);
  if (!picked) return null;

  const wanted = identityOf(picked, lexis);
  const caps = outlineCapabilities(keywords);
  const regions = collectVariables(docText, rules, caps).procs;

  // A name the enclosing procedure declares private is that procedure's own
  // variable; anything else is the global, which the procedures that shadow it
  // must not contribute to.
  const pickedRow = picked.line - 1;
  const home = enclosingRegion(regions, pickedRow);
  const owner =
    home && declaresLocal(home, wanted.key, lexis) ? home : undefined;
  const shadows = owner
    ? []
    : regions.filter((r) => declaresLocal(r, wanted.key, lexis));

  const ranges: UsageRange[] = [];
  eachOccurrence(docText, rules, (occ) => {
    const identity = identityOf(occ, lexis);
    if (identity.key !== wanted.key || identity.kind !== wanted.kind) return;
    const row = occ.line - 1;
    if (owner) {
      if (row < owner.startRow || row > owner.endRow) return;
    } else if (shadows.some((r) => row >= r.startRow && row <= r.endRow)) {
      return;
    }
    const start = starts[row]!;
    ranges.push({ from: start + occ.column, to: start + occ.endColumn });
  });

  const start = starts[pickedRow]!;
  return {
    name: picked.name,
    token: { from: start + picked.column, to: start + picked.endColumn },
    ranges,
  };
}
