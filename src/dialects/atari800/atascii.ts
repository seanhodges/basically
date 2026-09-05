// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError } from '../types';

/**
 * ATASCII - the Atari 8-bit character set - as a complete 256-code table.
 *
 * The layout is ASCII with both ends replaced:
 *
 *  - `$00`-`$1A` are block and line graphics, drawn by the character generator
 *    and reachable from the keyboard as CTRL + a key.
 *  - `$1B`-`$1F` also have glyphs, but printing one moves the cursor (or, for
 *    `$1B`, escapes the next control code), so they are named escapes here
 *    rather than characters: what an author means by putting `$1D` in a string
 *    is "move down a line".
 *  - `$20`-`$7F` are ASCII, with three substitutions: `$60` is ♦ rather than a
 *    backtick, `$7B` is ♠ rather than `{`, and `$7D`-`$7F` are the clear,
 *    delete and tab controls.
 *  - `$80`-`$FF` are the inverse-video twins of `$00`-`$7F`; ANTIC draws them
 *    by inverting the glyph, so they carry no separate shapes of their own.
 *
 * Codes with a shape of their own get their exact Unicode character (Box
 * Drawing and Block Elements first, then Symbols for Legacy Computing).
 * Everything else - the controls, and the whole inverse-video half - round-trips
 * through an escape, so `toMachine` and `toUnicode` are exact inverses over all
 * 256 codes.
 */

/** Codes `$00`-`$1A`: the graphics the character generator draws. */
const GRAPHICS: Record<number, string> = {
  0x00: '♥',
  0x01: '├',
  0x02: '🮇',
  0x03: '┘',
  0x04: '┤',
  0x05: '┐',
  0x06: '╱',
  0x07: '╲',
  0x08: '◢',
  0x09: '▗',
  0x0a: '◣',
  0x0b: '▝',
  0x0c: '▘',
  0x0d: '🮂',
  0x0e: '▂',
  0x0f: '▖',
  0x10: '♣',
  0x11: '┌',
  0x12: '─',
  0x13: '┼',
  0x14: '•',
  0x15: '▄',
  0x16: '▎',
  0x17: '┬',
  0x18: '┴',
  0x19: '▌',
  0x1a: '└',
};

/** The three ASCII positions ATASCII gives a card suit or a pipe instead. */
const ASCII_SUBSTITUTIONS: Record<number, string> = {
  0x60: '♦',
  0x7b: '♠',
  0x7e: '◀',
  0x7f: '▶',
};

/**
 * Control codes, by the name an escape spells them with.
 *
 * These are the codes a program puts in a string to drive the screen editor -
 * `PRINT "{clear}"` homes the cursor and blanks the screen, the way a
 * Commodore's `{clr}` does. The names are lower case and match the key or
 * effect the Atari manual gives them.
 */
const CONTROLS: Record<number, string> = {
  0x1b: 'esc',
  0x1c: 'up',
  0x1d: 'down',
  0x1e: 'left',
  0x1f: 'right',
  0x7d: 'clear',
  0x9b: 'eol',
  0x9c: 'delete line',
  0x9d: 'insert line',
  0x9e: 'clear tab',
  0x9f: 'set tab',
  0xfd: 'bell',
  0xfe: 'delete char',
  0xff: 'insert char',
};

/** code -> the text `toUnicode` emits for it. */
const codeToText = new Map<number, string>();
/** glyph or escape body -> code, for `toMachine`. */
const glyphToCode = new Map<string, number>();
const nameToCode = new Map<string, number>();

for (const [code, name] of Object.entries(CONTROLS)) {
  nameToCode.set(name, Number(code));
}

for (let code = 0; code < 0x100; code++) {
  const control = CONTROLS[code];
  if (control !== undefined) {
    codeToText.set(code, `{${control}}`);
    continue;
  }
  const graphic = GRAPHICS[code] ?? ASCII_SUBSTITUTIONS[code];
  if (graphic !== undefined) {
    codeToText.set(code, graphic);
    glyphToCode.set(graphic, code);
    continue;
  }
  if (code >= 0x20 && code <= 0x7c) {
    const ch = String.fromCharCode(code);
    codeToText.set(code, ch);
    glyphToCode.set(ch, code);
    continue;
  }
  // The inverse-video half, and the handful of low codes with no glyph of
  // their own: a numeric escape, which is exact and unambiguous both ways.
  codeToText.set(code, `{$${code.toString(16).padStart(2, '0')}}`);
}

