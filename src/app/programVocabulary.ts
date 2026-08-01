// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a program actually uses: the distinct commands and control codes its
 * text contains, read as one particular BASIC.
 *
 * This is what lets the porting guide narrow the differences it reports to the
 * ones the open program is subject to (see
 * `openspec/specs/porting-guidance/spec.md`). It is deliberately one small
 * function over text: the guide receives plain data across the iframe boundary,
 * so nothing about the analysis leaks into the docs side, and the body can be
 * replaced - by a tokenize/detokenize round trip, say - without touching the
 * wire format or anything that reads it.
 *
 * A text scan rather than a tokenize round trip, so an in-progress program
 * still yields a vocabulary. The cost is that abbreviated entry (`?` for
 * `PRINT`, `pO` for `POKE`) is not resolved, which under-reports; the guide
 * always states how much it is holding back and offers the full comparison, so
 * an under-report is visible rather than silent.
 */
import { CharsetError, hasFatalErrors, type Dialect } from '../dialects/types';
import { probeFor } from '../dialects/charsetProbes';
import { findDialect } from '../dialects/registry';
import { isBinaryDirective } from '../dialects/binaryDirective';
import { scannable } from '../editor/programOutline';
import { makeCrunchMatcher } from '../editor/crunch';

/** One program's distinct vocabulary, in the language it was read as. */
export interface ProgramVocabulary {
  /** The dialect the program was read as - not necessarily the selected one. */
  dialectId: string;
  /** Distinct keyword spellings, upper case, in the dialect's own spelling. */
  keywords: string[];
  /**
   * Distinct control-code bytes used inside string literals. Bytes rather than
   * spellings: a spelling match would have to reconcile aliases (`{wht}` with
   * the canonical `{white}`), operand-carrying forms (`{INK 2}` with `{INK n}`)
   * and raw-byte escapes, none of which a byte has. For an operand-carrying
   * escape only the leading byte is recorded, which is the rule the docs escape
   * rows are authored under (`EscapeEntry.codes`).
   */
  escapeCodes: number[];
}

/**
 * Characters that continue an identifier. Used only to decide whether a keyword
 * match sits at a word boundary, for the dialects whose ROM does *not* crunch:
 * without it `TOTAL%` in a BBC program reports `TO`, and `IF` turns up inside
 * half the variable names in the listing. The type-tag suffixes (`$%!#`) count,
 * since they end a name rather than start the next thing.
 */
