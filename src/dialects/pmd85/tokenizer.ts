// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { lowerCaseKeywordMessage } from '../../editor/keywordCase';
import { pmd85Charset, parseChar } from './charset';
import { pmd85KeywordsByLength, type Pmd85Keyword } from './keywords';
import { MAX_LINE_NUMBER, PROGRAM_BASE } from './addresses';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from {@link PROGRAM_BASE}
   * (TXTTAB): for each line a 2-byte absolute link to the next line, the 2-byte
   * little-endian line number, the tokenized body and a 0x00 terminator, ending
   * with a 0x0000 null link.
   *
   * That is the Microsoft layout the C64, TRS-80 and Altair also use, and it is
   * read off this interpreter rather than assumed from the family: its LIST
   * loop takes the first two bytes of a record as the link and stops on a zero
   * one, its line-insert writes the line number into the third and fourth
   * bytes, and its relink pass walks to each line's 0x00 terminator and stores
   * the address just past it into the previous line's first two bytes.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/** PMD 85 code for one editor character, or undefined if unmappable. */
function toCode(ch: string): number | undefined {
  try {
    return pmd85Charset.toMachine(ch)[0];
  } catch (e) {
    if (e instanceof CharsetError) return undefined;
    throw e;
  }
}

/** How a keyword matched at a source position: which one, and how much it ate. */
interface KeywordMatch {
  keyword: Pmd85Keyword;
  length: number;
}

/**
 * GOTO is the one keyword the crunch routine matches across spaces: while
 * comparing its letters it calls CHRGET, which skips them. `GO TO`, `G O T O`
 * and `G   OT O` all store the single 0x88 token; no other keyword does this.
 */
function matchGotoAcrossSpaces(
  source: string,
  pos: number,
): number | undefined {
  const word = 'GOTO';
  let i = pos;
  for (let w = 0; w < word.length; w++) {
    // Only the letters after the first may have spaces in front of them.
    while (w > 0 && source[i] === ' ') i++;
    if (source[i]?.toUpperCase() !== word[w]) return undefined;
    i++;
  }
  return i - pos;
}

/** Longest keyword (or alias) whose spelling matches the source at `pos`. */
function matchKeyword(source: string, pos: number): KeywordMatch | undefined {
  for (const keyword of pmd85KeywordsByLength) {
    if (keyword.word === 'GOTO') {
      const length = matchGotoAcrossSpaces(source, pos);
      if (length !== undefined) return { keyword, length };
      continue;
    }
    const slice = source.substr(pos, keyword.word.length);
    // Letters fold to upper case so a lower-case keyword tokenizes too. The
    // ROM does *not* do this - its crunch compares raw bytes against an
    // upper-case table, so a lower-case `print` really is stored as five
    // characters and fails at RUN - but a lower-case listing is what a reader
    // pastes in, and folding it is what every other Microsoft-family dialect
    // here does. The symbolic operators and the `?` synonym are unaffected by
    // toUpperCase.
    if (slice.toUpperCase() === keyword.word)
      return { keyword, length: keyword.word.length };
  }
  return undefined;
}

const IDENT_HEAD = /[A-Za-z]/;
const IDENT_TAIL = /[A-Za-z0-9]/;
/**
 * Digits of a `'` hexadecimal literal. Upper case only, and deliberately so:
 * the Monitor's ASCII-to-nibble converter the crunch calls accepts 0-9 and A-F
 * and rejects a-f, so a lower-case digit ends the literal on the real machine
 * too.
 */
const HEX_DIGIT = /[0-9A-F]/;

/**
 * Tokenize one line body (everything after the line number) into program bytes.
 *
 * BASIC-G crunches the way every Microsoft BASIC does: it matches a reserved
 * word wherever one starts, without needing a delimiter, so `FORI=1TO10` stores
 * FOR, TO and the rest as tokens. Spaces are stored verbatim and are *not*
 * skipped while matching (`PR INT 1` keeps its `P` and `R` and then tokenizes
 * the `INT`), with GOTO the single exception above. Quotes, REM and DATA
 * suspend tokenizing, and so does an apostrophe, which introduces a hexadecimal
 * literal: the crunch copies `'` and the hex digits after it through untouched,
 * which is what stops `'ABS` becoming an ABS token.
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
    const code = toCode(ch);
    if (code === undefined) {
      errors.push({
        line: editorLine,
        column: col,
        message: `Character ${JSON.stringify(ch)} has no PMD 85 equivalent`,
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
        // 0x00 terminates a line record, so a program line cannot contain one:
        // storing it would end the line early and leave the rest of the body as
        // garbage between records. Fatal, because those bytes are not a program.
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

  // A statement opener the interpreter would reject at RUN time with
  // `Syntax err`. Recorded as a non-fatal lint error - the ROM stores such a
  // line and only complains when it executes - so tokenization continues
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

    // A `'` hexadecimal literal: the apostrophe and the hex digits behind it
    // are copied through without any keyword matching.
    if (ch === "'") {
      if (stmtStart) {
        flagStatement(pos, pos + 1, "'");
        stmtStart = false;
      }
      out.push(0x27);
      pos += 1;
      while (pos < body.length && HEX_DIGIT.test(body[pos]!)) {
        pushChar(body[pos]!, bodyCol + pos);
        pos += 1;
      }
      continue;
    }

    const match = matchKeyword(body, pos);
    if (match) {
      const { keyword, length } = match;
      const typed = body.slice(pos, pos + length);
      // Read as the keyword above, and reported here: the ROM's crunch compares
      // raw bytes against an upper-case table, so on the real machine this
      // spelling is stored as characters and fails at RUN. Being lenient about
      // what can be opened is not a claim the machine will run it. Non-fatal,
      // and the bytes emitted are unchanged.
      if (typed !== keyword.word && typed.toUpperCase() === keyword.word) {
        errors.push({
          line: editorLine,
          column: bodyCol + pos,
          endColumn: bodyCol + pos + length,
          message: lowerCaseKeywordMessage(typed, 'PMD 85'),
          fatal: false,
        });
      }
      if (stmtStart && keyword.kind !== 'command') {
        flagStatement(pos, pos + length, keyword.word);
      }
      out.push(keyword.token);
      pos += length;
      // BASIC-G has no ELSE, so THEN is the only keyword after which a bare
      // line number or a fresh statement may follow.
      stmtStart = keyword.word === 'THEN';
      lineNoOk = stmtStart;
      if (keyword.verbatimRest === 'line') remRest = true;
      else if (keyword.verbatimRest === 'statement') dataMode = true;
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
 * Editor text -> BASIC-G tokenized program bytes.
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
      // buildable (matching how the other Microsoft-family dialects here treat
      // ordering lint).
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
  // TXTTAB, which is where the interpreter's own relink pass would put them.
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
