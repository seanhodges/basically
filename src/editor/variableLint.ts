/**
 * ROM-accurate variable-name checks, surfaced as editor diagnostics.
 *
 * These are lint rules (returned from a dialect's `lint()`), not part of
 * `tokenize()`: a flagged name squiggles in the editor and gates the Run
 * button / status-bar error count (see `countProgramErrors`), but never blocks
 * a file/tape export. Each rule reuses the same dialect-aware variable recognition
 * as the highlighter/completion (`forEachVariable` + `buildIdentifierRegexes`),
 * so keywords, numbers and PROC/FN calls are never mistaken for variables.
 *
 * Two families cover every dialect that has a real restriction:
 *
 * - **Single-letter (Sinclair / Acorn Atom):** {@link singleLetterVariableErrors}.
 *   Sinclair machines (ZX81, ZX Spectrum 48K/128K) require string variables
 *   (`A$`), arrays (`A(`) and FOR/NEXT control variables to be a single letter,
 *   while multi-letter *numeric* names (`BX`) are legal. The ZX80 and Acorn Atom
 *   are stricter - *every* variable is a single letter - selected with `strict`.
 * - **Microsoft (Altair / C64 / TRS-80):** {@link microsoftVariableErrors}. Only the
 *   first two characters are significant, so two different long names that
 *   collapse to the same two chars clash; and a name embedding a reserved word
 *   (`SCORE` contains `OR`) is the real `?SYNTAX ERROR`. These ROMs also ignore
 *   spaces ("code crunching"), so the scanner runs in crunched mode: glued
 *   keywords are split ROM-style (`POKEA` is POKE + A, never a variable) and
 *   only a name with a keyword glued mid-run *where a variable is expected* is
 *   flagged - in expression position (`FORI=ATOB`) the split is silent, since
 *   it is indistinguishable from intentional crunch. The dialects differ only
 *   in their type-suffix characters (Altair `$`, C64 `$%`, TRS-80 `$%!#`).
 *
 * BBC BASIC has no such rule: its names are fully significant, and the only real
 * restriction (a name may not embed a non-`conditional` keyword) is already
 * enforced ROM-accurately inside its tokenizer.
 */
import type { EditorKeyword, TokenizeError } from '../dialects/types';
import { eachOccurrence, type Occurrence } from './variables';
import { lexisFor, variableRules, type VariableLexis } from './variableLexis';
import { identityKey, nameKey } from './variableIdentity';

/** The name without its trailing type-suffix character. */
function stripSuffix(name: string, suffixChars: string): string {
  const last = name[name.length - 1];
  return last && suffixChars.includes(last) ? name.slice(0, -1) : name;
}

// ---------------------------------------------------------------------------
// Single-letter family (ZX81 / ZX Spectrum / ZX80 / Acorn Atom)
// ---------------------------------------------------------------------------

/** Options for {@link singleLetterVariableErrors}. */
interface SingleLetterOptions {
  /** Machine name used in messages, e.g. 'ZX81', 'ZX Spectrum'. */
  label: string;
  /** Name lexis for the machine; defaults to Sinclair (`$`, nothing else). */
  options?: VariableLexis;
  /** When true every variable must be a single letter (ZX80, Atom). */
  strict?: boolean;
}

/** The single-letter-name violation for one occurrence, or null. */
function singleLetterViolation(
  occ: Occurrence,
  label: string,
  suffixChars: string,
  strict: boolean,
): string | null {
  if (stripSuffix(occ.name, suffixChars).length === 1) return null;
  if (strict) return `${label} variable names must be a single letter.`;
  if (occ.name.endsWith('$')) {
    return `${label} string variable names must be a single letter (e.g. A$).`;
  }
  if (occ.prevKeyword === 'FOR' || occ.prevKeyword === 'NEXT') {
    return `${label} FOR/NEXT control variable must be a single letter.`;
  }
  if (occ.nextChar === '(') {
    return `${label} array names must be a single letter.`;
  }
  return null;
}

/** Editor diagnostics for the single-letter-name dialects. */
export function singleLetterVariableErrors(
  source: string,
  keywords: EditorKeyword[],
  opts: SingleLetterOptions,
): TokenizeError[] {
  const options = opts.options ?? {};
  const suffixChars = options.suffixChars ?? '$';
  const rules = variableRules(options, keywords);
  const errors: TokenizeError[] = [];
  eachOccurrence(source, rules, (occ) => {
    const message = singleLetterViolation(
      occ,
      opts.label,
      suffixChars,
      opts.strict ?? false,
    );
    if (message)
      errors.push({
        line: occ.line,
        column: occ.column,
        endColumn: occ.endColumn,
        message,
      });
  });
  return errors;
}

export function zx81VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return singleLetterVariableErrors(source, keywords, { label: 'ZX81' });
}

export function spectrumVariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return singleLetterVariableErrors(source, keywords, { label: 'ZX Spectrum' });
}

