// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { parseChar } from './charset';
import { sorcererKeywordsByLength, type SorcererKeyword } from './keywords';
import { MAX_LINE_NUMBER, PROGRAM_BASE } from './addresses';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from {@link PROGRAM_BASE}
   * (TXTTAB): for each line a 2-byte absolute link to the next line, the 2-byte
   * little-endian line number, the tokenized body and a 0x00 terminator, ending
   * with a 0x0000 null link. The interpreter's own NEW routine writes exactly
   * that null link at TXTTAB for an empty program, and its line-insert routine
   * writes the links as absolute addresses.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

const LOWER_A = 0x61;
const LOWER_Z = 0x7a;
const CASE_BIT = 0x20;

/** Longest keyword (or alias) whose spelling matches the source at `pos`. */
function matchKeyword(
  source: string,
  pos: number,
): SorcererKeyword | undefined {
  for (const kw of sorcererKeywordsByLength) {
    const slice = source.substr(pos, kw.word.length);
    // Letters fold to upper case so lower-case keywords tokenize too, exactly
    // as CRUNCH does before it walks the reserved-word table (it masks a-z with
    // 0x5F and writes the folded byte back into the input line); the symbolic
    // operators and the `?` synonym are unaffected by toUpperCase.
    if (slice.toUpperCase() === kw.word) return kw;
  }
  return undefined;
}

const IDENT_HEAD = /[A-Za-z]/;
const IDENT_TAIL = /[A-Za-z0-9]/;

/**
 * Tokenize one line body (everything after the line number) into program bytes.
 * Exidy Standard BASIC crunches the way every Microsoft BASIC does - greedily
 * and position-independently, so `FORI=1TO10` becomes FOR I =1 TO 10 - and we
 * match the longest keyword at each point. Spaces are stored verbatim and are
 * *not* skipped while matching: CRUNCH sends a 0x20 straight to the store path
 * without consulting the table, so `PR INT 1` keeps its `P` and `R` as plain
 * characters and then tokenizes the `INT`. Quotes, REM and DATA suspend
 * tokenizing. `:` separates statements but is otherwise an ordinary character,
 * so multi-statement lines need no special handling.
 */
