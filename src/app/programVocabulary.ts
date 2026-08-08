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
import { resolveWriteSites } from './memoryWriteSites';

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
  /**
   * Distinct printable ASCII (0x20-0x7E) the program's text contains, sorted.
   *
   * Printable ASCII only, and deliberately: everything outside it is a control
   * code or a graphics character, which {@link escapeCodes} already carries.
   * Recording a block graphic here as well would put it in two findings at once
   * - "control codes to replace" and "characters the target cannot represent" -
   * for one difference.
   *
   * Read from the whole line, not just its code: a character absent from a
   * machine's set is absent from its strings and its REM bodies too, because
   * they are stored through the same charset.
   */
  characters: string[];
  /**
   * 1-based editor lines carrying more than one statement, sorted.
   *
   * Editor lines rather than BASIC line numbers, matching `TokenizeError.line`
   * and the `- editor line N:` list the assistant is already given - a program
   * is talked about in one coordinate system or the reader has to convert.
   */
  multiStatementLines: number[];
  /**
   * How many statements the program carries beyond one per line, across every
   * line that carries several.
   *
   * The number of lines a split would *add*: on a target that takes one
   * statement per line, each of these becomes a line of its own, needing a line
   * number the target will accept. Counted here rather than derived from
   * {@link multiStatementLines}, which says which lines are affected and not how
   * far.
   */
  extraStatements: number;
  /**
   * The span of BASIC line numbers the program's text carries, or null where it
   * carries none.
   *
   * The porting guide checks these against the target machine's own range: a
   * program numbered past the target's ceiling has to be renumbered before it
   * can be typed in, whatever else the port involves.
   */
  lineNumbers: { lowest: number; highest: number; count: number } | null;
  /**
   * The addresses the program writes to, in ascending order, as resolved for the
   * machine it is read as.
   *
   * The porting guide marks these on *both* compared machines' memory layouts,
   * which is what lets it say that a write aimed at one machine's system
   * variables reaches another machine's BASIC program text - a difference no
   * keyword or control-code diff can find, because the program's text does not
   * change at all.
   *
   * Only the sites that land inside the machine's memory; one that resolves
   * outside it is a finding about the program rather than about the port, and
   * the IDE's own map already reports it. Best-effort, like everything
   * {@link resolveWriteSites} produces: `approximate` marks an address worked
   * out at runtime, and the guide draws it as an estimate.
   */
  writeSites: ProgramWriteSite[];
}

/**
 * One address the program writes to, as it crosses to the porting guide.
 *
 * A plain-data subset of the editor's `PokeSite` - `lineNo` is left behind
 * because the guide has no editor to point at. Deliberately declared here as
 * data rather than shared as a type with the docs side: the two agree by field
 * name across `postMessage`, pinned by `DocsDrawer.test.ts`, exactly as the rest
 * of this payload does.
 */
