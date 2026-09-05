// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { altair8800Charset, parseChar } from './charset';
import { altair8800KeywordsByLength, type Altair8800Keyword } from './keywords';
import { MAX_LINE_NUMBER, PROGRAM_BASE } from './addresses';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from {@link PROGRAM_BASE}
   * (TXTTAB): for each line a 2-byte absolute link to the next line, the 2-byte
   * little-endian line number, the tokenized body and a 0x00 terminator, ending
   * with a 0x0000 null link. The same layout as the C64's and the TRS-80's
   * (see their tokenizers), based at 0x1939 with the Altair 8K token table.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/** Altair code for one editor character, or undefined if unmappable. */
function toCode(ch: string): number | undefined {
  try {
    return altair8800Charset.toMachine(ch)[0];
  } catch (e) {
    if (e instanceof CharsetError) return undefined;
    throw e;
  }
}

/** Longest keyword (or alias) whose spelling matches the source at `pos`. */
function matchKeyword(
  source: string,
  pos: number,
): Altair8800Keyword | undefined {
  for (const kw of altair8800KeywordsByLength) {
    const slice = source.substr(pos, kw.word.length);
    // Letters fold to upper case so lower-case keywords tokenize too, exactly
    // as the interpreter's own line editor does; the symbolic operators and the
    // `?` synonym are unaffected by toUpperCase.
    if (slice.toUpperCase() === kw.word) return kw;
  }
  return undefined;
}

const IDENT_HEAD = /[A-Za-z]/;
const IDENT_TAIL = /[A-Za-z0-9]/;

/**
 * Tokenize one line body (everything after the line number) into program bytes.
 * 8K BASIC, like every Microsoft BASIC, tokenizes greedily and
 * position-independently - `FORI=1TO10` becomes FOR I =1 TO 10 - so we match the
 * longest keyword at each point. Spaces are stored verbatim and are *not*
 * skipped while matching, which is why `PR INT 1` keeps its `P`,`R` and then
 * tokenizes the `INT` (checked at the console: it stores `50 52 20 AF 20 31`).
 * Quotes, REM and DATA suspend tokenizing. `:` separates statements but is
 * otherwise an ordinary character, so multi-statement lines need no special
 * handling.
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

  const pushChar = (ch: string, col: number): void => {
    // Outside a literal the interpreter folds a-z to A-Z before it crunches, so
    // `10 abc=1` stores `41 42 43` and `def$` becomes the DEF token plus `$`.
    // The fold is exactly a-z: 0x60 and 0x7B-0x7E are stored as typed, and
    // inside a string / REM / DATA nothing is folded at all (which is why this
    // lives here rather than in emitLiteral).
    const code = toCode(ch >= 'a' && ch <= 'z' ? ch.toUpperCase() : ch);
    if (code === undefined) {
      errors.push({
        line: editorLine,
        column: col,
        message: `Character ${JSON.stringify(ch)} has no Altair equivalent`,
      });
      return;
    }
    out.push(code);
  };

  // Emit one literal unit - a character or a `{0xNN}` escape - inside a string /
  // REM / DATA body. Returns the number of source code units consumed; on an
  // unmappable character it records an error and advances one.
  const emitLiteral = (at: number): number => {
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
      out.push(code);
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
  // Recorded as a non-fatal lint error - 8K BASIC stores such lines verbatim and
  // only errors when they execute (checked at the console: `10 XYZZY` is stored
  // as five plain characters and answers `?SN ERROR IN 10` on RUN) - so
  // tokenization continues unchanged and the image stays buildable.
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
    const col = bodyCol + pos;
    // Read by code point and advance by its UTF-16 length, so a pasted astral
    // character is reported once rather than as two lone surrogates.
    const ch = String.fromCodePoint(body.codePointAt(pos)!);

    if (remRest) {
      pos += emitLiteral(pos);
      continue;
    }
    if (inString) {
      if (ch === '"') {
        out.push(0x22);
        inString = false;
        pos += ch.length;
      } else {
        pos += emitLiteral(pos);
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
        pos += emitLiteral(pos);
      }
      continue;
    }

    // Spaces never end a statement opener; ':' begins a new statement.
    if (ch === ' ') {
      pushChar(ch, col);
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
      // 8K BASIC has no ELSE, so THEN is the only keyword after which a bare
      // line number or a fresh statement may follow.
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

    pushChar(ch, col);
    pos += ch.length;
  }

  return out;
}

interface LineRecord {
  lineNo: number;
  body: number[];
}

/**
 * Editor text -> Altair 8K BASIC tokenized program bytes.
 *
 * Per project convention this collects {@link TokenizeError}s rather than
 * throwing, with 1-based lines and 0-based columns, and marks heuristic
 * statement-shape lint `fatal: false` so an imported-but-odd program still
 * builds a runnable image.
 *
 * One interpreter limit is deliberately *not* enforced: the console line buffer
 * holds 72 characters (`CONSOLE_LINE_BYTES`), so a longer line cannot be typed
 * in on real hardware. That is an editor limit rather than a storage one - a
 * longer line injected straight into the program text lists and runs normally -
 * and the image here is injected, never typed.
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
      // buildable (matching the C64's and TRS-80's treatment of ordering lint).
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
  // TXTTAB. The Altair's base is not a ROM-defined constant but wherever the
  // RAM-resident interpreter left off - see PROGRAM_BASE.
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
