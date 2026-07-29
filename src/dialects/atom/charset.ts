import { CharsetError, type CharsetMapping } from '../types';
import { sextantGlyph } from '../sextants';

/**
 * Acorn Atom character mapping.
 *
 * Atom BASIC stores program lines as plain ASCII (the tokenizer does no
 * keyword-to-byte packing - see {@link import('./tokenizer').tokenizeProgram}),
 * so the "machine code" for a source character is just its byte. The mapping is
 * **total** - every byte 0x00–0xFF has a text form that {@link parseChar} turns
 * back into the same byte - so an imported image never silently corrupts.
 *
 *  - 0x20–0x7E is printable ASCII, straight through both ways. Lower case is
 *    preserved (a pasted listing survives; the export path warns separately that
 *    a real Atom wants upper-case keywords). On screen 0x60–0x7E come out as
 *    inverse capitals: the machine has no lower case.
 *  - 0xA0–0xDF are the MC6847 Semigraphics-6 cells and carry Unicode sextants
 *    (see {@link sextantChar}), apart from the blank 0xA0.
 *  - Every other byte - the control codes 0x00–0x1F and 0x7F, the inverse
 *    digits and punctuation at 0x80–0x9F, and 0xE0–0xFF - has no plain form
 *    and is written as a `{0xNN}` raw-byte escape.
 *
 * The top-bit range is **not** uniformly inverse video, which the kernel-ROM
 * probe in `semigraphics.test.ts` pins byte by byte: the write-character
 * routine sends 0x80–0xDF to screen codes 0xA0–0xFF (inverse punctuation, then
 * the 64 graphics cells) and 0xE0–0xFF back down to 0x60–0x7F - the same
 * shapes as 0xC0–0xDF in the other colour set. Colour is not representable in
 * editor text and two bytes cannot share one character without breaking the
 * mapping's injectivity, so the duplicates at 0xE0–0xFF stay escaped.
 *
 * The escape deliberately does **not** use a `%`-prefix for inverse video: on the
 * floating-point ROM `%A`…`%Z` name the FP variables, so `%` must stay a literal
 * character. A `{...}` that is not a well-formed `{0xNN}` escape is literal text
 * (the Atom has real `{`/`}` at 0x7B/0x7D); a literal `{` that would otherwise
 * read as an escape is itself escaped so the text still round-trips.
 */

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** First and last program byte the kernel maps to a Semigraphics-6 cell. */
const SG6_FIRST = 0xa0;
const SG6_LAST = 0xdf;

/** Reverse a six-bit value, low bit to high. */
function reverse6(pattern: number): number {
  let out = 0;
  for (let bit = 0; bit < 6; bit++) out |= ((pattern >> bit) & 1) << (5 - bit);
  return out;
}

/**
 * The Unicode sextant for a Semigraphics-6 byte, or undefined for any other
 * byte.
 *
 * PRINTing string byte 0xA0 + p draws SG6 pattern p: the kernel's
 * write-character routine adds 0x20, and the MC6847 draws screen codes
 * 0xC0–0xFF as the 64 patterns (the Atom wires the VDG's AS pin to screen-data
 * bit 6, so a bit-6 screen byte is a graphics cell). The chip numbers the six
 * cells the other way up from Unicode - **bit 5 top-left, bit 4 top-right,
 * bit 3 middle-left, bit 2 middle-right, bit 1 bottom-left, bit 0
 * bottom-right** - so the pattern is a plain six-bit reversal away from
 * {@link sextantGlyph}'s order. `semigraphics.test.ts` pins both facts against
 * the MC6847 font the emulator draws with and against the real kernel ROM.
 *
 * The blank cell 0xA0 stays escaped: its only faithful form is a space, which
 * 0x20 owns.
 */
export function sextantChar(code: number): string | undefined {
  const c = code & 0xff;
  if (c <= SG6_FIRST || c > SG6_LAST) return undefined;
  return sextantGlyph(reverse6(c - SG6_FIRST));
}

// The forward map (sextant -> byte), built from the same function so the two
// directions cannot drift apart.
const GLYPH_TO_CODE = new Map<string, number>();
for (let code = SG6_FIRST + 1; code <= SG6_LAST; code++) {
  GLYPH_TO_CODE.set(sextantChar(code)!, code);
}

/** The `{0xNN}` raw-byte escape for a byte with no printable form. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/** The plain editor character for a code in 0x20–0x7E, else undefined. */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  return c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : undefined;
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const m = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  return m ? parseInt(m[1]!, 16) : null;
}

/**
 * Parse one editor unit - a character, an astral Semigraphics-6 sextant or a
 * `{0xNN}` escape - starting at index i. Returns the machine byte it encodes
 * and the number of source *code units* consumed.
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
  // Read a full code point: most of the sextants live in the astral plane.
  const ch = String.fromCodePoint(text.codePointAt(i)!);
  const sextant = GLYPH_TO_CODE.get(ch);
  if (sextant !== undefined) return { code: sextant, length: ch.length };
  const code = ch.charCodeAt(0);
  if (ch.length === 1 && code >= 0x20 && code <= 0x7e)
    return { code, length: 1 };
  throw new CharsetError(
    `Character ${JSON.stringify(ch)} has no Acorn Atom equivalent`,
    i,
  );
}

/**
 * Decode one machine byte to editor text, never reading at or past `end`. Every
 * byte becomes something {@link parseChar} maps back to the same byte: printable
 * ASCII passes through, a Semigraphics-6 byte becomes its sextant, a literal
 * `{` that would otherwise read as an escape is itself escaped, and every other
 * byte (controls, inverse punctuation, the duplicate colour set) becomes
 * `{0xNN}`. Always advances one byte.
 */
export function decodeSpan(
  bytes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = bytes[i]! & 0xff;
  if (b === OPEN_BRACE) {
    for (let j = i + 1; j < end; j++) {
      const c = bytes[j]!;
      if (c === CLOSE_BRACE) {
        let content = '';
        for (let k = i + 1; k < j; k++)
          content += String.fromCharCode(bytes[k]!);
        if (parseEscape(content) !== null)
          return { text: rawByte(b), length: 1 };
        break;
      }
      if (c === OPEN_BRACE || c < 0x20 || c > 0x7e) break;
    }
    return { text: '{', length: 1 };
  }
  const plain = plainChar(b) ?? sextantChar(b);
  return plain !== undefined
    ? { text: plain, length: 1 }
    : { text: rawByte(b), length: 1 };
}

export const atomCharset: CharsetMapping = {
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
    // A single-character display form for debug/status readouts: a graphics
    // byte shows its sextant, an inverse-video byte its base glyph.
    return sextantChar(code) ?? plainChar(code & 0x7f) ?? '?';
  },
};