export interface ProgramWriteSite {
  address: number;
  expr: string;
  computed: boolean;
  approximate: boolean;
  endAddress?: number;
  role?: 'load';
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

/** One scannable line: its 1-based editor position, and its text less the line number. */
interface CodeLine {
  line: number;
  body: string;
  /** The BASIC line number the line opens with, or undefined where it has none. */
  number?: number;
}

/**
 * The program's physical lines, less the machine-code blocks and line numbers.
 *
 * The editor position rides along because one finding is about lines rather than
 * about vocabulary: "these lines carry several statements" has to name them, and
 * blank and `#BIN` lines are skipped here, so a position cannot be recovered by
 * counting afterwards. The BASIC line number rides along for the same reason, one
 * finding over: the target machine's own range may not hold it.
 */
function codeLines(source: string): CodeLine[] {
  const bodies: CodeLine[] = [];
  source.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    // `#BIN` lines carry a base64 program-area record, not BASIC text; scanning
    // one for keywords finds whatever letters the payload happens to spell.
    if (isBinaryDirective(line)) return;
    const numbered = /^(\d+)\s?/.exec(line);
    bodies.push({
      line: index + 1,
      body: line.replace(/^\d+\s?/, ''),
      ...(numbered ? { number: parseInt(numbered[1]!, 10) } : {}),
    });
  });
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

  for (const { body } of codeLines(source)) {
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

  for (const { body } of codeLines(source)) {
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

/** True for ASCII 0x20-0x7E, the range {@link ProgramVocabulary.characters} covers. */
function isPrintableAscii(ch: string): boolean {
  const code = ch.codePointAt(0);
  return code !== undefined && code >= 0x20 && code <= 0x7e;
}

/**
 * The distinct printable ASCII the program's text contains.
 *
 * Walked a unit at a time through the charset probe rather than character by
 * character, because an escape is not what it looks like: `%A` on a ZX81 is one
 * inverse-video character, and a naive walk would record the `%` as a character
 * the program uses when the program does not use one. The unit walk is the same
 * one {@link escapeCodesIn} makes, over the whole line rather than its literals.
 *
 * Everything a unit yields that is not printable ASCII is dropped, which is what
 * keeps the two scans from reporting one difference twice: a block graphic is a
 * control code, is recorded as one, and never appears here.
 */
function charactersIn(source: string, dialect: Dialect): Set<string> {
  const found = new Set<string>();
  const probe = probeFor(dialect.id);

  for (const { body } of codeLines(source)) {
    let i = 0;
    while (i < body.length) {
      const ch = body[i]!;
      if (probe === undefined) {
        if (isPrintableAscii(ch)) found.add(ch);
        i++;
        continue;
      }
      let unit;
      try {
        unit = probe.parseUnit(body, i);
      } catch (e) {
        // A half-typed escape, or a character this machine does not have in the
        // first place. Either way the character is in the program and the user
        // can see it, so record it and carry on rather than abandoning the line.
        if (!(e instanceof CharsetError)) throw e;
        if (isPrintableAscii(ch)) found.add(ch);
        i++;
        continue;
      }
      // A single-character unit is the character itself; anything longer is an
      // escape, whose source spelling is notation rather than text.
      if (unit.length === 1 && isPrintableAscii(ch)) found.add(ch);
      i += Math.max(1, unit.length);
    }
  }
  return found;
}

/**
 * The lines carrying more than one statement, read as `dialect` separates them.
 *
 * `Dialect.statementSeparator` rather than `Dialect.memoryWrites.statementSep`:
 * that one is scoped to parsing a memory-write form, only the Atom declares it,
 * and every reader falls back to `:`. That default cannot say "this machine has
 * no separator", and a ZX80 or ZX81 line reading `PRINT "TIME: ";T` would be
 * reported as two statements on the strength of it.
 *
 * `scannable` blanks string literals and cuts the REM tail, so a separator
 * inside either is not a statement boundary - which is the same reason the
 * keyword scan reads through it.
 */
function statementLayoutIn(
  source: string,
  dialect: Dialect,
): { lines: number[]; extraStatements: number } {
  const separator = dialect.statementSeparator;
  if (separator === null) return { lines: [], extraStatements: 0 };

  const lines: number[] = [];
  let extraStatements = 0;
  for (const { line, body } of codeLines(source)) {
    const statements = scannable(body)
      .split(separator)
      // A trailing or doubled separator is an empty statement, which real
      // programs contain and which is not a second statement to split out.
      .filter((s) => s.trim() !== '');
    if (statements.length > 1) {
      lines.push(line);
      // Each statement past the first becomes a line of its own on a target
      // that takes one per line, which is how a port can create line numbers.
      extraStatements += statements.length - 1;
    }
  }
  return { lines, extraStatements };
}

/**
 * The span of BASIC line numbers the program's text carries, or null where it
 * carries none.
 *
 * The numbers as *written*, not as they would be renumbered: what the porting
 * guide asks is whether the target machine's editor would accept them at all,
 * and a machine whose numbers stop at 9,999 will not take a BBC program numbered
 * to 32,767 however the lines are laid out.
 *
 * Lines with no number of their own contribute nothing - a continuation line, or
 * a line still being typed - so `count` is the number of *numbered* lines, which
 * is what a split has to renumber.
 */
function lineNumbersIn(
  source: string,
): { lowest: number; highest: number; count: number } | null {
  const numbers = codeLines(source)
    .map((l) => l.number)
    .filter((n): n is number => n !== undefined);
  if (numbers.length === 0) return null;
  return {
    lowest: Math.min(...numbers),
    highest: Math.max(...numbers),
    count: numbers.length,
  };
}

/**
 * The addresses the program writes to, as plain data for the wire.
 *
 * `lineNo` is dropped: the guide has no editor to point a line number at, and
 * everything that crosses this boundary should be what the other side actually
 * uses.
 */
function writeSitesIn(source: string, dialect: Dialect): ProgramWriteSite[] {
  return resolveWriteSites(source, dialect).inRange.map(
    ({ address, expr, computed, approximate, endAddress, role }) => ({
      address,
      expr,
      computed,
      approximate,
      ...(endAddress !== undefined ? { endAddress } : {}),
      ...(role !== undefined ? { role } : {}),
    }),
  );
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
  const layout = statementLayoutIn(source, dialect);
  return {
    dialectId: dialect.id,
    keywords: [...keywordsIn(source, dialect)].sort(),
    escapeCodes: [...escapeCodesIn(source, dialect)].sort((a, b) => a - b),
    characters: [...charactersIn(source, dialect)].sort(),
    multiStatementLines: layout.lines,
    extraStatements: layout.extraStatements,
    lineNumbers: lineNumbersIn(source),
    writeSites: writeSitesIn(source, dialect),
  };
}

/**
 * What the program takes on the machine it is being ported *to*.
 *
 * Measured with the target's own tokenizer, because a program's stored size is
 * not portable: one six-line program is 50 bytes on a ZX80, 71 on the
 * Microsoft-derived machines, 80 on the Sinclair machines (which keep a
 * five-byte binary form after every numeric literal) and 88 on a CPC. The
 * guide's fit report would be wrong by a quarter if it reused the source
 * machine's count.
 */
export interface ProgramSize {
  /** The machine this size answers for. The guide ignores a size for another. */
  dialectId: string;
  /** Bytes the program occupies in that machine's program area. */
  bytes: number;
  /** False where the target's tokenizer objected to any of the program. */
  clean: boolean;
}

/**
 * What the program measures on `target`, or null when there is no target to
 * measure it on.
 *
 * A port normally carries commands the target has no keyword for and characters
 * it has no glyph for - that is what the rest of the porting guide is about - so
 * the target's tokenizer reporting errors is the expected case here and not a
 * reason to withhold the figure. The program is sized from whatever tokenized and
 * `clean` is false, which the guide renders as a lower bound: the real program
 * can only be larger once those differences are dealt with.
 *
 * Suppressing the size on error would withhold the finding exactly when it
 * matters most - a 40KB program aimed at a 3,583-byte machine is unlikely to
 * tokenize cleanly there.
 */
function programSize(
  source: string,
  target: Dialect | undefined,
): ProgramSize | null {
  if (!target) return null;
  const { byteSize, errors } = target.tokenize(source);
  return { dialectId: target.id, bytes: byteSize, clean: errors.length === 0 };
}

/** The reply's payload, less its `type`. */
export interface ProgramVocabularyReply {
  status: 'ready' | 'empty' | 'unreadable';
  dialectId: string;
  keywords: string[];
  escapeCodes: number[];
  characters: string[];
  multiStatementLines: number[];
  extraStatements: number;
  lineNumbers: { lowest: number; highest: number; count: number } | null;
  writeSites: ProgramWriteSite[];
  /** Null where the request named no target, or named one this build lacks. */
  targetSize: ProgramSize | null;
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
  toId: string | null = null,
): ProgramVocabularyReply {
  const from = (fromId !== null ? findDialect(fromId) : undefined) ?? selected;
  // No fallback to the selected dialect, unlike `from`: a size for a machine the
  // guide is not pointed at would be compared against another machine's free RAM.
  const to = toId !== null ? findDialect(toId) : undefined;
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
    characters: vocab.characters,
    multiStatementLines: vocab.multiStatementLines,
    extraStatements: vocab.extraStatements,
    lineNumbers: vocab.lineNumbers,
    writeSites: vocab.writeSites,
    // Sized even when the program is unreadable as the *source* machine's BASIC:
    // the two are separate questions, and the guide decides for itself what to
    // show for a status it is not narrowing by.
    targetSize: programSize(source, to),
  };
}
