import { CharsetError, type CharsetMapping } from '../types';

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
 *
 * Colour/cursor control codes inside strings are not handled here yet; write
 * them with CHR$(n) for now.
 */

// Editor glyph -> PETSCII for the handful that differ from ASCII.
const SPECIAL_TO_PETSCII: Record<string, number> = {
  '£': 0x5c,
  '↑': 0x5e,
  '←': 0x5f,
  π: 0xff,
};

// Inverse, for detokenizing.
const PETSCII_TO_SPECIAL: Record<number, string> = {
  0x5c: '£',
  0x5e: '↑',
  0x5f: '←',
  0xff: 'π',
};

function charToPetscii(ch: string): number | undefined {
  const special = SPECIAL_TO_PETSCII[ch];
  if (special !== undefined) return special;

  let code = ch.charCodeAt(0);
  // Fold lower case onto the upper-case codes of the default character set.
  if (code >= 0x61 && code <= 0x7a) code -= 0x20;
  // Printable ASCII (space..]) maps straight through to the same PETSCII code.
  if (code >= 0x20 && code <= 0x5d) return code;
  return undefined;
}

export const c64Charset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = charToPetscii(text[i]!);
      if (code === undefined) {
        throw new CharsetError(
          `Character ${JSON.stringify(text[i])} has no Commodore 64 equivalent`,
          i,
        );
      }
      out[i] = code;
    }
    return out;
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    for (let i = 0; i < codes.length; i++) {
      text += this.glyph(codes[i]!);
    }
    return text;
  },

  glyph(code: number): string {
    const special = PETSCII_TO_SPECIAL[code];
    if (special !== undefined) return special;
    if (code >= 0x20 && code <= 0x5d) return String.fromCharCode(code);
    return '?';
  },
};
