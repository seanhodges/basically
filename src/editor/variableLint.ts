/**
 * ROM-accurate variable-name checks, surfaced as editor diagnostics.
 *
 * These are editor-only lint rules (returned from a dialect's `lint()`), not
 * part of `tokenize()`, so a flagged name squiggles in the editor but never
 * blocks a build. Each rule reuses the same dialect-aware variable recognition
 * as the highlighter/completion (`forEachVariable` + `buildIdentifierRegexes`),
 * so keywords, numbers and PROC/FN calls are never mistaken for variables.
 *
 * Two families cover every dialect that has a real restriction:
 *
 * - **Single-letter (Sinclair / Acorn Atom):** {@link singleLetterVariableErrors}.
 *   Sinclair machines (ZX81, ZX Spectrum 48K/128K) require string variables
 *   (`A$`), arrays (`A(`) and FOR/NEXT control variables to be a single letter,
 *   while multi-letter *numeric* names (`BX`) are legal. The ZX80 and Acorn Atom
 *   are stricter — *every* variable is a single letter — selected with `strict`.
 * - **Microsoft (C64 / TRS-80):** {@link microsoftVariableErrors}. Only the
 *   first two characters are significant, so two different long names that
 *   collapse to the same two chars clash; and a name embedding a reserved word
 *   (`TOTAL` contains `TO`) is the real `?SYNTAX ERROR`. The dialects differ only
 *   in their type-suffix characters (C64 `$%`, TRS-80 `$%!#`).
 *
 * BBC BASIC has no such rule: its names are fully significant, and the only real
 * restriction (a name may not embed a non-`conditional` keyword) is already
 * enforced ROM-accurately inside its tokenizer.
 */
import type { EditorKeyword, TokenizeError } from '../dialects/types';
import {
  buildIdentifierRegexes,
  type BasicLanguageOptions,
} from './basicLanguage';
import { forEachVariable, type VarNameRules } from './variables';
import { scannable } from './programOutline';

/** Build the scanner's dialect rules from lexical options + the keyword table. */
function rulesFor(
  options: BasicLanguageOptions,
  keywords: EditorKeyword[],
): VarNameRules {
  const { headRe, varRe } = buildIdentifierRegexes(options);
  const words = keywords
    .filter((k) => /^[A-Z]/.test(k.word))
    .map((k) => k.word);
  const set = new Set(words);
  return {
    headRe,
    varRe,
    keywords: set,
    maxWordLen: words.length ? Math.max(...words.map((w) => w.length)) : 0,
    hexRe: options.hexPrefix
      ? new RegExp(`^${options.hexPrefix}[0-9A-Fa-f]+`)
      : null,
    callPrefixes: ['PROC', 'FN'].filter((w) => set.has(w)),
  };
}

/** A variable occurrence with its editor-line position. */
interface Occurrence {
  name: string;
  /** 1-based editor line. */
  line: number;
  /** 0-based column of the token within the line. */
  column: number;
  /** 0-based column just past the token. */
  endColumn: number;
  /** Keyword just before the token on the line (e.g. FOR), or null. */
  prevKeyword: string | null;
  /** Character immediately after the token (e.g. `(` for an array), or ''. */
  nextChar: string;
}

/** Visit every variable occurrence in the program, with line/column info. */
function eachOccurrence(
  source: string,
  rules: VarNameRules,
  visit: (occ: Occurrence) => void,
): void {
  source.split('\n').forEach((raw, row) => {
    const m = /^\s*\d+\s?/.exec(raw);
    const prefixLen = m ? m[0].length : 0;
    const code = scannable(raw.slice(prefixLen));
    forEachVariable(code, rules, (t) => {
      const column = prefixLen + t.index;
      visit({
        name: t.text,
        line: row + 1,
        column,
        endColumn: column + t.text.length,
        prevKeyword: t.prevKeyword,
        nextChar: code[t.index + t.text.length] ?? '',
      });
    });
  });
}

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
  /** Lexical options (suffix/hex/name chars); defaults to Sinclair (`$`). */
  options?: BasicLanguageOptions;
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
  const rules = rulesFor(options, keywords);
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
    options: { suffixChars: '', hexPrefix: '#' },
  });
}

// ---------------------------------------------------------------------------
// Microsoft family (C64 / TRS-80)
// ---------------------------------------------------------------------------

/** First reserved word embedded in `name` (the real `?SYNTAX ERROR`), or null. */
function embeddedKeyword(name: string, rules: VarNameRules): string | null {
  const upper = name.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    for (
      let len = Math.min(upper.length - i, rules.maxWordLen);
      len >= 2;
      len--
    ) {
      const candidate = upper.slice(i, i + len);
      if (rules.keywords.has(candidate)) return candidate;
    }
  }
  return null;
}

/** The two significant characters + type suffix that identify the variable. */
function significanceKey(name: string, suffixChars: string): string {
  const last = name[name.length - 1]!;
  const suffix = suffixChars.includes(last) ? last : '';
  return stripSuffix(name, suffixChars).slice(0, 2).toUpperCase() + suffix;
}

/** Editor diagnostics for the Microsoft-BASIC dialects (C64, TRS-80). */
function microsoftVariableErrors(
  source: string,
  keywords: EditorKeyword[],
  opts: { label: string; suffixChars: string },
): TokenizeError[] {
  const { label, suffixChars } = opts;
  const rules = rulesFor({ suffixChars }, keywords);
  const occs: Occurrence[] = [];
  eachOccurrence(source, rules, (occ) => occs.push(occ));

  const errors: TokenizeError[] = [];
  const flagged = new Set<number>();

  // (b) A name that embeds a reserved word is a real ?SYNTAX ERROR.
  occs.forEach((occ, idx) => {
    const kw = embeddedKeyword(occ.name, rules);
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

  // (a) Two different long names that collapse to the same first two chars.
  const byKey = new Map<string, number[]>();
  const spellings = new Map<string, Set<string>>();
  occs.forEach((occ, idx) => {
    const key = significanceKey(occ.name, suffixChars);
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(idx);
    (spellings.get(key) ?? spellings.set(key, new Set()).get(key)!).add(
      occ.name.toUpperCase(),
    );
  });
  for (const [key, idxs] of byKey) {
    const names = spellings.get(key)!;
    if (names.size < 2) continue;
    for (const idx of idxs) {
      if (flagged.has(idx)) continue;
      const occ = occs[idx]!;
      if (stripSuffix(occ.name, suffixChars).length <= 2) continue; // unambiguous
      const others = [...names].filter((n) => n !== occ.name.toUpperCase());
      errors.push({
        line: occ.line,
        column: occ.column,
        endColumn: occ.endColumn,
        message: `${label} variable '${occ.name}' clashes with ${others
          .map((n) => `'${n}'`)
          .join(
            ', ',
          )} — only the first two characters ('${key.slice(0, 2)}') are significant.`,
      });
    }
  }

  return errors.sort(
    (a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0),
  );
}

export function c64VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return microsoftVariableErrors(source, keywords, {
    label: 'C64',
    suffixChars: '$%',
  });
}

export function trs80VariableErrors(
  source: string,
  keywords: EditorKeyword[],
): TokenizeError[] {
  return microsoftVariableErrors(source, keywords, {
    label: 'TRS-80',
    suffixChars: '$%!#',
  });
}
