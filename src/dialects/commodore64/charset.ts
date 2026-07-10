import { type CharsetMapping } from '../types';
import { parseC64Char, petsciiToText } from './petscii';

/**
 * Commodore 64 PETSCII <-> editor text, for the bytes a BASIC program stores:
 * string literals, REM/DATA text, and any non-keyword character. Uses the
 * default (upper-case / graphics) character set, the mode the machine powers on
 * in.
 *
 *  - Letters fold to upper case (the default set has no lower case); digits and
 *    most punctuation share their ASCII codes.
 *  - The four C64-specific glyphs map to their PETSCII codes: £ (0x5C),
 *    ↑ (0x5E), ← (0x5F) and π (0xFF).
 *  - Block graphics render as their closest Unicode glyph, and control codes
 *    (cursor moves, colours, reverse on/off…) as petcat-style `{name}` escapes.
 *    Every byte the font draws identically to another, or leaves undefined,
 *    round-trips through a numeric `{$xx}` escape.
 *
 * The complete 256-code table lives in {@link ./petscii}; this module is the
 * thin {@link CharsetMapping} adapter over it.
 */
export const c64Charset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < text.length) {
      const { code, length } = parseC64Char(text, i);
      out.push(code);
      i += length;
    }
    return Uint8Array.from(out);
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    for (let i = 0; i < codes.length; i++) {
      text += petsciiToText(codes[i]!);
    }
    return text;
  },

  glyph(code: number): string {
    return petsciiToText(code);
  },
};
