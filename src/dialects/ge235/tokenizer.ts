// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { CR, EOM, SPACE, parseChar } from './charset';
import { ge235Statements } from './keywords';

/**
 * Editor text -> the bytes the GE-235 would have read.
 *
 * This machine had no tokenized program format. BASIC was **compiled**: the
 * program stayed as characters and `RUN` translated the whole of it, which is
 * why no keyword here has a byte of its own. So "program bytes" is the source
 * as the paper tape carried it - one 6-bit BCD code per line character, a
 * carriage return (0o37) ending each line, and an end-of-message code (0o55)
 * ending the tape. Encountering that last code with no `END` compiled is where
 * the compiler's "no end instruction" comes from.
 *
 * One code per byte here, though the machine packed three to a 20-bit word: a
 * `Uint8Array` cannot hold 20-bit words, and every consumer of these bytes
 * wants characters rather than words.
 *
 * A record is written canonically - the line number, one space, then the line
 * body with its outer spaces trimmed - so that decoding an image and encoding
 * it again returns the same bytes. Spaces *inside* the body are kept exactly as
 * typed even though the compiler deletes them outside a string literal, because
 * a tape holds what was punched.
 *
 * Per project convention this collects {@link TokenizeError}s rather than
 * throwing, with 1-based lines and 0-based columns, and marks statement-shape
 * lint `fatal: false` so an odd-looking program still builds a runnable image.
 */
export interface TokenizedProgram {
  /** The line records: BCD codes with a carriage return after each line. */
  program: Uint8Array;
  /** {@link program} plus the end-of-message code - the whole tape. */
  image: Uint8Array;
  errors: TokenizeError[];
}

/**
 * The largest line number the compiler accepts. `comp` in `BA-1` counts the
 * digits and takes at most five (`bxh 6,2`, guarding a table the routine's own
 * comment calls "5 dig in tester or regular basic").
 */
export const MAX_LINE_NUMBER = 99999;

/**
 * How many lines a program may have. `comp` builds two words of `f` per line
 * and gives up when the pointer passes the end of that 480-word table
 * (`bxh 481,3`), which the source comments as "too many lines in program -
 * 241". The 241st line is the one that fails, so 240 fit.
 */
export const MAX_LINES = 240;

const LETTER = /[A-Za-z]/;
const NAME_TAIL = /[A-Za-z0-9]/;

/**
 * The statement word a line opens with, and the index just past it, or null
 * where the line opens with something the `q` jump table cannot decode.
 *
 * Spaces are skipped *while* matching rather than before it, because that is
 * what the machine does: `trans` deletes every blank outside a string literal
 * as it reads the line in, so `P R I N T` and `GO TO` reach the decoder as
 * `PRINT` and `GOTO`.
 */
function matchStatement(body: string): { word: string; end: number } | null {
  for (const word of ge235Statements) {
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

/** True when the line looks like `A=1` or `A(1)=2` - an assignment with no LET. */
function looksLikeAssignment(body: string): boolean {
  const stripped = body.replace(/ /g, '');
  return LETTER.test(stripped[0] ?? '') && /^[A-Za-z][0-9]?[=(]/.test(stripped);
}

/** Encode `text` to BCD codes, reporting anything the Teletype cannot punch. */
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
  statement: string | null;
  codes: number[];
}

/** Editor text -> the GE-235 paper tape it would have been punched on. */
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
    if (lineNo > MAX_LINE_NUMBER) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        endColumn: m[1]!.length + digits.length,
        message: `Line number ${lineNo} out of range 0–${MAX_LINE_NUMBER}`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      // Non-fatal: the line is still punched, so the tape stays complete and
      // buildable (as the other dialects treat ordering lint).
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
    if (statement === null && body !== '') {
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
    records.push({ editorLine, statement, codes });
  }

  reportProgramShape(records, errors);

  const program: number[] = [];
  for (const { codes } of records) program.push(...codes, CR);
  return {
    program: Uint8Array.from(program),
    image: Uint8Array.from([...program, EOM]),
    errors,
  };
}

/**
 * The two whole-program rules the compiler enforces, both non-fatal here: a
 * program that breaks one still punches a complete tape, and the machine only
 * complains when it comes to compile it.
 *
 * `END` is mandatory and must be last - the compiler stops translating there,
 * so a later line would never be reached, and reaching the end of the tape
 * without one is its "no end instruction". The line ceiling is
 * {@link MAX_LINES}.
 */
function reportProgramShape(
  records: readonly LineRecord[],
  errors: TokenizeError[],
): void {
  if (records.length === 0) return;
  const last = records[records.length - 1]!;

  records.forEach((record, i) => {
    if (record.statement === 'END' && i !== records.length - 1) {
      errors.push({
        line: record.editorLine,
        column: 0,
        message: 'END must be the last line of the program',
        fatal: false,
      });
    }
  });
  if (!records.some((r) => r.statement === 'END')) {
    errors.push({
      line: last.editorLine,
      column: 0,
      message: 'Program must end with an END statement',
      fatal: false,
    });
  }

  if (records.length > MAX_LINES) {
    errors.push({
      line: records[MAX_LINES]!.editorLine,
      column: 0,
      message: `Program is longer than ${MAX_LINES} lines`,
      fatal: false,
    });
  }
}
