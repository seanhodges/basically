// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';

/**
 * The Apple II's character set: the Signetics 2513's 64 glyphs, upper case
 * only, and no pictures - plus the display encoding the Apple I has no
 * equivalent of.
 *
 * A property of the machine rather than of its BASIC, so `apple2plus` imports
 * this rather than deriving its own.
 *
 * ### The 64 glyphs, and the four ways to write them
 *
 * The character generator is handed the low six bits of a screen byte and draws
 * `$00`-`$1F` as `@`-`_` and `$20`-`$3F` as ` `-`?`, which between them are ASCII
 * `$20`-`$5F`: space, punctuation, the digits and `A`-`Z`. Bits 6 and 7 pick the
 * video mode for that glyph rather than another glyph:
 *
 *  - `$00`-`$3F` inverse, `$40`-`$7F` flashing, `$80`-`$FF` normal.
 *
 * So the same 64 shapes appear four times over the byte range, and the normal
 * half holds each of them **twice**. The interpreter and the monitor both write
 * ASCII with bit 7 set, which lands in `$A0`-`$DF`, and that is the run this
 * mapping gives plain characters to. The other normal run (`$80`-`$9F` and
 * `$E0`-`$FF`) draws the same shapes and is nothing the machine itself
 * produces, so it keeps a `{0xNN}` raw-byte escape: two bytes cannot share one
 * text form without breaking the round trip.
 *
 * Inverse and flashing are worth naming rather than numbering, because a
 * program pokes them into the text page deliberately - `POKE 1024,1` writes an
 * inverse `A` - so they get `{INV<c>}` and `{FLASH<c>}`, where `<c>` is the
 * glyph's own character. Neither brace is in the 64-glyph set, so `<c>` can
 * never be a `}` and the escape cannot be ambiguous.
 *
 * There is no lower case at all: the keyboard cannot type it and the generator
 * cannot draw it. The interpreter agrees - typing `10 print a` at the `>` prompt
 * answers `*** SYNTAX ERR` - so lower case in the editor **folds to upper case**
 * here rather than being preserved inside string literals. That fold is the one
 * place this mapping is not a bijection on the text side; it stays one on the
 * byte side, which is what matters for a round trip.
 */

/** Lowest code with a plain character: space, `$20` with bit 7 set. */
export const GLYPH_BASE = 0xa0;
/** Highest code with a plain character: `_`, `$5F` with bit 7 set. */
export const GLYPH_TOP = 0xdf;

/** Video mode a byte's top two bits select. */
export type VideoMode = 'inverse' | 'flashing' | 'normal';

/** Which of the three the character generator draws this byte in. */
export function videoMode(code: number): VideoMode {
  const c = code & 0xff;
  if (c < 0x40) return 'inverse';
  if (c < 0x80) return 'flashing';
  return 'normal';
}

/**
 * The character the generator draws for any byte, ignoring its video mode.
 * Every byte draws something: this is the 64-glyph set indexed by the low six
 * bits.
 */
export function screenGlyph(code: number): string {
  const g = code & 0x3f;
  return String.fromCharCode(g < 0x20 ? g + 0x40 : g);
}

/** The escape prefix for each mode that gets one. */
const MODE_PREFIX = { inverse: 'INV', flashing: 'FLASH' } as const;

/** The `{0xNN}` raw-byte escape for a normal-video duplicate. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * The plain editor character for a code the machine's own printing produces, or
 * undefined. Strips bit 7, since the editor writes ASCII and the machine stores
 * it set.
 */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  return c >= GLYPH_BASE && c <= GLYPH_TOP
    ? String.fromCharCode(c & 0x7f)
    : undefined;
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const hex = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  if (hex) return parseInt(hex[1]!, 16);
  const named = /^(INV|FLASH)(.)$/.exec(content);
  if (!named) return null;
  const glyph = named[2]!.toUpperCase();
  if (glyph < ' ' || glyph > '_') return null;
  const low = glyph.charCodeAt(0) & 0x3f;
  return named[1] === 'INV' ? low : low | 0x40;
}

/**
 * Parse one editor unit - a character or a `{...}` escape - starting at index
 * `i`, returning the machine byte it encodes and how many source characters it
 * consumed. Mirrors the signature the other dialects' charsets expose, since the
 * shared charset probes drive them generically.
 *
 * A `{...}` that is not a well-formed escape is an error rather than literal
 * text: the Apple II has no `{` or `}` glyph, so an escape is the only way a
 * brace reaches a program at all.
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
    `Character ${JSON.stringify(cp)} has no Apple II equivalent`,
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
  // produces can be misread as the opening of an escape.
  const plain = plainChar(b);
  if (plain !== undefined) return { text: plain, length: 1 };
  const mode = videoMode(b);
  return {
    text:
      mode === 'normal'
        ? rawByte(b)
        : `{${MODE_PREFIX[mode]}${screenGlyph(b)}}`,
    length: 1,
  };
}

export const apple2Charset: CharsetMapping = {
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
    // round-trip path, which uses toUnicode/decodeSpan). Every byte draws
    // something on this machine, so this never has to answer with a space.
    return screenGlyph(code);
  },
};
