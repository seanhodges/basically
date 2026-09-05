// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';

/**
 * The PMD 85's character set, read out of the Monitor 2 character generator
 * this project ships in `public/roms/pmd85.rom`.
 *
 * The machine is Czechoslovak, so the obvious expectation is a set with háčeks
 * and čárkas in it. The ROM says otherwise: the character generator is **plain
 * 7-bit ASCII**, 96 glyphs of 6x8 pixels, and it holds no accented letter at
 * all. It is stored in two runs rather than one - 0x20-0x5F at 0x8600 and
 * 0x60-0x7F at 0x88C0, with the Monitor's own code in between - which the
 * screen driver stitches back together through a table of eight 32-code group
 * bases. Every glyph below 0x7F was compared against its ASCII shape; they
 * match, including the lower case at 0x60-0x7A that a machine of this vintage
 * might easily not have had.
 *
 * So the mapping is:
 *
 *  - 0x20-0x7E is printable ASCII, straight through both ways. Lower case is
 *    **preserved**: the screen has real lower-case glyphs, and BASIC-G's crunch
 *    routine stores what it is given without folding (which is also why the
 *    tokenizer folds a lower-case keyword itself - see `tokenizer.ts`).
 *  - 0x7F is the one glyph outside ASCII: a solid cell, filling six columns of
 *    all but the last of the eight pixel rows. It is spelled `█` (U+2588 FULL
 *    BLOCK), the same character the Sinclair and Amstrad charsets use for their
 *    own solid cell.
 *  - Everything else has no glyph. Codes 0x00-0x1F are control codes, of which
 *    the Monitor's screen driver acts on four - 0x08 backspace, 0x0A ignored,
 *    0x0D newline and 0x1C clear screen (what `GCLEAR` prints) - and ignores
 *    the rest. Codes 0x80-0xFF fall in the group-base table's unmapped groups
 *    and draw the Monitor's placeholder glyph, but a string can still hold
 *    them, so `ASC(CHR$(255))` really is 255. All of these are written as a
 *    `{0xNN}` raw-byte escape, the braced style the Altair and TRS-80 charsets
 *    use.
 *
 * There are no block graphics here at all - not "none established yet", but
 * none in the hardware: a font of 96 ASCII glyphs plus one solid cell has
 * nowhere to put a mosaic set. Graphics on this machine are drawn, not typed
 * (`PLOT`/`MOVE`/`FILL` and the `BPLOT` byte-blitter), which is why the
 * character set carries no pictures.
 *
 * The mapping is **total and injective**: every byte 0x00-0xFF has exactly one
 * text form, and that form encodes back to the same byte.
 */

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** The solid cell at 0x7F, the set's one non-ASCII glyph. */
export const SOLID_BLOCK_CODE = 0x7f;
const SOLID_BLOCK = '█';

/** The `{0xNN}` raw-byte escape for a code with no printable form. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * The plain editor character for a code that has a glyph in the ROM font -
 * ASCII 0x20-0x7E plus the solid cell at 0x7F. Everything else returns
 * undefined and is written as a {@link rawByte} escape instead.
 */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  if (c === SOLID_BLOCK_CODE) return SOLID_BLOCK;
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
 * well-formed `{0xNN}` escape is literal text: the PMD 85 has real `{`/`}`
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
  if (cp === SOLID_BLOCK) return { code: SOLID_BLOCK_CODE, length: cp.length };
  if (cp.length === 1 && code >= 0x20 && code <= 0x7e) {
    return { code, length: 1 };
  }
  throw new CharsetError(
    `Character ${JSON.stringify(cp)} has no PMD 85 equivalent`,
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

export const pmd85Charset: CharsetMapping = {
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
    // round-trip path, which uses toUnicode/decodeSpan). A code with no glyph
    // in the ROM font renders as a space.
    return plainChar(code) ?? ' ';
  },
};