export function zx80VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return singleLetterVariableErrors(source, keywords, {
    label: 'ZX80',
    strict: true,
  });
}

export function atomVariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  // The Atom has no `$`/`%` variable suffix; `#` introduces a hex literal.
  return singleLetterVariableErrors(source, keywords, {
    label: 'Acorn Atom',
    strict: true,
    options: lexisFor('atom'),
  });
}

// ---------------------------------------------------------------------------
// Microsoft family (Altair 8800 / C64 / TRS-80)
// ---------------------------------------------------------------------------

/** Editor diagnostics for the Microsoft-BASIC dialects (Altair, C64, TRS-80). */
function microsoftVariableErrors(
  source: string,
  keywords: EditorKeyword[],
  opts: { label: string; lexis: VariableLexis },
): TokenizeError[] {
  const { label, lexis } = opts;
  const suffixChars = lexis.suffixChars ?? '$';
  // Crunching is inherent to the Microsoft family: the scanner ROM-splits
  // glued keywords (`POKEA` is POKE + A, never a variable) and flags only
  // names it knows the ROM will mis-read (see forEachVariable).
  const rules = variableRules(lexis, keywords);
  const occs: Occurrence[] = [];
  eachOccurrence(source, rules, (occ) => occs.push(occ));

  const errors: TokenizeError[] = [];
  const flagged = new Set<number>();

  // (b) A name that embeds a reserved word is a real ?SYNTAX ERROR.
  occs.forEach((occ, idx) => {
    const kw = occ.embedsKeyword;
    if (kw) {
      errors.push({
        line: occ.line,
        column: occ.column,
        endColumn: occ.endColumn,
        message: `${label} variable name '${occ.name}' embeds the reserved word '${kw}'.`,
      });
      flagged.add(idx);
    }
  });

  // (a) Two different names that the ROM collapses onto the same storage.
  //
  // Both keys come from the shared identity rule, so this and the usages view
  // answer "are these one variable?" the same way: the significance key is what
  // the ROM ends up holding, and the name key is what the program meant. Two
  // occurrences clash when the first agrees and the second does not - which on
  // a machine that tells `A` from `a` means a pair differing only in case is
  // two variables and no clash, and on one that folds them is one variable and
  // no clash either.
  const byKey = new Map<string, number[]>();
  const names = new Map<string, Map<string, string>>();
  occs.forEach((occ, idx) => {
    const key = identityKey(occ.name, lexis);
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(idx);
    // Spelled as the program first spells it: the reader is being shown their
    // own name, not a folded rendering of it.
    const distinct = names.get(key) ?? names.set(key, new Map()).get(key)!;
    const mine = nameKey(occ.name, lexis);
    if (!distinct.has(mine)) distinct.set(mine, occ.name);
  });
  for (const [key, idxs] of byKey) {
    const distinct = names.get(key)!;
    if (distinct.size < 2) continue;
    for (const idx of idxs) {
      if (flagged.has(idx)) continue;
      const occ = occs[idx]!;
      if (stripSuffix(occ.name, suffixChars).length <= 2) continue; // unambiguous
      const mine = nameKey(occ.name, lexis);
      const others = [...distinct]
        .filter(([k]) => k !== mine)
        .map(([, n]) => n);
      errors.push({
        line: occ.line,
        column: occ.column,
        endColumn: occ.endColumn,
        message: `${label} variable '${occ.name}' clashes with ${others
          .map((n) => `'${n}'`)
          .join(
            ', ',
          )} - only the first two characters ('${key.slice(0, 2)}') are significant.`,
      });
    }
  }

  return errors.sort(
    (a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0),
  );
}

/**
 * Atari BASIC keeps a name in full - there is no two-character truncation - so
 * the only name rule left is the one greedy matching creates: a name opening
 * with a reserved word is not that name. `LOGO` is `LOG` and `O`, and the ROM
 * stops on it.
 *
 * The cap on how *many* names a program may have is the tokenizer's, not this
 * function's: the variable table is what runs out, and it runs out while the
 * program is being built rather than while a name is being read.
 *
 * Shared between `atari800` and `atari400` - same BASIC, same lexis - so the
 * dialect id picks which of `lexisFor`'s two (identical) entries to read.
 */
export function atariVariableErrors(
  source: string,
  keywords: EditorKeyword[],
  dialectId: 'atari800' | 'atari400',
): TokenizeError[] {
  const rules = variableRules(lexisFor(dialectId), keywords);
  const errors: TokenizeError[] = [];
  eachOccurrence(source, rules, (occ) => {
    const embedded = occ.embedsKeyword;
    if (!embedded) return;
    errors.push({
      line: occ.line,
      column: occ.column,
      endColumn: occ.endColumn,
      message: `Atari variable name '${occ.name}' embeds the reserved word '${embedded}', which the ROM matches first.`,
    });
  });
  return errors;
}

