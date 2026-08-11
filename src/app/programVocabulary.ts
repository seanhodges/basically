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
 * still yields a vocabulary. Abbreviated and symbol spellings (`?` for `PRINT`,
 * `pO` for `POKE`, `P.` for `PRINT`) are resolved against the source machine's
 * own tables as the scan goes, so a program that prints only with `?` is still
 * a program that prints; the guide always states how much it is holding back
 * and offers the full comparison, so anything still missed is visible rather
 * than silent.
 */
import {
  CharsetError,
  hasFatalErrors,
  type Dialect,
  type MemoryBlock,
} from '../dialects/types';
import { probeFor } from '../dialects/charsetProbes';
import { findDialect } from '../dialects/registry';
import { isBinaryDirective } from '../dialects/binaryDirective';
import { scannable } from '../editor/programOutline';
import { makeCrunchMatcher } from '../editor/crunch';
import { operatorSpellings } from '../dialects/operators';
import {
  keywordSpellingsFor,
  shortSpellingsFor,
  spellingAt,
  type SpellingUse,
} from '../dialects/keywordSpellings';
import {
  positionSyntaxFor,
  type PositionCommand,
  type PositionSyntax,
} from '../dialects/positionSyntax';
import { forEachVariable } from '../editor/variables';
import { variableRulesFor } from '../editor/variableLexis';
import type { PokeSite } from '../editor/pokeAddresses';
import {
  resolveCallSites,
  resolveReadSites,
  resolveWriteSites,
} from './memoryWriteSites';

