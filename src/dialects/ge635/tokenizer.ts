// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { CR, LF, SPACE, parseChar } from './charset';
import { ge635Statements } from './keywords';

/**
 * Editor text -> the bytes a GE-635 paper tape carried.
 *
 * There is no tokenized program format here, as there is none on the GE-235:
 * BASIC was **compiled**, the program staying as characters until `RUN`
 * translated the whole of it, which is why no keyword in this dialect has a
 * byte of its own. So "program bytes" is the source as the tape held it - one
 * ASCII code per character, with the two codes that end a teletype line after
 * each.
 *
 * **What the manual settles and what it does not.** Appendix A gives the
 * procedure - "type LISTNH, and turn on the paper tape unit", then `NEW`, the
 * file name, `TAPE` and `KEY` to read one back - and says only that this
 * "will output the program on tape in a format suitable for reading into the
 * teletype at a later date". It never describes the tape's framing. So the
 * tape here is the listing: what `LISTNH` prints, punched as it is printed,
 * each line closed by the carriage return and line feed section 2.7 names.
 * Nothing further is invented. In particular there is **no end-of-tape code**.
 * The GE-235's tape ends with an end-of-message code because its 6-bit set has
 * one; ASCII has not, the manual names none, and section 2.7's `EOT` is
 * introduced as what a stray code 4 does to the teletype rather than as how a
 * program tape ends. The image is therefore the program, byte for byte.
 *
 * A record is written canonically - the line number, one space, then the line
 * body with its outer spaces trimmed - so that decoding an image and encoding
 * it again returns the same bytes. Spaces *inside* the body are kept exactly
 * as typed: a tape holds what was punched.
 *
 * Per project convention this collects {@link TokenizeError}s rather than
 * throwing, with 1-based lines and 0-based columns, and marks the
 * whole-program rules `fatal: false` so an odd-looking program still punches a
 * complete tape - which is what the machine would have done.
 */
export interface TokenizedProgram {
  /** The line records: ASCII codes, each line closed by CR and LF. */
  program: Uint8Array;
  /**
   * The whole tape. The same bytes as {@link program}: this machine's tape has
   * no terminator to add - see the note above.
   */
  image: Uint8Array;
  errors: TokenizeError[];
}

/**
 * Digits the compiler will read in a line number, which is where this limit
 * really lives. Section 2.8's `ILLEGAL LINE NUMBER` is what a longer one gets:
 * "Line number is of incorrect form, or contains more than five digits." It is
 * the digits that are counted and not the number they come to, so `000010` is
 * six of them and refused although the number is ten - which is what the
 * GE-235's compiler listing counts too.
 */
export const MAX_LINE_DIGITS = 5;

/** The largest line number that many digits can spell. */
export const MAX_LINE_NUMBER = 10 ** MAX_LINE_DIGITS - 1;

/**
 * The most characters a program may hold, and the one size rule the manual
 * gives outright. Section 2.9: "Let C = no. of characters in program, M = no.
 * of components in all vectors and matrices, S = no. of strings; then
 * C/4 + M + S < 8000 is a requirement." Four characters to a thirty-six-bit
 * word, so a program with no arrays and no strings at all still cannot pass
 * 31999 characters, and one with either hits the wall sooner - which is why
 * this is a ceiling rather than the rule. `OUT OF ROOM` is what the machine
 * answers, and `C` is what the terminal's `LENGTH` command reports.
 *
 * There is deliberately no line-count limit beside it. The GE-235 has one
 * because its compiler's line table has a size; this manual states none, and
 * inventing one would reject programs the machine ran.
 */
export const MAX_PROGRAM_CHARACTERS = 31999;

const LETTER = /[A-Za-z]/;
const NAME_TAIL = /[A-Za-z0-9]/;

/**
 * The statement word a line opens with, and the index just past it, or null
 * where the line opens with something no statement begins.
 *
 * Spaces are skipped *while* matching rather than before it, because blanks
 * cannot be significant to the match: the manual writes the same statement
 * both ways, `250 G0 T0 999` in section 2.5 and `G0T0` in the paragraph above
 * it, and section 1.7.6 heads the switch `0N ... G0 T0`. What the manual never
 * does is state the rule, so this is read off its own spellings rather than
 * quoted - and it is the GE-235's behaviour too, whose compiler deletes every
 * blank outside a string literal as it reads a line in.
 */
function matchStatement(body: string): { word: string; end: number } | null {
  for (const word of ge635Statements) {
    let i = 0;
    let matched = 0;
    while (i < body.length && matched < word.length) {
      const ch = body[i]!;
      if (ch === ' ') {
        i++;
        continue;
      }
      if (ch.toUpperCase() !== word[matched]) break;
      matched++;
      i++;
    }
    if (matched === word.length) return { word, end: i };
  }
  return null;
}

/** The name at the head of a line, for the "that is not a statement" message. */
function leadingName(body: string): string {
  const start = body.search(/\S/);
  if (start === -1) return body.trim();
  let end = start;
  while (end < body.length && NAME_TAIL.test(body[end]!)) end++;
  return end > start ? body.slice(start, end) : body[start]!;
}

