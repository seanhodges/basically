import { CharsetError, type TokenizeError } from '../types';
import { parseBinaryDirective } from '../binaryDirective';
import {
  parseChar,
  NEWLINE,
  NUMBER_MARKER,
  QUOTE,
  QUOTE_IMAGE,
} from './charset';
import { keywordsByLength, statementKeywords } from './keywords';
import { encodeZxFloat, parseFloatOverride } from './zxfloat';

export interface TokenizedProgram {
  /** Tokenized program area (concatenated lines), as stored from 0x407D. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

const IDENT_CHAR = /[A-Z0-9$]/;

/**
 * Tokenize plain-text ZX81 BASIC into the program-area byte layout:
 * per line - u16 BE line number, u16 LE length (of body + NEWLINE),
 * tokenized body, 0x76.
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
    // Columns are offsets into the *physical* editor line (the linter adds them
    // to the line start), but everything below is measured against the trimmed
    // text - so every column owes the indent width. Trailing space costs
    // nothing, only the leading run matters.
    const lead = raw.length - raw.trimStart().length;

    const directive = parseBinaryDirective(text);
    if (directive) {
      if ('error' in directive) {
        errors.push({
          line: editorLine,
          column: lead + directive.column,
          message: directive.error,
        });
        continue;
      }
      const rec = directive.record;
      // A raw program-area line record: lineNo BE, len LE, body, terminator.
      // The len field must describe the payload (the detokenizer slices by it,
      // so imported records always satisfy this; a mismatch means a hand-edited
      // or corrupt payload). The terminator byte is deliberately not checked -
      // terminator-less records from damaged files must still round-trip.
      if (rec.length < 4) {
        errors.push({
          line: editorLine,
          column: lead,
          message:
            '#BIN record too short (needs line number and length fields)',
        });
        continue;
      }
      const recLen = rec[2]! | (rec[3]! << 8);
      if (recLen !== rec.length - 4) {
        errors.push({
          line: editorLine,
          column: lead,
          message:
            `#BIN record length field (${recLen}) does not match ` +
            `payload size (${rec.length - 4})`,
        });
        continue;
      }
      out.push(...rec);
      // Binary lines are exempt from the 1-9999/ascending checks (real files
      // use line 0 and duplicates), but later text lines must still climb
      // above them - the ROM's line lookup assumes ascending order.
      prevLineNo = Math.max(prevLineNo, (rec[0]! << 8) | rec[1]!);
      continue;
    }

    const m = /^(\d+)\s?/.exec(text);
    if (!m) {
      errors.push({
        line: editorLine,
        column: lead,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[1]!, 10);
    if (lineNo < 1 || lineNo > 9999) {
      errors.push({
        line: editorLine,
        column: lead,
        message: `Line number ${lineNo} out of range 1-9999`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      // Decision: out-of-order lines are kept as an error, not
      // silently sorted. Real hardware inserts each typed line in order, but a
      // pasted listing that is out of order is far more often a mistake than an
      // intent to reorder; sorting would hide it. Imports never hit this - the
      // detokenizer always emits ascending lines.
      errors.push({
        line: editorLine,
        column: lead,
        message: `Line number ${lineNo} not greater than previous line ${prevLineNo}`,
      });
      continue;
    }

    const body = text.slice(m[0].length);
    const tokens = tokenizeBody(body, editorLine, lead + m[0].length, errors);
    if (tokens === null) continue; // error already recorded

    prevLineNo = lineNo;
    out.push((lineNo >> 8) & 0xff, lineNo & 0xff);
    const len = tokens.length + 1; // body + NEWLINE terminator
    out.push(len & 0xff, (len >> 8) & 0xff);
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
  let prevSignificant = ''; // last significant source char, for literal-vs-identifier digits

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

    // Keywords (longest match, word-boundary checked for alphabetic ones)
    let matched = false;
    for (const kw of keywordsByLength) {
      if (!upper.startsWith(kw.word, i)) continue;
      if (/[A-Z]/.test(kw.word[0]!)) {
        // Word keyword: must not be glued into a longer identifier,
        // unless it carries its own $ suffix (STR$, CHR$, INKEY$).
        const next = upper[i + kw.word.length];
        if (
          !kw.word.endsWith('$') &&
          next !== undefined &&
          IDENT_CHAR.test(next)
        )
          continue;
        // ...and must not continue a preceding identifier (e.g. the TO in ATOL).
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

    // A `\{=...}` float override with no printed digits before it (rare - a
    // stored marker whose digits were absent). The common digits+override case
    // is handled by the numeric-literal path below.
    if (ch === '\\' && body[i + 1] === '{' && body[i + 2] === '=') {
      const override = parseFloatOverride(body, i);
      if (!override) return fail('Invalid number override', i);
      out.push(NUMBER_MARKER, ...override.bytes);
      i = override.end;
      prevSignificant = '0';
      continue;
    }

    // Numeric literal: digits not continuing an identifier get the inline
    // 0x7E + 5-byte float representation the ROM stores after parsing.
    if (/[0-9.]/.test(ch) && !/[A-Z0-9$]/.test(prevSignificant)) {
      const numMatch = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/.exec(upper.slice(i));
      if (numMatch && numMatch[0] !== '.') {
        const numText = numMatch[0];
        const value = parseFloat(numText);
        for (const c of numText) {
          try {
            out.push(parseChar(c, 0).code);
          } catch {
            return fail(`Bad numeric literal "${numText}"`, i);
          }
        }
        i += numText.length;
        // An explicit `\{=...}` override stores the ROM's authoritative float
        // (differs from the digits for protection tricks); otherwise encode the
        // digits as the ROM would.
        const override = parseFloatOverride(body, i);
        if (override) {
          out.push(NUMBER_MARKER, ...override.bytes);
          i = override.end;
        } else {
          out.push(NUMBER_MARKER);
          try {
            out.push(...encodeZxFloat(value));
          } catch {
            return fail(`Number out of range: ${numText}`, i);
          }
        }
        prevSignificant = '0'; // a digit, but identifier check uses prev char only for glued digits
        continue;
      }
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