const IDENT = /[A-Za-z0-9_$%!#]/;

function isIdent(ch: string | undefined): boolean {
  return ch !== undefined && IDENT.test(ch);
}

/**
 * The contents of each string literal in a line body, up to any REM tail.
 *
 * Mirrors {@link scannable}, which blanks exactly these spans so the keyword
 * scan never sees them - this is the same walk keeping what that one throws
 * away. A literal after a REM is comment text, not a literal, so the walk stops
 * where `scannable` does.
 */
function stringLiterals(body: string): string[] {
  const out: string[] = [];
  let current: string | null = null;
  let i = 0;
  while (i < body.length) {
    const ch = body[i]!;
    if (current !== null) {
      if (ch === '"') {
        out.push(current);
        current = null;
      } else {
        current += ch;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      current = '';
      i++;
      continue;
    }
    if (/[Rr]/.test(ch) && /^rem\b/i.test(body.slice(i))) break;
    i++;
  }
  // An unterminated literal - the state of every string mid-typing - still
  // carries the codes typed so far.
  if (current !== null) out.push(current);
  return out;
}

/** The program's physical lines, less the machine-code blocks and line numbers. */
function codeLines(source: string): string[] {
  const bodies: string[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    // `#BIN` lines carry a base64 program-area record, not BASIC text; scanning
    // one for keywords finds whatever letters the payload happens to spell.
    if (isBinaryDirective(line)) continue;
    bodies.push(line.replace(/^\d+\s?/, ''));
  }
  return bodies;
}

/** The distinct keyword spellings the program's code (not its text) contains. */
function keywordsIn(source: string, dialect: Dialect): Set<string> {
  // Alphabetic spellings only, the set `makeCrunchMatcher` is documented over.
  // The operator rows (`+`, `<=`, `**`) are left out: the comparison drops them
  // from its diff anyway, the pages disagree about which of them earn a row at
  // all, and a bare `-` matches inside every negative number.
  const spellings = dialect.keywords
    .map((k) => k.word.toUpperCase())
    .filter((w) => /[A-Za-z]/.test(w));
  const matcher = makeCrunchMatcher(spellings);
  const found = new Set<string>();

  for (const body of codeLines(source)) {
    const code = scannable(body);
    let i = 0;
    while (i < code.length) {
      const word = matcher.keywordAt(code, i);
      if (word === null) {
        i++;
        continue;
      }
      // A crunching ROM matches the longest keyword at every position, so the
      // scan does too. Everywhere else a match has to sit at a word boundary -
      // unless the keyword's own edge is not an identifier character, which is
      // what keeps `LEFT$(` a match.
      const boundary =
        dialect.crunched === true ||
        ((!isIdent(code[i - 1]) || !isIdent(word[0])) &&
          (!isIdent(code[i + word.length]) || !isIdent(word[word.length - 1])));
      if (!boundary) {
        i++;
        continue;
      }
      found.add(word);
      i += word.length;
    }
  }
  return found;
}

/** The distinct control-code bytes the program's string literals contain. */
function escapeCodesIn(source: string, dialect: Dialect): Set<number> {
  const found = new Set<number>();
  const probe = probeFor(dialect.id);
  if (!probe) return found;

  for (const body of codeLines(source)) {
    for (const literal of stringLiterals(body)) {
      let i = 0;
      while (i < literal.length) {
        let unit;
        try {
          unit = probe.parseUnit(literal, i);
        } catch (e) {
          // A half-typed escape (`{whi`) is unmappable, and throws. The rest of
          // this literal cannot be read, but everything already found stands:
          // a partial vocabulary beats no vocabulary while the user is typing.
          if (e instanceof CharsetError) break;
          throw e;
        }
        const first = unit.codes[0];
        if (first !== undefined) {
          // Two ways a unit is a control code: its source form spans more than
          // one character (every braced and backslash escape), or it is a
          // single character whose canonical decode is an escape form (a
          // unicode block graphic standing in for a byte the docs spell out).
          if (unit.length > 1 || probe.isEscapeForm(probe.decode(first))) {
            found.add(first);
          }
        }
        i += Math.max(1, unit.length);
      }
    }
  }
  return found;
}

/**
 * The distinct commands and control codes `source` contains, read as `dialect`.
 *
 * An empty or unreadable program yields an empty vocabulary, which callers are
 * expected to treat as "no program" - narrowing a comparison to nothing would
 * report a port with no work in it, which is the one wrong answer here.
 */
export function programVocabulary(
  source: string,
  dialect: Dialect,
): ProgramVocabulary {
  return {
    dialectId: dialect.id,
    keywords: [...keywordsIn(source, dialect)].sort(),
    escapeCodes: [...escapeCodesIn(source, dialect)].sort((a, b) => a - b),
  };
}

/** The reply's payload, less its `type`. */
export interface ProgramVocabularyReply {
  status: 'ready' | 'empty' | 'unreadable';
  dialectId: string;
  keywords: string[];
  escapeCodes: number[];
}

/**
 * The open program's vocabulary, read as the machine the guide named (falling
 * back to the selected one when it named nothing, or named something this build
 * does not register).
 *
 * Two traps sit in the status decision, both of which have to stay avoided:
 *
 * - It is `tokenize(...).errors`, never `dialect.lint(source)`. The variable
 *   lint's findings do not set `fatal: false`, so `hasFatalErrors` reads every
 *   one of them as fatal and a program carrying a single two-significant-
 *   characters warning would report itself unreadable. The capability requires
 *   the opposite: findings that do not stop the program being read leave the
 *   narrowing alone, so ordinary half-finished editing does not keep discarding
 *   it.
 * - It is the *requested* dialect that tokenizes, not the selected one. A
 *   program kept on a machine that will not run it is the case this whole
 *   feature exists for; tokenizing it as the machine it was moved to would
 *   report it unreadable at exactly the moment the port begins.
 *
 * Pure and exported so both traps are pinned by a test rather than by this
 * comment (`DocsDrawer.test.ts`).
 */
export function vocabularyReply(
  source: string,
  selected: Dialect,
  fromId: string | null,
): ProgramVocabularyReply {
  const from = (fromId !== null ? findDialect(fromId) : undefined) ?? selected;
  const status = !source.trim()
    ? 'empty'
    : hasFatalErrors(from.tokenize(source).errors)
      ? 'unreadable'
      : 'ready';
  const vocab = programVocabulary(source, from);
  return {
    status,
    dialectId: vocab.dialectId,
    keywords: vocab.keywords,
    escapeCodes: vocab.escapeCodes,
  };
}
