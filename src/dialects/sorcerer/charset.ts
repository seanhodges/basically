// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';
import { STANDARD_GRAPHICS_COUNT, STANDARD_GRAPHICS_FIRST } from './addresses';

/**
 * The Exidy Sorcerer's character set, which is four bands rather than the two a
 * Sinclair or a Commodore reader expects, and only one of them is a font in the
 * usual sense:
 *
 *  - **0x00-0x1F, fixed symbols in the generator ROM.** Outlined boxes and
 *    circles with various infills, short diagonals, a pair of arrows and a bare
 *    question mark. They are pictures, not mosaic cells, and nothing in Unicode
 *    draws them, so each is written as a `{0xNN}` raw-byte escape rather than
 *    approximated by a character that means something else.
 *  - **0x20-0x7E, ASCII**, upper *and* lower case - which was unusual in 1978 -
 *    straight through both ways. 0x7F is a chequer the Monitor draws the cursor
 *    with; it has no text form of its own and is escaped.
 *  - **0x80-0xBF, the standard graphics set**, mapped below. This is where the
 *    machine keeps its line-drawing family, its eighth-block rules, its
 *    quadrants, halves, triangles, dithers and four card suits.
 *  - **0xC0-0xFF, the user-definable set.** The Monitor leaves the generator RAM
 *    from here as it found it, so these codes have *no* shape until a program
 *    pokes one in. There is nothing to map them to, and they are escaped.
 *
 * The shapes behind the middle two bands are read off bitmaps, not off a
 * description. Codes 0x00-0x7F come from the character generator ROM; codes
 * 0x80-0xBF are bitmaps the Monitor copies into generator *RAM* at boot (see
 * `STANDARD_GRAPHICS_BITMAPS` in `addresses.ts`). That copy is the whole reason
 * the "standard" set is standard only by convention: a running program may
 * overwrite any of it, and the mapping here describes what a machine that has
 * just booted draws.
 *
 * The mapping is **total and injective**: every byte 0x00-0xFF has exactly one
 * text form, and that form encodes back to the same byte.
 */

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/**
 * The standard graphics set, code by code.
 *
 * Each entry is the closest *exact* character - a shape Unicode draws the same
 * way the generator bitmap does - taken from Box Drawing, Block Elements,
 * Geometric Shapes and then Symbols for Legacy Computing, whose eighth-block
 * ladders are the only place several of these rules exist at all. The two
 * one-pixel rules through the middle of the cell (0x97 and 0xA2) are written as
 * the box-drawing `─` and `│` rather than as the fifth eighth-block of each
 * ladder, because they are the plain segments of the junction family below them
 * (0xAD, 0xB2, 0xB4, 0xB9, 0xBB-0xBF) and are drawn on exactly the row and
 * column those junctions use.
 *
 * 0x8D is the one shape with no entry: it is a small pictorial glyph with no
 * Unicode equivalent, so it takes a raw-byte escape like the fixed symbols do.
 */