export function c64VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return microsoftVariableErrors(source, keywords, {
    label: 'C64',
    lexis: lexisFor('commodore64'),
  });
}

export function trs80VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return microsoftVariableErrors(source, keywords, {
    label: 'TRS-80',
    lexis: lexisFor('trs80'),
  });
}

/**
 * Altair 8K BASIC is where both of these rules come from - the C64's and the
 * TRS-80's are inherited. Two significant characters, and `$` as the only type
 * suffix: 8K BASIC predates the `%`/`!`/`#` tags, so `X%=1` is stored happily
 * and then fails with `?SN ERROR` when the line runs.
 */
export function altair8800VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return microsoftVariableErrors(source, keywords, {
    label: 'Altair',
    lexis: lexisFor('altair8800'),
  });
}

/**
 * Apple 1 Integer BASIC has only the embedded-keyword half of the Microsoft
 * rules, and it has it for a different reason.
 *
 * There is no two-character truncation to warn about: a name here *is* one
 * letter and at most one digit, so nothing is long enough to collide - `AB=2`
 * and `A12=1` are refused outright by the tokenizer rather than quietly folded
 * together. What survives is the crunch hazard, because the entry parser skips
 * spaces and tries its keyword rules first: a name written where the ROM will
 * see a reserved word instead is a real `*** SYNTAX ERR`.
 */
export function apple1VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  const rules = variableRules(lexisFor('apple1'), keywords);
  const errors: TokenizeError[] = [];
  eachOccurrence(source, rules, (occ) => {
    const kw = occ.embedsKeyword;
    if (!kw) return;
    errors.push({
      line: occ.line,
      column: occ.column,
      endColumn: occ.endColumn,
      message: `Apple I variable name '${occ.name}' embeds the reserved word '${kw}'.`,
    });
  });
  return errors;
}

/**
 * Apple II Integer BASIC keeps a name in full - `LONGVARIABLENAME=1` stores all
 * sixteen characters - so there is no truncation to warn about. What is left is
 * the crunch hazard, and it is a narrower one than the Microsoft family's.
 *
 * The entry parser tries seven words at every character of a name after the
 * first, because those seven are the ones that may follow a complete
 * expression: AND, AT, MOD, OR, STEP, THEN and TO. Finding one ends the name
 * there, and whatever follows fails to parse - which is why `SCORE=1` (`SC OR
 * E`) and `ATOM=1` (`A TO M`) are `*** SYNTAX ERR` on the machine while
 * `BTAB=1`, `XPEEK=1` and `ANEW=1` are ordinary variables. Every other keyword
 * passes through a name untouched, so the shared scanner's `embedsKeyword` is
 * too wide a net here and this filters it down to the seven.
 *
 * The scanner runs in crunched mode all the same, so a name in *expression*
 * position is split silently rather than flagged: `A=BANDY` really is `B AND Y`
 * on the machine and runs.
 */
export function apple2VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  const rules = variableRules(lexisFor('apple2'), keywords);
  const breakers = new Set(['AND', 'AT', 'MOD', 'OR', 'STEP', 'THEN', 'TO']);
  const errors: TokenizeError[] = [];
  eachOccurrence(source, rules, (occ) => {
    const kw = [...breakers].find((w) => occ.name.toUpperCase().indexOf(w) > 0);
    if (!kw) return;
    errors.push({
      line: occ.line,
      column: occ.column,
      endColumn: occ.endColumn,
      message: `Apple II variable name '${occ.name}' ends at the reserved word '${kw}', which the parser matches first.`,
    });
  });
  return errors;
}

/**
 * Applesoft is a Microsoft BASIC and takes the family's rules whole: two
 * significant characters, `$` and `%` as type suffixes, and a name embedding a
 * reserved word being a real `?SYNTAX ERROR`.
 *
 * That last one bites harder here than anywhere else in the family, because
 * this ROM's table puts `AT` at `$C5` where `ATN` is at `$E1`: `LATCH` stores
 * as `L`, the AT token and `CH`, and `CATALOG` as `C`, AT, `A`, LOG. The
 * tokenizer reproduces both rather than smoothing them over, so this is where
 * the reader finds out.
 *
 * The lexis is written out rather than read from `lexisFor`, as the sibling's
 * is, because that table names the registered machines and no others.
 */
export function apple2plusVariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return microsoftVariableErrors(source, keywords, {
    label: 'Applesoft',
    lexis: {
      suffixChars: '$%',
      crunched: true,
      significantChars: 2,
      dataIsVerbatim: true,
    },
  });
}

/**
 * BASIC-G inherits both rules from the same place the Altair's come from -
 * two significant characters, and `$` as the only type suffix - and departs
 * from it on case, which its lexis carries from the machine's declared facts.
 */
export function pmd85VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return microsoftVariableErrors(source, keywords, {
    label: 'PMD 85',
    lexis: lexisFor('pmd85'),
  });
}
