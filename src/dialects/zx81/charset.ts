import { createSinclairCharset } from '../sinclairCharset';

/**
 * ZX81 character set <-> editor text.
 *
 * Source conventions (zxtext2p-compatible where practical):
 *  - Letters, digits and ZX81 punctuation map directly (lowercase accepted,
 *    folded to upper — the ZX81 has no lowercase).
 *  - Block graphics may be written as unicode block elements (▘▝▀▖▌▞▛ etc.)
 *    or as backslash escapes describing the left/right half of the cell:
 *    ' = top, . = bottom, : = full, space = empty.  E.g. \' . = 0x01, \:: = █.
 *    Grey blocks: \!! (full), \!' (top), \!. (bottom); inverse grey \|| \|' \|.
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

/** Unicode forms for the block-graphics codes that have exact equivalents. */
const GRAPHIC_UNICODE: Record<number, string> = {
  0x01: '▘',
  0x02: '▝',
  0x03: '▀',
  0x04: '▖',
  0x05: '▌',
  0x06: '▞',
  0x07: '▛',
  0x08: '▒',
  0x80: '█',
  0x81: '▟',
  0x82: '▙',
  0x83: '▄',
  0x84: '▜',
  0x85: '▐',
  0x86: '▚',
  0x87: '▗',
};

/** Backslash escapes (two chars following the backslash) -> code. */
const ESCAPES: Record<string, number> = {
  "' ": 0x01,
  " '": 0x02,
  "''": 0x03,
  '. ': 0x04,
  ': ': 0x05,
  ".'": 0x06,
  ":'": 0x07,
  '!!': 0x08,
  "!'": 0x09,
  '!.': 0x0a,
  '::': 0x80,
  '.:': 0x81,
  ':.': 0x82,
  '..': 0x83,
  "':": 0x84,
  ' :': 0x85,
  "'.": 0x86,
  ' .': 0x87,
  '||': 0x88,
  "|'": 0x89,
  '|.': 0x8a,
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
