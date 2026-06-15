import { CharsetError, type TokenizeError } from '../types';
import { parseChar, NEWLINE, QUOTE, QUOTE_IMAGE } from './charset';
import { keywordsByLength, statementKeywords } from './keywords';

export interface TokenizedProgram {
  /** Tokenized program area (concatenated lines), as stored from 0x4028. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

const IDENT_CHAR = /[A-Z0-9$]/;

/**
 * Tokenize plain-text ZX80 BASIC into the program-area byte layout. Each line
 * is `u16 BE line number` + tokenized body + `0x76` — note there is NO 2-byte
 * length field (that was a ZX81 addition), and numeric literals are stored as
 * their digit characters only (the ZX80 is integer-only and has no inline
 * floating-point value).
 */
export function tokenizeProgram(source: string): TokenizedProgram {
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  let prevLineNo = 0;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]!;
    const text = raw.trim();
    if (text === '') continue;
    const editorLine = li + 1;

    const m = /^(\d+)\s?/.exec(text);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[1]!, 10);
    if (lineNo < 1 || lineNo > 9999) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} out of range 1-9999`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} not greater than previous line ${prevLineNo}`,
      });
      continue;
    }

    const body = text.slice(m[0].length);
    const tokens = tokenizeBody(body, editorLine, m[0].length, errors);
    if (tokens === null) continue; // error already recorded

    prevLineNo = lineNo;
    out.push((lineNo >> 8) & 0xff, lineNo & 0xff);
    out.push(...tokens, NEWLINE);
  }

  return { bytes: Uint8Array.from(out), errors };
}

function tokenizeBody(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
): number[] | null {
  const out: number[] = [];
  const upper = body.toUpperCase();
  let i = 0;
  let firstWordChecked = false;
  let prevSignificant = ''; // last significant source char, for digit-vs-identifier

  const fail = (message: string, at: number): null => {
    errors.push({ line: editorLine, column: colOffset + at, message });
    return null;
  };

  while (i < body.length) {
    const ch = upper[i]!;

    if (ch === ' ' || ch === '\t') {
      prevSignificant = ' '; // whitespace breaks identifiers
      i++;
      continue;
    }

    // Strings
    if (ch === '"') {
      out.push(QUOTE);
      i++;
      let closed = false;
      while (i < body.length) {
        if (body[i] === '"') {
          if (body[i + 1] === '"') {
            out.push(QUOTE_IMAGE); // "" inside a string = quote-image char
            i += 2;
            continue;
          }
          out.push(QUOTE);
          i++;
          closed = true;
          break;
        }
        try {
          const { code, length } = parseChar(body, i);
          out.push(code);
          i += length;
        } catch (e) {
          if (e instanceof CharsetError) return fail(e.message, e.index);
          throw e;
        }
      }
      if (!closed) return fail('Unterminated string', body.length - 1);
      prevSignificant = '"';
      continue;
    }

    // Keywords and operators (longest match, word-boundary checked for the
    // alphabetic ones so the TO in ATOL or a variable named after a keyword
    // is not mis-tokenized).
    let matched = false;
    for (const kw of keywordsByLength) {
      if (!upper.startsWith(kw.word, i)) continue;
      if (/[A-Z]/.test(kw.word[0]!)) {
        const next = upper[i + kw.word.length];
        if (next !== undefined && IDENT_CHAR.test(next)) continue;
        if (/[A-Z0-9$]/.test(prevSignificant)) continue;
      }
      if (!firstWordChecked) {
        if (!statementKeywords.has(kw.word)) {
          return fail(
            `Line must start with a statement keyword (got ${kw.word})`,
            i,
          );
        }
        firstWordChecked = true;
      }
      out.push(kw.token);
      i += kw.word.length;
      prevSignificant = ' '; // keyword acts as a separator
      matched = true;

      // REM: everything after is literal text
      if (kw.word === 'REM') {
        let j = i;
        if (body[j] === ' ') j++;
        while (j < body.length) {
          try {
            const { code, length } = parseChar(body, j);
            out.push(code);
            j += length;
          } catch (e) {
            if (e instanceof CharsetError) return fail(e.message, e.index);
            throw e;
          }
        }
        i = body.length;
      }
      break;
    }
    if (matched) continue;

    if (!firstWordChecked) {
      return fail(
        'Line must start with a statement keyword (e.g. LET, PRINT, IF…)',
        i,
      );
    }

    // Numeric literal: a run of digits not glued onto an identifier. The ZX80
    // stores these as their plain digit characters (no marker), but we validate
    // the integer range here so out-of-range constants surface as an error.
    if (/[0-9]/.test(ch) && !/[A-Z0-9$]/.test(prevSignificant)) {
      const numText = /^\d+/.exec(upper.slice(i))![0];
      if (parseInt(numText, 10) > 32767) {
        return fail(`Number ${numText} out of range (ZX80 max 32767)`, i);
      }
      for (const c of numText) out.push(parseChar(c, 0).code);
      i += numText.length;
      prevSignificant = '0';
      continue;
    }

    // Anything else: single character via charset
    try {
      const { code, length } = parseChar(body, i);
      out.push(code);
      prevSignificant = upper.slice(i, i + length);
      i += length;
    } catch (e) {
      if (e instanceof CharsetError) return fail(e.message, e.index);
      throw e;
    }
  }

  if (!firstWordChecked) {
    return fail('Line has a number but no statement', 0);
  }
  return out;
}
