// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { hb10pCharset, parseChar } from './charset';
import { hb10pKeywordsByLength, type Hb10pKeyword } from './keywords';
import { TXTTAB } from './addresses';
import { encodeLineRef, MAX_LINE, parseNumber } from './numbers';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from TXTTAB: for each line a
   * 2-byte absolute link to the next line, the 2-byte little-endian line
   * number, the tokenized body and a 0x00 terminator, ending with a 0x0000
   * null link.
   */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

/** Longest keyword (or alias) whose spelling matches the source at `pos`. */
function matchKeyword(source: string, pos: number): Hb10pKeyword | undefined {
  for (const kw of hb10pKeywordsByLength) {
    const slice = source.substr(pos, kw.word.length);
    // Letters fold to upper case so lower-case keywords tokenize too; the
    // symbolic operators and the ?/' synonyms are unaffected by toUpperCase.
    if (slice.toUpperCase() === kw.word) return kw;
  }
  return undefined;
}

/** Emit a token, high byte first for the 0xFF-prefixed functions. */
function pushToken(out: number[], token: number): void {
  if (token > 0xff) out.push((token >> 8) & 0xff);
  out.push(token & 0xff);
}

/**
 * Tokenize one line body (everything after the line number) into program
 * bytes.
 *
 * MSX BASIC matches keywords greedily at every position, spaces and all, which
 * is why a variable may not contain a reserved word: `TOTAL` is `TO` and
 * `TAL`, and the machine reads it that way whether or not the author meant it.
 * Quotes, REM (and its `'` synonym) and DATA suspend tokenizing; `:` separates
 * statements but is otherwise an ordinary character.
 *
 * The other half of the work is numbers. A constant is stored in the machine's
 * own typed form (see ./numbers), a line reference always in the two-byte
 * reference form, and a digit inside a name is neither - it is part of the
 * name, so it is copied as text.
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
  let remRest = false; // REM / ': copy the rest of the line verbatim
  let dataMode = false; // DATA: verbatim until an unquoted ':'
  let lineRefs = false; // numbers here are line references
  let prevAlnum = false; // the previous byte was part of a name

  const pushChar = (ch: string, col: number): void => {
    try {
      for (const b of hb10pCharset.toMachine(ch)) out.push(b);
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: col,
          message: `Character ${JSON.stringify(ch)} has no MSX equivalent`,
        });
        return;
      }
      throw e;
    }
  };

  // Emit one literal unit - a character, a graphic character or a `{0xNN}`
  // escape - inside a string / REM / DATA body. Returns the number of source
  // code units consumed; on an unmappable character it records an error and
  // advances one.
  const emitLiteral = (at: number): number => {
    try {
      const { codes, length } = parseChar(body, at);
      out.push(...codes);
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

  while (pos < body.length) {
    const col = bodyCol + pos;
    // One character may be an astral block graphic (a surrogate pair), so read
    // by code point and advance by its UTF-16 length.
    const ch = String.fromCodePoint(body.codePointAt(pos)!);

    if (remRest) {
      pos += emitLiteral(pos);
      continue;
    }
    if (inString) {
      if (ch === '"') {
        out.push(0x22);
        inString = false;
        pos += 1;
      } else {
        pos += emitLiteral(pos);
      }
      continue;
    }
    if (ch === '"') {
      out.push(0x22);
      inString = true;
      prevAlnum = false;
      lineRefs = false;
      pos += 1;
      continue;
    }
    if (dataMode) {
      if (ch === ':') {
        out.push(0x3a);
        dataMode = false;
        prevAlnum = false;
        pos += 1;
      } else {
        pos += emitLiteral(pos);
      }
      continue;
    }

    if (ch === ' ') {
      // A space neither ends a line-reference list nor joins a name.
      out.push(0x20);
      prevAlnum = false;
      pos += 1;
      continue;
    }
    if (ch === ':') {
      out.push(0x3a);
      lineRefs = false;
      prevAlnum = false;
      pos += 1;
      continue;
    }

    const startsNumber =
      !prevAlnum &&
      (/[0-9]/.test(ch) ||
        ch === '&' ||
        (ch === '.' && /[0-9]/.test(body[pos + 1] ?? '')));
    if (startsNumber) {
      if (lineRefs && /[0-9]/.test(ch)) {
        const digits = /^[0-9]+/.exec(body.slice(pos))![0];
        const line = parseInt(digits, 10);
        if (line > MAX_LINE) {
          errors.push({
            line: editorLine,
            column: col,
            endColumn: col + digits.length,
            message: `Line number ${line} out of range 0-${MAX_LINE}`,
          });
        }
        out.push(...encodeLineRef(Math.min(line, MAX_LINE)));
        pos += digits.length;
        continue;
      }
      const num = parseNumber(body, pos);
      if (num) {
        if (num.error) {
          errors.push({
            line: editorLine,
            column: col,
            endColumn: col + num.length,
            message: num.error,
          });
        }
        out.push(...num.bytes);
        pos += num.length;
        lineRefs = false;
        continue;
      }
    }

    const kw = matchKeyword(body, pos);
    if (kw) {
      // Two words carry an implicit leading ':' that LIST hides: ELSE is
      // `:ELSE` and `'` is `:REM'`. Emitting the genuine stored form keeps a
      // CSAVE from here byte-identical to one from the machine.
      if (kw.word === 'ELSE') out.push(0x3a, 0xa1);
      else if (kw.word === "'") out.push(0x3a, 0x8f, 0xe6);
      else pushToken(out, kw.token);
      pos += kw.word.length;
      lineRefs = kw.lineRefs === true;
      prevAlnum = false;
      if (kw.verbatimRest === 'line') remRest = true;
      else if (kw.verbatimRest === 'statement') dataMode = true;
      continue;
    }

    // A comma or a minus continues a line-reference list (`ON n GOTO 1,2` and
    // `LIST 10-20`); anything else ends it.
    if (ch !== ',' && ch !== '-') lineRefs = false;
    pushChar(ch, col);
    prevAlnum = /[A-Za-z0-9]/.test(ch);
    pos += ch.length;
  }

  return out;
}

interface LineRecord {
  lineNo: number;
  body: number[];
}

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
    if (lineNo > MAX_LINE) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} out of range 0-${MAX_LINE}`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      // Non-fatal: the line is still stored, so the image stays complete and
      // buildable (matching how the rest of the family treats ordering lint).
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} is not greater than the previous (${prevLineNo})`,
        fatal: false,
      });
    }
    prevLineNo = lineNo;

    // The spaces between the line number and the first token are not stored;
    // LIST re-inserts one. Spaces within the body are kept as typed.
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

  const prog: number[] = [];
  let addr = TXTTAB;
  for (const { lineNo, body } of records) {
    const next = addr + 2 + 2 + body.length + 1;
    prog.push(next & 0xff, (next >> 8) & 0xff);
    prog.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    prog.push(...body, 0x00);
    addr = next;
  }
  prog.push(0x00, 0x00); // null link terminates the program

  return { bytes: Uint8Array.from(prog), errors };
}
