// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';

/**
 * The Altair 8800's character set - the simplest in the project, because the
 * machine has none of its own.
 *
 * There is no video hardware and no character generator: BASIC writes bytes to
 * a serial port and whatever terminal is plugged in decides what they look
 * like. So the mapping is plain 7-bit ASCII, with no block graphics, no
 * inverse-video range and no PETSCII-style reordering - the one dialect here
 * whose charset carries no pictures at all.
 *
 *  - 0x20-0x7E is printable ASCII, straight through both ways. Lower case is
 *    **preserved**: the interpreter's line editor folds what you type to upper
 *    case outside quotes, but inside a string literal or after REM it stores the
 *    bytes as typed (checked at the console - `10 PRINT "hello"` stores
 *    `68 65 6C 6C 6F` and LISTs back in lower case).
 *  - 0x00-0x1F and 0x7F are control codes with no printable form, and 0x80-0xFF
 *    is a range the console never displays (the 2SIO driver masks output with
 *    `ANI 7F`) but a string can still hold - `ASC(CHR$(255))` really is 255. All
 *    of them are written as a `{0xNN}` raw-byte escape, the braced style the
 *    TRS-80 and BBC charsets use.
 *
 * The mapping is **total and injective**, which is what
 * `src/dialects/charsetProbes.test.ts` will also enforce once the dialect is
 * registered and gains a probe entry: every byte 0x00-0xFF has exactly one text
 * form, and that form encodes back to the same byte.
 *
 * Because nothing outside ASCII is ever emitted, this dialect adds no
 * codepoints to the bundled font subsets and `src/dialects/fontCoverage.test.ts`
 * needs no new glyphs for it.
 */

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** The `{0xNN}` raw-byte escape for a code with no printable form. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * The plain editor character for a code that has a natural printable form -
 * ASCII 0x20-0x7E. Everything else returns undefined and is written as a
 * {@link rawByte} escape instead.
 */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  return c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : undefined;
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const m = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  return m ? parseInt(m[1]!, 16) : null;
}

/**
 * Parse one editor unit - a character or a `{0xNN}` escape - starting at index
 * `i`, returning the machine byte it encodes and how many source characters it
 * consumed. Mirrors the signature the other dialects' charsets expose, since
 * `charsetProbes.ts` drives them generically. A `{...}` that is not a
 * well-formed `{0xNN}` escape is literal text: the Altair has real `{`/`}`
 * characters at 0x7B/0x7D.
 */
export function parseChar(
  text: string,
  i: number,
): { code: number; length: number } {
  if (text[i] === '{') {
    const close = text.indexOf('}', i + 1);
    if (close !== -1) {
      const code = parseEscape(text.slice(i + 1, close));
      if (code !== null) return { code, length: close + 1 - i };
    }
    // Not an escape: fall through to a literal '{' (0x7B).
  }
  // Read a whole code point, so an astral character reports one error not two.
  const cp = String.fromCodePoint(text.codePointAt(i)!);
  const code = cp.codePointAt(0)!;
  if (cp.length === 1 && code >= 0x20 && code <= 0x7e) {
    return { code, length: 1 };
  }
  throw new CharsetError(
    `Character ${JSON.stringify(cp)} has no Altair equivalent`,
    i,
  );
}

/**
 * Decode one machine byte in a literal context to editor text, never reading at
 * or past `end`. Every byte becomes something {@link parseChar} maps back to the
 * same byte, so decode -> tokenize is byte-exact: printable ASCII passes
 * through, a literal `{` that would otherwise read as an escape is itself
 * escaped, and every other byte becomes `{0xNN}`. Always advances one byte (the
 * escapes carry no operands).
 */
export function decodeSpan(
  codes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = codes[i]! & 0xff;
  if (b === OPEN_BRACE) {
    // Escape a literal '{' only when the bytes ahead happen to read as a
    // well-formed escape (otherwise the text would round-trip to a different
    // byte).
    for (let j = i + 1; j < end; j++) {
      const c = codes[j]!;
      if (c === CLOSE_BRACE) {
        let content = '';
        for (let k = i + 1; k < j; k++)
          content += String.fromCharCode(codes[k]!);
        if (parseEscape(content) !== null)
          return { text: rawByte(b), length: 1 };
        break;
      }
      if (c === OPEN_BRACE || c < 0x20 || c > 0x7e) break;
    }
    return { text: '{', length: 1 };
  }
  const plain = plainChar(b);
  return plain !== undefined
    ? { text: plain, length: 1 }
    : { text: rawByte(b), length: 1 };
}

export const altair8800Charset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < text.length) {
      const { code, length } = parseChar(text, i);
      out.push(code);
      i += length;
    }
    return Uint8Array.from(out);
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    let i = 0;
    while (i < codes.length) {
      const { text: t, length } = decodeSpan(codes, i, codes.length);
      text += t;
      i += length;
    }
    return text;
  },

  glyph(code: number): string {
    // A single-character display form for debug/status readouts (not the
    // round-trip path, which uses toUnicode/decodeSpan). Anything the terminal
    // could not print renders as a space.
    return plainChar(code) ?? ' ';
  },
};