/** One program's distinct vocabulary, in the language it was read as. */
export interface ProgramVocabulary {
  /** The dialect the program was read as - not necessarily the selected one. */
  dialectId: string;
  /** Distinct keyword spellings, upper case, in the dialect's own spelling. */
  keywords: string[];
  /**
   * The short spellings the program's code actually contains, each with the
   * keyword the source machine reads it as - `?`/`PRINT`, `P.`/`PRINT`,
   * `pO`/`POKE` - distinct and sorted by spelling.
   *
   * Both halves, because the porting guide has to name both: the reader looks
   * for the spelling in their listing and the assistant is told which command it
   * is. The keywords themselves also join {@link keywords}, so a command reached
   * only through a short spelling takes part in the narrowing exactly as one
   * spelled in full does.
   *
   * Empty on a machine that reads no short spelling, and on a program that uses
   * none. A machine whose tokenizer gives a symbol a meaning of its own - `?` is
   * byte indirection on the Acorns - resolves nothing for it, which is what
   * keeps an Atom program's `?` out of here.
   */
  spellings: SpellingUse[];
  /**
   * Distinct variable names the program's code contains, upper-cased and
   * sorted, in the source machine's own spelling (type marker included).
   *
   * Read with the editor's own dialect-aware variable walk, so a keyword, a
   * number, a hex literal and a `PROC`/`FN` call are none of them names - and
   * read over the same `scannable` bodies the keyword scan uses, so a word
   * inside a string literal, a `REM` tail or a `#BIN` payload contributes none.
   *
   * The porting guide groups these by the *target* machine's significance rule:
   * two that reduce to one name there are a variable the port silently merges.
   */
  variables: string[];
  /**
   * Whether the program's code divides, and whether it carries a fractional
   * literal. Two facts rather than one, so a target with no fractions can say
   * which of them it truncates.
   *
   * Read from the same scannable text as everything else here, so a `/` inside
   * a string or a decimal point inside a REM is not arithmetic. Deliberately
   * textual: proving that a division only ever divides exactly needs the program
   * run, and the guide reports arithmetic to check rather than a defect.
   */
  divides: boolean;
  fractionalLiteral: boolean;
  /**
   * Distinct whole-number values in the program's code at or above
   * {@link LARGE_NUMBER_FLOOR}, ascending.
   *
   * What one integer machine holds and a narrower one does not: the porting
   * guide checks these against the target's own range, so a program moving from
   * the Atom's 32-bit integers to the ZX80's 16-bit ones is told which of its
   * own values do not arrive. Magnitudes, because a leading `-` is an operator
   * rather than part of the literal and every integer range here reaches at
   * least as far below zero as above it.
   *
   * Read from the same scannable text as everything else, so a number inside a
   * string or a REM contributes nothing; decimal only, and never part of a
   * fractional literal or a hex one.
   */
  largeNumbers: number[];
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
   * BASIC line numbers carrying more than one statement, sorted.
   *
   * The program's own numbers, not editor line indices: this is read beside a
   * listing, and the number in `30 PRINT:PRINT` is the one printed there. The
   * two coincide only for a program written from line 1 in steps of one with
   * no blank lines, so an editor index sends the reader to the wrong line of
   * their own program - which is what it used to do.
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
  /**
   * The addresses the program reads back, in ascending order, as resolved for
   * the machine it is read as.
   *
   * Beside {@link writeSites} and collected under the same rules, because a read
   * is exactly as machine-bound as a write: the keyboard matrix, the frame clock
   * and the system variables all live somewhere particular. A read aimed at one
   * machine's clock does not fail on another - it returns numbers that mean
   * nothing, which is quieter than a write's damage and no less a porting fact.
   *
   * Empty on a machine that declares no read syntax.
   */
  readSites: ProgramReadSite[];
  /**
   * The addresses the program hands to the processor - its `SYS`, `CALL`,
   * `LINK` and address-taking `USR` targets - in ascending order.
   *
   * The one part of a program no substitution ports: the routine at that address
   * is the source machine's processor code. `expr` keeps the keyword the program
   * reached it with, which is what a reader searches their listing for.
   *
   * Empty on a machine that declares no call keywords, which includes the
   * Microsoft `USR(x)` machines - their argument is data passed to whatever the
   * USR vector points at, not an address.
   */
  callSites: ProgramReadSite[];
  /**
   * The machine-code and data blocks the document carries alongside the program,
   * ascending by address.
   *
   * Name, address and size only. A block's bytes are the one thing the porting
   * story does not need - what the routine *does* is the question, and no scan
   * of this app's answers it - so the payload stays unread here exactly as it
   * does everywhere else in this module.
   */
  codeBlocks: ProgramCodeBlock[];
  /**
   * The screen modes the program selects, or null on a machine with no command
   * for selecting one.
   *
   * The one thing a program's text says about which memory its machine's
   * hardware actually claims: an Atom program that never leaves text mode
   * reaches one kilobyte of the six the video RAM holds, and a BBC program that
   * stays in MODE 7 never touches the twenty kilobytes below the teletext
   * screen. Both the block linter and the porting guide's fit report decide a
   * {@link ConditionalFreeRange} from this.
   */
  screenModes: ScreenModeUse | null;
  /**
   * Where on the text screen the program says to print, or null on a machine
   * with no command for saying so.
   *
   * The program's layout, as numbers. Every one of them was written for one
   * particular screen and survives a port untouched, so the porting guide checks
   * them against the target's own columns and rows - which is the whole finding,
   * since no command list can carry it: the commands port, the numbers are
   * wrong.
   */
  positions: ProgramPositions | null;
  /**
   * BASIC line numbers opening a loop that counts and does nothing else,
   * sorted.
   *
   * A delay, written as the source machine's speed: the count is however many
   * iterations of *that* interpreter filled the pause its author wanted. The
   * lines rather than a count, because that is what a reader searches their
   * listing for - and a listing is searched by the numbers it prints, which is
   * why these are the program's own and not editor indices.
   *
   * Only loops with no body at all. A loop that does work is a loop, and
   * deciding whether a game's main loop was tuned for speed is beyond any
   * reading of its text.
   */
  emptyLoopLines: number[];
}

/**
 * What a program's text says about where it prints.
 *
 * Three collections rather than one, because the three forms are checked
 * differently: a row-and-column pair against both of the target's dimensions, a
 * bare column against its width, and an offset against the whole screen *and*
 * against the width it silently encodes.
 */
export interface ProgramPositions {
  /** Whole positions the program states, distinct and in reading order. */
  cells: { row: number; column: number }[];
  /** Columns it states alone (TAB), ascending and distinct. */
  columns: number[];
  /** Offsets from the start of the screen, ascending and distinct. */
  offsets: number[];
  /**
   * Which cell this machine calls the first one - 0 on the Sinclairs and the
   * Acorns, 1 on a CPC. Carried rather than normalised away, so a reported
   * position is the number the reader will find in their own listing.
   */
  origin: 0 | 1;
  /**
   * True where the program positions with a value its text does not fix -
   * `PRINT AT R,C`, `TAB(N+1)`, or the command with no argument at all. Not a
   * position to judge: doubt reports nothing, and the decision the finding
   * poses is what covers it.
   */
  computed: boolean;
}

/**
 * What a program's text says about the screen modes it selects.
 *
 * `command` rides along because a vocabulary is read as one particular machine
 * and may be judged against another's regions: a BBC `MODE 0` and an Atom
 * `CLEAR 0` are both mode 0 and are opposite ends of their machines' graphics.
 * A reader whose region names a different command cannot decide anything from
 * these numbers and must say so rather than compare them.
 */
