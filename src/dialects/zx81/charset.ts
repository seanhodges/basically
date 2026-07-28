import { createSinclairCharset } from '../sinclairCharset';

/**
 * ZX81 character set <-> editor text.
 *
 * Source conventions (zxtext2p-compatible where practical):
 *  - Letters, digits and ZX81 punctuation map directly (lowercase accepted,
 *    folded to upper - the ZX81 has no lowercase).
 *  - Block graphics may be written as unicode block elements (▘▝▀▖▌▞▛ etc.)
 *    or as backslash escapes describing the left/right half of the cell:
 *    ' = top, . = bottom, : = full, space = empty.  E.g. \' . = 0x01, \:: = █.
 *    Grey (chequered) blocks: \!! (full), \!' (upper half), \!. (lower half);
 *    inverse grey \|| (full), \|' and \|. inverting \!' and \!. respectively.
 *
 *    \!' and \!. used to mean the opposite halves here - the reverse of both
 *    the ' = top / . = bottom convention and of the ZX80, which spells them the
 *    right way round. They now follow the ROM: 0x0A is chequer over blank and
 *    0x09 blank over chequer (see sinclairGraphics.test.ts). A ZX81 program
 *    saved with the old spelling therefore re-encodes to the other half; the
 *    unicode forms are unaffected and are the canonical spelling now.
 *  - %c makes the next character inverse video, e.g. %A → inverse A.
 *
 * The parsing/rendering machinery is shared with the ZX80 via
 * {@link createSinclairCharset}; only the code tables below are ZX81-specific.
 */

const BASE_PUNCT: Record<number, string> = {
  0x00: ' ',
  0x0b: '"',
  0x0c: '£',
  0x0d: '$',
  0x0e: ':',
  0x0f: '?',
  0x10: '(',
  0x11: ')',
  0x12: '>',
  0x13: '<',
  0x14: '=',
  0x15: '+',
  0x16: '-',
  0x17: '*',
  0x18: '/',
  0x19: ';',
  0x1a: ',',
  0x1b: '.',
};

/**
 * Unicode forms for the block-graphics codes.
 *
 * The quadrants come from Block Elements; the chequered ("grey") cells and
 * their inverses come from Symbols for Legacy Computing (U+1FB8E-U+1FB92),
 * which unicode added for exactly this family of machines. Every code here was
 * checked against the ROM font at 0x1E00 - see sinclairGraphics.test.ts, which
 * re-derives the whole table from the ROM bitmaps so it cannot drift.
 *
 * Codes 0x80-0x8A are the inverse-video twins of 0x00-0x0A: the hardware
 * inverts the 8x8 bitmap, so each glyph here is the complement of its base.
 */
export const GRAPHIC_UNICODE: Record<number, string> = {
  0x01: '▘',
  0x02: '▝',
  0x03: '▀',
  0x04: '▖',
  0x05: '▌',
  0x06: '▞',
  0x07: '▛',
  0x08: '▒',
  0x09: '\u{1FB8F}', // lower half medium shade
  0x0a: '\u{1FB8E}', // upper half medium shade
  0x80: '█',
  0x81: '▟',
  0x82: '▙',
  0x83: '▄',
  0x84: '▜',
  0x85: '▐',
  0x86: '▚',
  0x87: '▗',
  0x88: '\u{1FB90}', // inverse medium shade
  0x89: '\u{1FB91}', // upper half block and lower half inverse medium shade
  0x8a: '\u{1FB92}', // upper half inverse medium shade and lower half block
};

/** Backslash escapes (two chars following the backslash) -> code. */
export const ESCAPES: Record<string, number> = {
  "' ": 0x01,
  " '": 0x02,
  "''": 0x03,
  '. ': 0x04,
  ': ': 0x05,
  ".'": 0x06,
  ":'": 0x07,
  '!!': 0x08,
  "!'": 0x0a, // ' = upper: 0x0A is chequer over blank
  '!.': 0x09, // . = lower: 0x09 is blank over chequer
  '::': 0x80,
  '.:': 0x81,
  ':.': 0x82,
  '..': 0x83,
  "':": 0x84,
  ' :': 0x85,
  "'.": 0x86,
  ' .': 0x87,
  '||': 0x88,
  "|'": 0x8a, // inverse of \!'
  '|.': 0x89, // inverse of \!.
};

export const NEWLINE = 0x76;
export const NUMBER_MARKER = 0x7e;
export const QUOTE = 0x0b;
export const QUOTE_IMAGE = 0xc0;
export const INVERSE = 0x80;

const { charset, parseChar } = createSinclairCharset({
  machineName: 'ZX81',
  basePunct: BASE_PUNCT,
  graphicUnicode: GRAPHIC_UNICODE,
  escapes: ESCAPES,
  newline: NEWLINE,
  inverse: INVERSE,
});

export { parseChar };
export const zx81Charset = charset;