/** True when the line looks like `A=1`, `A$="X"` or `A(1)=2` - a LET with no LET. */
function looksLikeAssignment(body: string): boolean {
  const stripped = body.replace(/ /g, '');
  return (
    LETTER.test(stripped[0] ?? '') && /^[A-Za-z][0-9]?\$?[=(]/.test(stripped)
  );
}

/** Encode `text` to ASCII codes, reporting anything the Teletype cannot punch. */
function encodeText(
  text: string,
  editorLine: number,
  baseCol: number,
  errors: TokenizeError[],
): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    try {
      const { code, length } = parseChar(text, i);
      out.push(code);
      i += length;
    } catch (e) {
      if (!(e instanceof CharsetError)) throw e;
      const cp = String.fromCodePoint(text.codePointAt(i)!);
      errors.push({
        line: editorLine,
        column: baseCol + i,
        endColumn: baseCol + i + cp.length,
        message: e.message,
      });
      i += cp.length;
    }
  }
  return out;
}

interface LineRecord {
  editorLine: number;
  lineNo: number;
  statement: string | null;
  codes: number[];
}

/** Editor text -> the GE-635 paper tape it would have been punched on. */
export function tokenizeProgram(source: string): TokenizedProgram {
  const errors: TokenizeError[] = [];
  const records: LineRecord[] = [];
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^(\s*)(\d+)(.*)$/.exec(raw);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const digits = m[2]!;
    const lineNo = parseInt(digits, 10);
    if (digits.length > MAX_LINE_DIGITS) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        endColumn: m[1]!.length + digits.length,
        message: `Line number ${lineNo} has more than ${MAX_LINE_DIGITS} digits (0–${MAX_LINE_NUMBER})`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      // Non-fatal: the line is still punched, so the tape stays complete and
      // buildable, as the other dialects treat ordering lint.
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        endColumn: m[1]!.length + digits.length,
        message: `Line number ${lineNo} is not greater than the previous (${prevLineNo})`,
        fatal: false,
      });
    }
    prevLineNo = lineNo;

    // The body without its outer spaces, and where it starts in the editor
    // line, so a character error underlines the character the user typed.
    const rest = m[3]!;
    const lead = rest.length - rest.trimStart().length;
    const body = rest.trim();
    const bodyCol = m[1]!.length + digits.length + lead;

    const codes = encodeText(digits, editorLine, m[1]!.length, errors);
    if (body !== '') {
      codes.push(SPACE);
      codes.push(...encodeText(body, editorLine, bodyCol, errors));
    }

    const statement = matchStatement(body)?.word ?? null;
    if (statement === null && body !== '' && !isRemarkOnly(body)) {
      errors.push({
        line: editorLine,
        column: bodyCol,
        endColumn: bodyCol + leadingName(body).length,
        message: looksLikeAssignment(body)
          ? `Assignment needs LET: write 'LET ${body}'`
          : `Statement must start with a BASIC command (got '${leadingName(body)}')`,
        fatal: false,
      });
    }
    records.push({ editorLine, lineNo, statement, codes });
  }

  reportProgramShape(records, errors);

  const program: number[] = [];
  for (const { codes } of records) program.push(...codes, CR, LF);
  const bytes = Uint8Array.from(program);
  return { program: bytes, image: bytes, errors };
}

/**
 * Whether the body is only a remark in the apostrophe form. Section 2.5 gives
 * that form as a tail - "Place an ' (apostrophe) at the end of the line,
 * followed by a remark" - and is silent on a line that is nothing else, so a
 * line the user has written that way is left alone rather than reported as an
 * instruction the compiler cannot decode.
 */
function isRemarkOnly(body: string): boolean {
  return body.startsWith("'");
}

/**
 * The whole-program rules, all non-fatal here: a program that breaks one still
 * punches a complete tape, and the machine only complains when it comes to
 * compile it. Each is one of section 2.8's compile-time messages.
 *
 * `END` is `NO END INSTRUCTION` when missing and `END IS NOT LAST` otherwise.
 * Section 1.7.9 states it by line number rather than by position - "it must be
 * the statement with the highest line number in the program" - so that is what
 * is checked here, and a program whose lines are out of order is judged the
 * way the compiler would judge it once it had sorted them. Section 2.8 adds
 * that the same message "also occurs if there are two or more END statements
 * in the program", which is what flagging every `END` but the highest reports.
 *
 * The size rule is section 2.9's, reported against {@link
 * MAX_PROGRAM_CHARACTERS}; the machine's own answer is `OUT OF ROOM`.
 */
function reportProgramShape(
  records: readonly LineRecord[],
  errors: TokenizeError[],
): void {
  if (records.length === 0) return;
  const last = records[records.length - 1]!;

  const highest = Math.max(...records.map((r) => r.lineNo));
  for (const record of records) {
    if (record.statement === 'END' && record.lineNo !== highest) {
      errors.push({
        line: record.editorLine,
        column: 0,
        message: 'END must have the highest line number in the program',
        fatal: false,
      });
    }
  }
  if (!records.some((r) => r.statement === 'END')) {
    errors.push({
      line: last.editorLine,
      column: 0,
      message: 'Program must end with an END statement',
      fatal: false,
    });
  }

  const characters = records.reduce((n, r) => n + r.codes.length, 0);
  if (characters > MAX_PROGRAM_CHARACTERS) {
    errors.push({
      line: last.editorLine,
      column: 0,
      message: `Program is ${characters} characters, past the ${MAX_PROGRAM_CHARACTERS} a program with no arrays or strings may hold`,
      fatal: false,
    });
  }
}