export interface ScreenModeUse {
  /** The mode command, upper case, as the machine read spells it. */
  command: string;
  /** Modes selected with a constant argument, ascending and distinct. */
  modes: number[];
  /**
   * True where the program selects a mode with a value its text does not fix -
   * `MODE M`, `MODE 4+N`, or the keyword with no argument at all. Unknowable is
   * not free, so a reader treats this exactly as it treats an offending mode.
   */
  computed: boolean;
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
 * One address the program reads, or hands to the processor. The write site's
 * shape less `role`, which only a write can carry - nothing reads code in.
 */
export interface ProgramReadSite {
  address: number;
  expr: string;
  computed: boolean;
  approximate: boolean;
  endAddress?: number;
}

/**
 * One block of machine code or data the document carries beside the program, as
 * it crosses to the porting guide. `size` rather than the bytes: see
 * {@link ProgramVocabulary.codeBlocks}.
 */
export interface ProgramCodeBlock {
  name: string;
  address: number;
  size: number;
  kind: 'code' | 'data';
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

/**
 * The symbolic operators worth looking for in a program, in this dialect's
 * spelling, longest first.
 *
 * Not every symbolic operator the machine has. `+ - * / = < >` are on every
 * machine here, so finding one says nothing and a bare `-` sits inside every
 * negative number; `%`, `$` and `:` are a variable suffix or a statement
 * separator somewhere. What is left is the set a port turns on: the exponent
 * spelling, the relational digraphs the ZX80 lacks, and the CPC's `\`.
 *
 * `^` is scanned for as well wherever the machine's own spelling is `↑` or `**`,
 * because that is what the tokenizer accepts and what a program is likely to
 * carry; the finding is reported under the spelling the reference page uses.
 */
function symbolicOperatorsIn(dialect: Dialect): [string, string][] {
  const REPORTABLE = ['**', '↑', '^', '\\', '<=', '>=', '<>'];
  const has = operatorSpellings(dialect);
  const pairs: [string, string][] = REPORTABLE.filter((op) => has.has(op)).map(
    (op) => [op, op],
  );
  const power = pairs.find(([op]) => op === '↑' || op === '**');
  if (power && !has.has('^')) pairs.push(['^', power[1]]);
  return pairs.sort((a, b) => b[0].length - a[0].length);
}

/** The distinct keyword spellings the program's code (not its text) contains. */
function keywordsIn(source: string, dialect: Dialect): Set<string> {
  // Alphabetic spellings through the crunch matcher, which is the set it is
  // documented over; the symbolic operators are scanned separately below,
  // because they need no word boundary and most of them earn no finding.
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

  const symbolic = symbolicOperatorsIn(dialect);
  if (symbolic.length > 0) {
    for (const { body } of codeLines(source)) {
      const code = scannable(body);
      for (let i = 0; i < code.length; i++) {
        const match = symbolic.find(([spelling]) =>
          code.startsWith(spelling, i),
        );
        if (!match) continue;
        found.add(match[1]);
        i += match[0].length - 1;
      }
    }
  }
  return found;
}

/**
 * The short spellings the program's code contains, resolved as the machine it
 * is read as resolves them.
 *
 * Over the same `scannable` bodies the keyword scan walks, so a `?` inside a
 * string and a `P.` inside a REM are text rather than commands - the machines
 * treat them that way too.
 *
 * A full spelling that reaches at least as far always wins, exactly as it does
 * in the tokenizers: without it a Commodore program written `pRINT` would be
 * reported as the abbreviation `pR` (which is PRINT#, a different command) when
 * the machine plainly reads PRINT.
 */
function shortSpellingsIn(source: string, dialect: Dialect): SpellingUse[] {
  const spellings = keywordSpellingsFor(dialect.id);
  if (spellings.style === 'none' && spellings.symbols.length === 0) return [];

  const full = dialect.keywords
    .map((k) => k.word.toUpperCase())
    .sort((a, b) => b.length - a.length);
  const found = new Map<string, SpellingUse>();

  for (const { body } of codeLines(source)) {
    const code = scannable(body);
    const upper = code.toUpperCase();
    let i = 0;
    while (i < code.length) {
      const hit = spellingAt(code, i, spellings);
      if (hit === null) {
        i++;
        continue;
      }
      const spelled = full.find((w) => upper.startsWith(w, i));
      if (spelled !== undefined && spelled.length >= hit.length) {
        i += spelled.length;
        continue;
      }
      found.set(hit.spelling, { spelling: hit.spelling, keyword: hit.keyword });
      i += hit.length;
    }
  }
  return [...found.values()].sort((a, b) =>
    a.spelling.localeCompare(b.spelling),
  );
}

/**
 * The distinct variable names the program's code contains, upper-cased.
 *
 * The editor's own walk rather than a second one: `forEachVariable` is what the
 * highlighter, the completion and the variable lint already read a name with, so
 * a defect in it is visible in three places instead of hidden in this one. The
 * rules come from the shared lexis table, which is what knows that a BBC name may
 * carry `_` and a TRS-80 name may end `!` or `#`.
 *
 * A `PROC`/`FN` call and a glued keyword are already excluded by the walk. Upper
 * case because the machines that matter here are case-insensitive about names,
 * and the target's significance rule is applied to what comes out.
 */
function variablesIn(source: string, dialect: Dialect): Set<string> {
  const rules = variableRulesFor(dialect.id, dialect.keywords);
  const found = new Set<string>();
  for (const { body } of codeLines(source)) {
    forEachVariable(scannable(body), rules, (t) =>
      found.add(t.text.toUpperCase()),
    );
  }
  return found;
}

/** A numeric literal carrying a fractional part: `1.5`, `.5`, `10.`. */
const FRACTIONAL_LITERAL = /\d\.\d|\.\d|\d\./;

/**
 * Whether the program's code divides, and whether it carries a fractional
 * literal.
 *
 * Over `scannable` bodies, so a `/` in a filename string and a decimal point in
 * a comment are neither of them arithmetic. The literal pattern requires a digit
 * against the point, which is what keeps a ROM's `P.` abbreviation for `PRINT`
 * out of it; the line number is already off the body, so `10.` here is a real
 * fractional literal rather than a line.
 */
function fractionalArithmeticIn(source: string): {
  divides: boolean;
  fractionalLiteral: boolean;
} {
  let divides = false;
  let fractionalLiteral = false;
  for (const { body } of codeLines(source)) {
    const code = scannable(body);
    if (code.includes('/')) divides = true;
    if (FRACTIONAL_LITERAL.test(code)) fractionalLiteral = true;
    if (divides && fractionalLiteral) break;
  }
  return { divides, fractionalLiteral };
}

/**
 * The smallest magnitude any registered integer-only machine cannot hold, and
 * so the smallest value worth recording in {@link ProgramVocabulary.largeNumbers}.
 *
 * The ZX80's ceiling plus one. A value below this fits every integer machine
 * here, so collecting it would put every loop counter in the program on the
 * wire for a finding that could never name it. `programVocabulary.test.ts`
 * fails if a machine registers whose range stops lower, which is the moment
 * this bound needs rethinking rather than a place for it to be quietly wrong.
 */
export const LARGE_NUMBER_FLOOR = 32768;

/**
 * A decimal whole number, with nothing against it that would make it something
 * else: no digit or point before or after it, and no hex prefix or identifier
 * character on its left. `&3000`, `#8400`, `&H8000`, `1.5` and the `8` of `A8`
 * are all excluded by those edges.
 */
const WHOLE_NUMBER = /(?:^|[^0-9A-Za-z_.&#$])(\d+)(?![0-9.])/g;

/**
 * The distinct whole-number values in the program's code the narrowest integer
 * machine here could not hold.
 *
 * Literals only, never evaluated expressions: what a calculation reaches cannot
 * be known without running the program, and the range finding poses that as a
 * decision rather than pretending to have computed it.
 */
function largeNumbersIn(source: string): Set<number> {
  const found = new Set<number>();
  for (const { body } of codeLines(source)) {
    const code = scannable(body);
    for (const match of code.matchAll(WHOLE_NUMBER)) {
      const value = parseInt(match[1]!, 10);
      if (value >= LARGE_NUMBER_FLOOR) found.add(value);
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
  for (const { number, body } of codeLines(source)) {
    // A line with no number of its own is not reported: it is not a line the
    // reader can find in a listing, and every machine here refuses a program
    // carrying one, so the guide never narrows on such a program anyway.
    if (number === undefined) continue;
    const statements = scannable(body)
      .split(separator)
      // A trailing or doubled separator is an empty statement, which real
      // programs contain and which is not a second statement to split out.
      .filter((s) => s.trim() !== '');
    if (statements.length > 1) {
      lines.push(number);
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
 * A mode argument the program's text fixes: a decimal constant with nothing
 * glued to it that would make it the first term of an expression.
 *
 * Decimal only. `MODE &07` is legal and vanishingly rare, and reading it would
 * mean teaching this scan each machine's hex prefix to buy a case no listing
 * writes; reported as computed, it costs a region left claimed, which is the
 * direction doubt is meant to run here.
 */
const MODE_ARGUMENT = /^\s*(\d+)\s*/;

/** Characters that make a matched constant the first term of an expression. */
const ARGUMENT_CONTINUES = /[0-9A-Za-z_$%!#.+\-*/^&()<>=]/;

/**
 * The screen modes the program selects, or null on a machine with no command
 * for selecting one.
 *
 * Over the same `scannable` bodies as everything else here, so a `MODE` inside
 * a string literal or a REM tail selects nothing. Every selection whose value
 * the text does not fix sets `computed` instead of contributing a number: a
 * reader of this decides whether memory is free, and a mode it cannot name is
 * not a mode it can rule out.
 *
 * The machine's own short spellings of the command count as the command. Every
 * machine that has a mode command at all is an Acorn, which is to say every one
 * of them takes a dotted prefix - so a listing reading `MO.1` or `C.4` selects
 * a mode as surely as the spelled-out form, and a scan that only knew the long
 * spelling would report the program as having stayed in the mode it booted in
 * and offer memory the program had already claimed.
 */
function screenModesIn(source: string, dialect: Dialect): ScreenModeUse | null {
  const command = dialect.memoryBlocks?.screenModeCommand;
  if (command === undefined) return null;
  const keyword = command.keyword.toUpperCase();
  const spellings = [
    keyword,
    ...(shortSpellingsFor(dialect.id).get(keyword) ?? []),
  ].map((s) => s.toUpperCase());
  const modes = new Set<number>();
  let computed = false;

  for (const { body } of codeLines(source)) {
    const code = scannable(body).toUpperCase();
    for (const spelling of spellings) {
      for (
        let i = code.indexOf(spelling);
        i !== -1;
        i = code.indexOf(spelling, i + spelling.length)
      ) {
        const before = code[i - 1];
        const after = code[i + spelling.length];
        // Both these keywords begin and end with letters, so a match has to sit
        // at a word boundary or `MODEL%` reports a mode. A digit against the
        // keyword is the exception rather than a broken boundary: `MODE7` is how
        // the listings are written. A dotted spelling ends at its own dot, so
        // only its left edge can be glued to something.
        const endsInDot = spelling.endsWith('.');
        if (
          isIdent(before) ||
          (!endsInDot && isIdent(after) && !/\d/.test(after ?? ''))
        ) {
          continue;
        }
        const rest = code.slice(i + spelling.length);
        const match = MODE_ARGUMENT.exec(rest);
        const tail = match !== null ? rest[match[0].length] : undefined;
        if (
          match !== null &&
          !(tail !== undefined && ARGUMENT_CONTINUES.test(tail))
        ) {
          modes.add(parseInt(match[1]!, 10));
        } else {
          computed = true;
        }
      }
    }
  }
  return {
    command: keyword,
    modes: [...modes].sort((a, b) => a - b),
    computed,
  };
}

/**
 * A constant argument starting at `i`, and where it ends, or null where the
 * program's text does not fix it.
 *
 * `close` is the character that legitimately ends the argument beyond the
 * separators - the `)` of a bracketed form - which without it would read as an
 * expression continuing and turn every `TAB(5)` into a computed position.
 */
function constantAt(
  code: string,
  i: number,
  close: string | null,
): { value: number; end: number } | null {
  const match = MODE_ARGUMENT.exec(code.slice(i));
  if (match === null) return null;
  const end = i + match[0].length;
  const tail = code[end];
  if (tail !== undefined && tail !== close && ARGUMENT_CONTINUES.test(tail)) {
    return null;
  }
  return { value: parseInt(match[1]!, 10), end };
}

/** What one position command's arguments came to, at one place in the text. */
interface PositionArguments {
  /** The constants read, in the order the machine writes them. */
  values: number[];
  /** True where the text does not fix them. */
  computed: boolean;
}

/**
 * The arguments of a position command written at `i`, which is the index just
 * past its keyword.
 *
 * One argument or two, by the command's own form - and by what is actually
 * there, where the second is optional: the BBC's `TAB(x)` and `TAB(x,y)` are
 * one keyword meaning a column and a whole position, and which one a line means
 * is decided by whether it wrote a comma.
 */
function positionArgumentsAt(
  code: string,
  i: number,
  command: PositionCommand,
): PositionArguments {
  let j = i;
  while (code[j] === ' ') j++;
  const bracketed = code[j] === '(';
  if (bracketed) j++;
  const close = bracketed ? ')' : null;
  const first = constantAt(code, j, close);
  if (first === null) return { values: [], computed: true };
  if (command.kind === 'column' || command.kind === 'offset') {
    return { values: [first.value], computed: false };
  }
  if (code[first.end] !== ',') {
    // A second argument that may be left off leaves a column behind; one that
    // may not is a position the text has not finished stating.
    return command.secondOptional === true
      ? { values: [first.value], computed: false }
      : { values: [], computed: true };
  }
  const second = constantAt(code, first.end + 1, close);
  if (second === null) return { values: [], computed: true };
  return { values: [first.value, second.value], computed: false };
}

/** A position collector, so the code scan and the escape scan fill one result. */
interface PositionCollector {
  cells: { row: number; column: number }[];
  columns: Set<number>;
  offsets: Set<number>;
  computed: boolean;
}

/** File one command's arguments under the form that command states. */
function collectPosition(
  into: PositionCollector,
  command: PositionCommand,
  args: PositionArguments,
): void {
  if (args.computed || args.values.length === 0) {
    into.computed = true;
    return;
  }
  const [a, b] = args.values as [number, number | undefined];
  if (command.kind === 'offset') {
    into.offsets.add(a);
    return;
  }
  if (b === undefined) {
    into.columns.add(a);
    return;
  }
  const cell =
    command.kind === 'row-column'
      ? { row: a, column: b }
      : { row: b, column: a };
  if (!into.cells.some((c) => c.row === cell.row && c.column === cell.column)) {
    into.cells.push(cell);
  }
}

/**
 * A position control code written inside a string literal: `{AT 5,3}`,
 * `{TAB 12}`.
 *
 * The escape scan proper records a code's leading byte and throws the operands
 * away, which is right for what it is for - one byte identifies the row in the
 * docs table however the operand was written. A layout, though, *is* the
 * operands, so they are read here instead.
 */
const BRACED_ESCAPE = /\{\s*([A-Za-z]+)([^}]*)\}/g;

/**
 * The positions the program states, or null on a machine that states none.
 *
 * Over the same `scannable` bodies as everything else here for the commands, and
 * over the string literals for the control codes - which is the same division
 * the keyword and escape scans already make, and for the same reason: a `TAB`
 * inside a string is text, and a `{AT 5,3}` outside one is not a control code.
 *
 * The machine's own short spellings count as the command, as they do for the
 * mode scan: a BBC listing writing `T.(5,3)` positions exactly as `TAB(5,3)`
 * does, and a scan that only knew the long spelling would report the program as
 * stating no positions at all.
 */
function positionsIn(
  source: string,
  dialect: Dialect,
): ProgramPositions | null {
  const syntax: PositionSyntax | undefined = positionSyntaxFor(dialect.id);
  if (syntax === undefined) return null;
  const short = shortSpellingsFor(dialect.id);
  const into: PositionCollector = {
    cells: [],
    columns: new Set(),
    offsets: new Set(),
    computed: false,
  };

  for (const { body } of codeLines(source)) {
    const code = scannable(body).toUpperCase();
    for (const command of syntax.commands) {
      const spellings = [
        command.keyword,
        ...(short.get(command.keyword) ?? []),
      ].map((s) => s.toUpperCase());
      for (const spelling of spellings) {
        for (
          let i = code.indexOf(spelling);
          i !== -1;
          i = code.indexOf(spelling, i + spelling.length)
        ) {
          // A word boundary, or the match is inside a name: `DATA` carries an
          // `AT` and `TOTAL` a `TA`. A spelling that is not made of identifier
          // characters at all - the TRS-80's `@` - has no boundary to keep, and
          // a dotted spelling ends at its own dot.
          const before = code[i - 1];
          const after = code[i + spelling.length];
          const alphabetic = /[A-Z]/.test(spelling[0]!);
          if (
            alphabetic &&
            (isIdent(before) ||
              (!spelling.endsWith('.') && isIdent(after) && !/\d/.test(after)))
          ) {
            continue;
          }
          collectPosition(
            into,
            command,
            positionArgumentsAt(code, i + spelling.length, command),
          );
        }
      }
    }
    if (syntax.escapes.length === 0) continue;
    for (const literal of stringLiterals(body)) {
      for (const match of literal.toUpperCase().matchAll(BRACED_ESCAPE)) {
        const command = syntax.escapes.find((e) => e.keyword === match[1]);
        if (command === undefined) continue;
        collectPosition(
          into,
          command,
          positionArgumentsAt(match[2]!, 0, command),
        );
      }
    }
  }

  return {
    cells: into.cells,
    columns: [...into.columns].sort((a, b) => a - b),
    offsets: [...into.offsets].sort((a, b) => a - b),
    origin: syntax.origin,
    computed: into.computed,
  };
}

/** One statement of the program, with the BASIC line it was written on. */
interface Statement {
  line: number;
  code: string;
}

/**
 * The program's statements in reading order, as `dialect` separates them.
 *
 * `Dialect.statementSeparator` for the same reason {@link statementLayoutIn}
 * uses it: it is the only field that can say a machine has no separator, and a
 * ZX81 line reading `PRINT "TIME: ";T` is one statement however many colons it
 * carries.
 */
function statementsIn(source: string, dialect: Dialect): Statement[] {
  const separator = dialect.statementSeparator;
  const out: Statement[] = [];
  for (const { number, body } of codeLines(source)) {
    // Numbered lines only, as {@link statementLayoutIn} reports: a loop the
    // reader cannot find in their listing is not worth naming. A `FOR` on an
    // unnumbered line would still open on the stack, so skipping the line
    // whole keeps the walk from pairing it with a `NEXT` further down.
    if (number === undefined) continue;
    const code = scannable(body).toUpperCase();
    const parts = separator === null ? [code] : code.split(separator);
    for (const part of parts) {
      if (part.trim() !== '') out.push({ line: number, code: part.trim() });
    }
  }
  return out;
}

/** Whether a statement opens with `keyword`, in any spelling the machine reads. */
function opensWith(
  statement: string,
  keyword: string,
  dialect: Dialect,
  short: Map<string, string[]>,
): boolean {
  const spellings = [keyword, ...(short.get(keyword) ?? [])].map((s) =>
    s.toUpperCase(),
  );
  return spellings.some((spelling) => {
    if (!statement.startsWith(spelling)) return false;
    const after = statement[spelling.length];
    // A crunching ROM reads `FORI=1TO5`, so no boundary is required there; a
    // dotted spelling ends at its own dot and needs none either.
    return (
      dialect.crunched === true ||
      spelling.endsWith('.') ||
      after === undefined ||
      !isIdent(after)
    );
  });
}

/**
 * The lines opening a loop that counts and does nothing else.
 *
 * A stack walk over the program's statements rather than a per-line match,
 * because a loop's body is not a line: `FOR I=1 TO 500: NEXT` is a delay on one
 * line, a `FOR` and a `NEXT` on consecutive lines are the same delay written
 * differently, and the same two lines with anything between them are a loop
 * that does work. Only the statements decide it.
 *
 * A nest whose innermost loop is empty is empty throughout - `FOR I…FOR J…NEXT
 * J…NEXT I` does nothing but count, twice - so every level of it is reported.
 * `NEXT I,J` closes two, which is what the machines do with it.
 *
 * A `NEXT` with nothing open is ignored rather than treated as an error: this
 * reads programs mid-edit, and half a loop is a normal thing to find.
 */
function emptyLoopLinesIn(source: string, dialect: Dialect): number[] {
  const short = shortSpellingsFor(dialect.id);
  const open: { line: number; hasBody: boolean }[] = [];
  const found = new Set<number>();

  for (const { line, code } of statementsIn(source, dialect)) {
    if (opensWith(code, 'FOR', dialect, short)) {
      open.push({ line, hasBody: false });
      continue;
    }
    if (opensWith(code, 'NEXT', dialect, short)) {
      // `NEXT I,J` names two loops and closes both.
      const closes = Math.max(1, code.split(',').length);
      for (let n = 0; n < closes; n++) {
        const loop = open.pop();
        if (loop === undefined) break;
        if (!loop.hasBody) found.add(loop.line);
      }
      continue;
    }
    for (const loop of open) loop.hasBody = true;
  }
  return [...found].sort((a, b) => a - b);
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

/** The addresses the program reads or calls, as plain data for the wire. */
function accessSitesIn(sites: PokeSite[]): ProgramReadSite[] {
  return sites.map(({ address, expr, computed, approximate, endAddress }) => ({
    address,
    expr,
    computed,
    approximate,
    ...(endAddress !== undefined ? { endAddress } : {}),
  }));
}

/**
 * The document's blocks as the guide sees them: what each one is called, where
 * it sits and how much room it takes.
 *
 * The payload is deliberately left behind. It is the one field of a block that
 * would have to be understood rather than reported, and understanding Z80 or
 * 6502 is the assistant's work on request, not the comparison's.
 */
function codeBlocksIn(blocks: readonly MemoryBlock[]): ProgramCodeBlock[] {
  return [...blocks]
    .sort((a, b) => a.address - b.address)
    .map((b) => ({
      name: b.name,
      address: b.address,
      size: b.bytes.length,
      kind: b.kind,
    }));
}

/**
 * The distinct commands and control codes `source` contains, read as `dialect`,
 * together with the addresses it reaches and the code blocks the document
 * carries beside it.
 *
 * `blocks` is the document's, not the source text's: a block is attached to the
 * program rather than written in it, so a caller with none passes none and the
 * vocabulary reports none.
 *
 * An empty or unreadable program yields an empty vocabulary, which callers are
 * expected to treat as "no program" - narrowing a comparison to nothing would
 * report a port with no work in it, which is the one wrong answer here.
 */
export function programVocabulary(
  source: string,
  dialect: Dialect,
  blocks: readonly MemoryBlock[] = [],
): ProgramVocabulary {
  const layout = statementLayoutIn(source, dialect);
  const arithmetic = fractionalArithmeticIn(source);
  const spellings = shortSpellingsIn(source, dialect);
  // A command the program only ever reaches through a short spelling is a
  // command the program uses: it joins the keywords, or every finding about it
  // would be silently absent.
  const keywords = keywordsIn(source, dialect);
  for (const { keyword } of spellings) keywords.add(keyword);
  return {
    dialectId: dialect.id,
    keywords: [...keywords].sort(),
    spellings,
    variables: [...variablesIn(source, dialect)].sort(),
    divides: arithmetic.divides,
    fractionalLiteral: arithmetic.fractionalLiteral,
    largeNumbers: [...largeNumbersIn(source)].sort((a, b) => a - b),
    escapeCodes: [...escapeCodesIn(source, dialect)].sort((a, b) => a - b),
    characters: [...charactersIn(source, dialect)].sort(),
    multiStatementLines: layout.lines,
    extraStatements: layout.extraStatements,
    lineNumbers: lineNumbersIn(source),
    writeSites: writeSitesIn(source, dialect),
    readSites: accessSitesIn(resolveReadSites(source, dialect)),
    callSites: accessSitesIn(resolveCallSites(source, dialect)),
    codeBlocks: codeBlocksIn(blocks),
    screenModes: screenModesIn(source, dialect),
    positions: positionsIn(source, dialect),
    emptyLoopLines: emptyLoopLinesIn(source, dialect),
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
  spellings: SpellingUse[];
  variables: string[];
  divides: boolean;
  fractionalLiteral: boolean;
  largeNumbers: number[];
  escapeCodes: number[];
  characters: string[];
  multiStatementLines: number[];
  extraStatements: number;
  lineNumbers: { lowest: number; highest: number; count: number } | null;
  writeSites: ProgramWriteSite[];
  readSites: ProgramReadSite[];
  callSites: ProgramReadSite[];
  codeBlocks: ProgramCodeBlock[];
  /** Null on a machine with no command for selecting a screen mode. */
  screenModes: ScreenModeUse | null;
  /** Null on a machine with no command for stating a print position. */
  positions: ProgramPositions | null;
  emptyLoopLines: number[];
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
  blocks: readonly MemoryBlock[] = [],
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
  const vocab = programVocabulary(source, from, blocks);
  return {
    status,
    dialectId: vocab.dialectId,
    keywords: vocab.keywords,
    spellings: vocab.spellings,
    variables: vocab.variables,
    divides: vocab.divides,
    fractionalLiteral: vocab.fractionalLiteral,
    largeNumbers: vocab.largeNumbers,
    escapeCodes: vocab.escapeCodes,
    characters: vocab.characters,
    multiStatementLines: vocab.multiStatementLines,
    extraStatements: vocab.extraStatements,
    lineNumbers: vocab.lineNumbers,
    writeSites: vocab.writeSites,
    readSites: vocab.readSites,
    callSites: vocab.callSites,
    codeBlocks: vocab.codeBlocks,
    screenModes: vocab.screenModes,
    positions: vocab.positions,
    emptyLoopLines: vocab.emptyLoopLines,
    // Sized even when the program is unreadable as the *source* machine's BASIC:
    // the two are separate questions, and the guide decides for itself what to
    // show for a status it is not narrowing by.
    targetSize: programSize(source, to),
  };
}