/** The printable text for one ATASCII code - a glyph, or an escape. */
export function atasciiToText(code: number): string {
  return codeToText.get(code & 0xff) ?? '';
}

/**
 * The ATASCII code one character of `text` at `i` stands for, and how many
 * UTF-16 units it consumed. Throws {@link CharsetError} on text this machine
 * has no code for.
 */
export function parseAtariChar(
  text: string,
  i: number,
): { code: number; length: number } {
  const ch = text[i]!;
  if (ch === '{') {
    const end = text.indexOf('}', i + 1);
    if (end < 0) throw new CharsetError('Unterminated "{" escape', i);
    const inner = text.slice(i + 1, end);
    const length = end - i + 1;

    const hex = /^\$([0-9a-fA-F]{1,2})$/.exec(inner);
    if (hex) return { code: parseInt(hex[1]!, 16), length };

    const named = nameToCode.get(inner.toLowerCase());
    if (named !== undefined) return { code: named, length };

    throw new CharsetError(`Unknown escape "{${inner}}"`, i);
  }

  // A glyph may be more than one UTF-16 unit: the two Symbols-for-Legacy-
  // Computing eighth-blocks ($02, $0D) are astral-plane characters.
  const glyph = String.fromCodePoint(text.codePointAt(i)!);
  const code = glyphToCode.get(glyph);
  if (code === undefined) {
    throw new CharsetError(
      `Character ${JSON.stringify(glyph)} has no Atari equivalent`,
      i,
    );
  }
  return { code, length: glyph.length };
}

/**
 * The shapes the character generator draws for the six codes {@link
 * atasciiToText} spells as an escape. A code in a string means "move the
 * cursor"; the same code sitting in screen memory is a character the machine
 * has already drawn, and this is what it looks like.
 */
const CONTROL_SHAPES: Record<number, string> = {
  0x1b: '\u241b',
  0x1c: '\u2191',
  0x1d: '\u2193',
  0x1e: '\u2190',
  0x1f: '\u2192',
  0x7d: '\u21b0',
};

/**
 * The single character the character generator draws for one ATASCII code -
 * what a screen reader wants, as opposed to {@link atasciiToText}, which spells
 * the control codes and the inverse half as escapes so that text round-trips.
 *
 * Always exactly one code point, because a screen row has to stay as wide as
 * the screen. Inverse video carries no shape of its own - ANTIC draws the same
 * glyph with the pixels turned over - so the top bit is dropped.
 */
export function atasciiGlyph(code: number): string {
  const shape = code & 0x7f;
  return CONTROL_SHAPES[shape] ?? codeToText.get(shape) ?? ' ';
}

/**
 * ATASCII for one of the character codes the screen is made of.
 *
 * Screen memory does not hold ATASCII. ANTIC indexes the character generator
 * directly, and the generator is in shape order - the printable ASCII first,
 * then the graphics, then the lower case - so the two orderings differ by a
 * rotation of the low seven bits. Inverse video is the top bit in both.
 */
export function screenCodeToAtascii(code: number): number {
  const inverse = code & 0x80;
  const shape = code & 0x7f;
  if (shape < 0x40) return inverse | (shape + 0x20);
  if (shape < 0x60) return inverse | (shape - 0x40);
  return inverse | shape;
}

/** The screen character code for an ATASCII code: {@link screenCodeToAtascii} back. */
export function atasciiToScreenCode(code: number): number {
  const inverse = code & 0x80;
  const ch = code & 0x7f;
  if (ch < 0x20) return inverse | (ch + 0x40);
  if (ch < 0x60) return inverse | (ch - 0x20);
  return inverse | ch;
}

/** End of line - what RETURN stores and what terminates every ATASCII record. */
export const ATASCII_EOL = 0x9b;
