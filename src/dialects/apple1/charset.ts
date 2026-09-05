// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';

/**
 * The Apple I's character set: 64 glyphs, upper case only, and no pictures.
 *
 * The terminal section is a shift-register display fed by a Signetics 2513
 * character generator, and the 2513 holds exactly the 64 ASCII codes
 * `$20`-`$5F` - space, punctuation, the digits and `A`-`Z`. Everything on this
 * machine carries them with **bit 7 set**, so the code in memory for `A` is
 * `$C1` and for a space `$A0`; that is what a program's variable names and
 * string literals are stored as, and what the display hardware is handed.
 *
 * There are no block graphics, no inverse-video range and no lower case at all:
 * the keyboard could not type it and the character generator could not draw it.
 * The interpreter agrees - typing `10 print a` at the `>` prompt answers
 * `*** SYNTAX ERR` - so lower case in the editor **folds to upper case** here
 * rather than being preserved inside string literals the way it is on a machine
 * with a terminal of its own. That fold is the one place this mapping is not a
 * bijection on the text side; it stays one on the byte side, which is what
 * matters for a round trip.
 *
 * Codes outside `$A0`-`$DF` have no glyph and are written as a `{0xNN}`
 * raw-byte escape, the braced style the Altair, TRS-80 and BBC charsets use, so
 * the mapping is total and injective over all 256 bytes.
 */

/** Lowest code with a glyph: space, `$20` with bit 7 set. */
export const GLYPH_BASE = 0xa0;
/** Highest code with a glyph: `_`, `$5F` with bit 7 set. */
export const GLYPH_TOP = 0xdf;

/** The `{0xNN}` raw-byte escape for a code the 2513 cannot draw. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * The plain editor character for a code that has a glyph, or undefined. Strips
 * bit 7, since the editor writes ASCII and the machine stores it set.
 */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  return c >= GLYPH_BASE && c <= GLYPH_TOP
    ? String.fromCharCode(c & 0x7f)
    : undefined;
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const m = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  return m ? parseInt(m[1]!, 16) : null;
}

/**
 * Parse one editor unit - a character or a `{0xNN}` escape - starting at index
 * `i`, returning the machine byte it encodes and how many source characters it
 * consumed. Mirrors the signature the other dialects' charsets expose, since the
 * shared charset probes drive them generically.
 *
 * A `{...}` that is not a well-formed `{0xNN}` escape is literal text - but note
 * that the Apple I has no `{` or `}` glyph, so an escape is the *only* way a
 * brace reaches a program, and a malformed one is an error rather than a
 * fallback to a literal brace.
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
  }
  // Read a whole code point, so an astral character reports one error not two.
  const cp = String.fromCodePoint(text.codePointAt(i)!);
  const folded =
    cp.length === 1 && cp >= 'a' && cp <= 'z' ? cp.toUpperCase() : cp;
  const code = folded.codePointAt(0)!;
  if (folded.length === 1 && code >= 0x20 && code <= 0x5f) {
    return { code: code | 0x80, length: 1 };
  }
  throw new CharsetError(
    `Character ${JSON.stringify(cp)} has no Apple I equivalent`,
    i,
  );
}

/**
 * Decode one machine byte to editor text, never reading at or past `end`. Every
 * byte becomes something {@link parseChar} maps back to the same byte, so
 * decode -> encode is byte-exact. Always advances one byte (the escapes carry no
 * operands).
 */
export function decodeSpan(
  codes: ArrayLike<number>,
  i: number,
  _end: number,
): { text: string; length: number } {
  const b = codes[i]! & 0xff;
  // A decoded `{` never needs escaping the way it does on the machines with a
  // full ASCII set: `{` and `}` are outside the 64-glyph range, so nothing this
  // produces can be misread as the opening of a `{0xNN}` escape.
  const plain = plainChar(b);
  return plain === undefined
    ? { text: rawByte(b), length: 1 }
    : { text: plain, length: 1 };
}

export const apple1Charset: CharsetMapping = {
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
    // round-trip path, which uses toUnicode/decodeSpan). A code the character
    // generator cannot draw renders as a space.
    return plainChar(code) ?? ' ';
  },
};
