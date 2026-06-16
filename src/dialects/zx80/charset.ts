import { createSinclairCharset } from '../sinclairCharset';

/**
 * ZX80 character set <-> editor text.
 *
 * The ZX80 shares the ZX81's display codes for digits (0x1C-0x25), letters
 * (0x26-0x3F) and inverse video (bit 7), but its 4K ROM font (0x0E00) lays out
 * the *punctuation and block-graphics* region (0x00-0x1B) differently — most
 * importantly the string quote is 0x01 (it is 0x0B on the ZX81, where the ZX80
 * has a grey-graphics block instead). Reusing the ZX81 codes here stored the
 * wrong byte for every quote/operator inside a string, so the ROM mis-parsed
 * the line and filled the screen with garbage. The tables below were read back
 * from the real ROM font.
 *
 * Escape and %-inverse conventions are identical to the ZX81 (see that file);
 * the parsing/rendering machinery is shared via {@link createSinclairCharset}.
 */

const BASE_PUNCT: Record<number, string> = {
  0x00: ' ',
  0x01: '"',
  0x0c: '£',
  0x0d: '$',
  0x0e: ':',
  0x0f: '?',
  0x10: '(',
  0x11: ')',
  0x12: '-',
  0x13: '+',
  0x14: '*',
  0x15: '/',
  0x16: '=',
  0x17: '>',
  0x18: '<',
  0x19: ';',
  0x1a: ',',
  0x1b: '.',
};

/** Unicode forms for the block-graphics codes that have exact equivalents. */
const GRAPHIC_UNICODE: Record<number, string> = {
  0x02: '▌',
  0x03: '▄',
  0x04: '▘',
  0x05: '▝',
  0x06: '▖',
  0x07: '▗',
  0x08: '▞',
  0x09: '▒',
  0x80: '█',
  0x82: '▐',
  0x83: '▀',
  0x84: '▟',
  0x85: '▙',
  0x86: '▜',
  0x87: '▛',
  0x88: '▚',
};

/**
 * Backslash escapes (two chars: left then right cell half, where ' = top,
 * . = bottom, : = full, space = empty) -> ZX80 code. Same escape spellings as
 * the ZX81, remapped to the ZX80's graphics codes.
 */
const ESCAPES: Record<string, number> = {
  "' ": 0x04, // top-left
  " '": 0x05, // top-right
  "''": 0x83, // top half
  '. ': 0x06, // bottom-left
  ': ': 0x02, // left half
  ".'": 0x08, // bottom-left + top-right
  ":'": 0x87, // all but bottom-right
  '!!': 0x09, // grey
  "!'": 0x0b, // top grey
  '!.': 0x0a, // bottom grey
  '::': 0x80, // full
  '.:': 0x84, // all but top-left
  ':.': 0x85, // all but top-right
  '..': 0x03, // bottom half
  "':": 0x86, // all but bottom-left
  ' :': 0x82, // right half
  "'.": 0x88, // top-left + bottom-right
  ' .': 0x07, // bottom-right
  '||': 0x89, // inverse grey
  "|'": 0x8b, // inverse top grey
  '|.': 0x8a, // inverse bottom grey
};

export const NEWLINE = 0x76;
export const QUOTE = 0x01;
/** The ZX80 has no dedicated quote-image glyph; an embedded quote is inverse-video. */
export const QUOTE_IMAGE = 0x81;
export const INVERSE = 0x80;

const { charset, parseChar } = createSinclairCharset({
  machineName: 'ZX80',
  basePunct: BASE_PUNCT,
  graphicUnicode: GRAPHIC_UNICODE,
  escapes: ESCAPES,
  newline: NEWLINE,
  inverse: INVERSE,
});

export { parseChar };
export const zx80Charset = charset;