const GRAPHICS: Record<number, string> = {
  0x80: '▏', // one-pixel rule down column 0 (left one eighth block)
  0x81: '\u{1FB70}', // ... column 1
  0x82: '\u{1FB71}', // ... column 2
  0x83: '\u{1FB72}', // ... column 3
  0x84: '●', // filled disc
  0x85: '\u{1FB74}', // one-pixel rule down column 5
  0x86: '\u{1FB75}', // ... column 6
  0x87: '▕', // ... column 7 (right one eighth block)
  0x88: '○', // hollow disc
  0x89: '▔', // one-pixel rule across row 0 (upper one eighth block)
  0x8a: '\u{1FB76}', // ... row 1
  0x8b: '\u{1FB77}', // ... row 2
  0x8c: '\u{1FB78}', // ... row 3
  // 0x8D has no entry - see the note above.
  0x8e: '╳', // both diagonals
  0x8f: '╭', // arc: down and right
  0x90: '╮', // arc: down and left
  0x91: '\u{1FB7D}', // row 0 plus column 0
  0x92: '\u{1FB7E}', // row 0 plus column 7
  0x93: '◤', // upper-left triangle
  0x94: '◥', // upper-right triangle
  0x95: '▗', // lower-right quadrant
  0x96: '▖', // lower-left quadrant
  0x97: '─', // rule across row 4 - the family's horizontal
  0x98: '♠', // spade
  0x99: '♥', // heart
  0x9a: '╰', // arc: up and right
  0x9b: '╯', // arc: up and left
  0x9c: '\u{1FB7C}', // column 0 plus row 7
  0x9d: '\u{1FB7F}', // column 7 plus row 7
  0x9e: '◣', // lower-left triangle
  0x9f: '◢', // lower-right triangle
  0xa0: '▝', // upper-right quadrant
  0xa1: '▘', // upper-left quadrant
  0xa2: '│', // rule down column 4 - the family's vertical
  0xa3: '◆', // diamond
  0xa4: '♣', // club
  0xa5: '▚', // upper-left and lower-right quadrants
  0xa6: '▞', // upper-right and lower-left quadrants
  0xa7: '▌', // left half
  0xa8: '▐', // right half
  0xa9: '▀', // upper half
  0xaa: '▄', // lower half
  0xab: '╱', // diagonal, lower left to upper right
  0xac: '╲', // diagonal, upper left to lower right
  0xad: '┼', // junction: all four arms
  0xae: '\u{1FB7A}', // one-pixel rule across row 5
  0xaf: '\u{1FB7B}', // ... row 6
  0xb0: '▁', // ... row 7 (lower one eighth block)
  0xb1: '▒', // chequer dither, whole cell
  0xb2: '┴', // junction: left, right, up
  0xb3: '\u{1FB82}', // upper quarter
  0xb4: '├', // junction: up, down, right
  0xb5: '\u{1FB8C}', // chequer dither, left half
  0xb6: '▎', // left quarter
  0xb7: '\u{1FB87}', // right quarter
  0xb8: '\u{1FB8F}', // chequer dither, lower half
  0xb9: '┤', // junction: up, down, left
  0xba: '▂', // lower quarter
  0xbb: '┬', // junction: left, right, down
  0xbc: '┌', // corner: down and right
  0xbd: '┐', // corner: down and left
  0xbe: '└', // corner: up and right
  0xbf: '┘', // corner: up and left
};

/** Graphics character -> code, for the encode direction. */
const GRAPHIC_CODES = new Map<string, number>(
  Object.entries(GRAPHICS).map(([code, glyph]) => [glyph, Number(code)]),
);

/**
 * Every code in the standard graphics band, whether or not this file has a
 * character for it - the machine's own answer to "which bytes are graphics", as
 * opposed to which ones we can currently spell. The user-definable band above
 * it is deliberately not here: those codes are whatever a program made them, so
 * they are not a fixed set.
 *
 * This is what the semigraphics audit's own declaration reads. It lives here
 * rather than there because that table is held to the registered dialects, so
 * its entry goes in with the registry line - and because the band is a fact
 * about the generator bitmaps this file already maps, not a second opinion
 * about them.
 */
export const SORCERER_GRAPHIC_CODES: number[] = Array.from(
  { length: STANDARD_GRAPHICS_COUNT },
  (_, i) => STANDARD_GRAPHICS_FIRST + i,
);

/** The `{0xNN}` raw-byte escape for a code with no printable form. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * The plain editor character for a code that has a natural printable form:
 * ASCII 0x20-0x7E, or a standard graphics character this file has a match for.
 * Everything else returns undefined and is written as a {@link rawByte} escape.
 */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  if (c >= 0x20 && c <= 0x7e) return String.fromCharCode(c);
  return GRAPHICS[c];
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
 * well-formed `{0xNN}` escape is literal text: the Sorcerer has real `{`/`}`
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
  // Read a whole code point, so an astral character - which several of the
  // graphics are - reports one error rather than two lone surrogates.
  const cp = String.fromCodePoint(text.codePointAt(i)!);
  const graphic = GRAPHIC_CODES.get(cp);
  if (graphic !== undefined) return { code: graphic, length: cp.length };
  const code = cp.codePointAt(0)!;
  if (cp.length === 1 && code >= 0x20 && code <= 0x7e) {
    return { code, length: 1 };
  }
  throw new CharsetError(
    `Character ${JSON.stringify(cp)} has no Sorcerer equivalent`,
    i,
  );
}

/**
 * Decode one machine byte in a literal context to editor text, never reading at
 * or past `end`. Every byte becomes something {@link parseChar} maps back to the
 * same byte, so decode -> tokenize is byte-exact: ASCII and the standard
 * graphics pass through as characters, a literal `{` that would otherwise read
 * as an escape is itself escaped, and every other byte becomes `{0xNN}`. Always
 * advances one byte (the escapes carry no operands).
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

export const sorcererCharset: CharsetMapping = {
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
    // round-trip path, which uses toUnicode/decodeSpan). The fixed symbols at
    // 0x00-0x1F and the user-definable band at 0xC0-0xFF have shapes the
    // machine can draw and this file cannot name, so they render as a space
    // rather than as a wrong picture.
    return plainChar(code) ?? ' ';
  },
};