function tokenizeBody(
  body: string,
  editorLine: number,
  bodyCol: number,
  errors: TokenizeError[],
): number[] {
  const out: number[] = [];
  let pos = 0;
  let inString = false;
  let remRest = false; // REM: copy the rest of the line verbatim
  let dataMode = false; // DATA: verbatim until an unquoted ':'
  let stmtStart = true; // at a statement opener (line start, ':', after THEN)
  let lineNoOk = false; // digits open a statement only right after THEN

  /**
   * Emit one editor unit - a character or a `{0xNN}` escape - and answer how
   * many source code units it consumed. On an unmappable character it records
   * an error and advances past the whole code point.
   *
   * `fold` is on outside literals, where the interpreter's line editor folds
   * a-z to A-Z before CRUNCH ever sees the line, so `10 abc=1` stores
   * `41 42 43`. The fold is exactly a plain lower-case letter: an escape spells
   * a byte outright, and folding one would stop a decoded program from
   * re-tokenizing to the bytes it came from.
   */
  const emit = (at: number, fold: boolean): number => {
    try {
      const { code, length } = parseChar(body, at);
      if (code === 0x00) {
        // 0x00 is the line terminator in the linked-line layout, so a program
        // line cannot contain one - storing it would truncate the line and
        // leave the rest of the body as garbage after the record. The real
        // machine has no way to type one either. Fatal, because the byte stream
        // it would produce is not a program.
        errors.push({
          line: editorLine,
          column: bodyCol + at,
          endColumn: bodyCol + at + length,
          message:
            'A {0x00} byte cannot appear in a program line — 0x00 ends the line',
        });
        return length;
      }
      const foldable =
        fold && length === 1 && code >= LOWER_A && code <= LOWER_Z;
      out.push(foldable ? code - CASE_BIT : code);
      return length;
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: bodyCol + at,
          message: e.message,
        });
        return String.fromCodePoint(body.codePointAt(at)!).length;
      }
      throw e;
    }
  };

  // A statement opener the interpreter would reject at RUN time with ?SN ERROR.
  // Recorded as a non-fatal lint error - the interpreter stores such lines
  // verbatim and only errors when they execute - so tokenization continues
  // unchanged and the image stays buildable.
  const flagStatement = (at: number, end: number, got: string): void => {
    errors.push({
      line: editorLine,
      column: bodyCol + at,
      endColumn: bodyCol + end,
      message: `Statement must start with a BASIC command or assignment (got '${got}')`,
      fatal: false,
    });
  };

  // True when the name at `at` opens an assignment: A=…, A$=…, A(3)=….
  const isAssignmentStart = (at: number): boolean => {
    let j = at;
    while (j < body.length && IDENT_TAIL.test(body[j]!)) j++;
    if (j < body.length && body[j] === '$') j++;
    while (body[j] === ' ') j++;
    return body[j] === '=' || body[j] === '(';
  };

  while (pos < body.length) {
    // Read by code point and advance by its UTF-16 length, so a pasted astral
    // character is reported once rather than as two lone surrogates.
    const ch = String.fromCodePoint(body.codePointAt(pos)!);

    if (remRest) {
      pos += emit(pos, false);
      continue;
    }
    if (inString) {
      if (ch === '"') {
        out.push(0x22);
        inString = false;
        pos += ch.length;
      } else {
        pos += emit(pos, false);
      }
      continue;
    }
    if (ch === '"') {
      if (stmtStart) {
        flagStatement(pos, pos + 1, '"');
        stmtStart = false;
      }
      out.push(0x22);
      inString = true;
      pos += ch.length;
      continue;
    }
    if (dataMode) {
      if (ch === ':') {
        out.push(0x3a);
        dataMode = false;
        stmtStart = true;
        lineNoOk = false;
        pos += ch.length;
      } else {
        pos += emit(pos, false);
      }
      continue;
    }

    // Spaces never end a statement opener; ':' begins a new statement.
    if (ch === ' ') {
      out.push(0x20);
      pos += ch.length;
      continue;
    }
    if (ch === ':') {
      out.push(0x3a);
      stmtStart = true;
      lineNoOk = false;
      pos += ch.length;
      continue;
    }

    const kw = matchKeyword(body, pos);
    if (kw) {
      if (stmtStart && kw.kind !== 'command') {
        flagStatement(pos, pos + kw.word.length, kw.word);
      }
      out.push(kw.token);
      pos += kw.word.length;
      // There is no ELSE in this interpreter, so THEN is the only keyword after
      // which a bare line number or a fresh statement may follow.
      stmtStart = kw.word === 'THEN';
      lineNoOk = stmtStart;
      if (kw.verbatimRest === 'line') remRest = true;
      else if (kw.verbatimRest === 'statement') dataMode = true;
      continue;
    }

    if (stmtStart) {
      if (/[0-9]/.test(ch)) {
        // A line number is a valid statement only right after THEN.
        if (!lineNoOk) flagStatement(pos, pos + 1, ch);
      } else if (IDENT_HEAD.test(ch)) {
        if (!isAssignmentStart(pos)) {
          let j = pos + 1;
          while (j < body.length && IDENT_TAIL.test(body[j]!)) j++;
          flagStatement(pos, j, body.slice(pos, j));
        }
      } else {
        flagStatement(pos, pos + 1, ch);
      }
      stmtStart = false;
    }

    pos += emit(pos, true);
  }

  return out;
}

interface LineRecord {
  lineNo: number;
  body: number[];
}

/**
 * Editor text -> Exidy Standard BASIC tokenized program bytes.
 *
 * Per project convention this collects {@link TokenizeError}s rather than
 * throwing, with 1-based lines and 0-based columns, and marks heuristic
 * statement-shape lint `fatal: false` so an imported-but-odd program still
 * builds a runnable image.
 */
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
    const lineNo = parseInt(m[2]!, 10);
    if (lineNo > MAX_LINE_NUMBER) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} out of range 0–${MAX_LINE_NUMBER}`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      // Non-fatal: the line is still stored, so the image stays complete and
      // buildable.
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} is not greater than the previous (${prevLineNo})`,
        fatal: false,
      });
    }
    prevLineNo = lineNo;

    // Skip the spaces between the line number and the first token; they are not
    // stored (LIST re-inserts one). Spaces within the body are kept.
    const afterNumber = m[1]!.length + m[2]!.length;
    const rest = m[3]!;
    const lead = rest.length - rest.trimStart().length;
    const body = rest.slice(lead);
    const bodyCol = afterNumber + lead;

    records.push({
      lineNo,
      body: tokenizeBody(body, editorLine, bodyCol, errors),
    });
  }

  // Assemble the linked-line layout with absolute next-line pointers from
  // TXTTAB, whose cold-start value is PROGRAM_BASE.
  const prog: number[] = [];
  let addr = PROGRAM_BASE;
  for (const { lineNo, body } of records) {
    const recLen = 2 + 2 + body.length + 1;
    const next = addr + recLen;
    prog.push(next & 0xff, (next >> 8) & 0xff);
    prog.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    prog.push(...body, 0x00);
    addr = next;
  }
  prog.push(0x00, 0x00); // null link terminates the program

  return { program: Uint8Array.from(prog), errors };
}
