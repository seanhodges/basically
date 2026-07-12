import { CharsetError, type CharsetMapping } from '../types';

/**
 * TRS-80 character set <-> editor text, for the bytes a Level II BASIC
 * program stores: string literals, REM/DATA text and any non-keyword character.
 * The mapping is **total** - every byte 0x00-0xFF has a text form that
 * {@link parseChar} turns back into the same byte, so an imported program never
 * silently corrupts.
 *
 *  - 0x00–0x1F and 0x7F are control codes with no printable form; they are
 *    written as a `{0xNN}` raw-byte escape.
 *  - 0x20–0x7E is printable ASCII, straight through both ways. Lower case
 *    (0x60–0x7F) is **preserved**, not folded to upper: a Model III program keeps
 *    its case and a byte round-trips exactly. (The Model I video hardware shows
 *    0x60–0x7F upper-cased, but that is a display quirk, not a stored-byte one.)
 *  - 0x80 is the blank block-graphics cell; because its glyph would collide with
 *    SPACE it is written as `{0x80}` rather than a space.
 *  - 0x81–0xBF are the 2×3 block-graphics cells: the low 6 bits are a bitmap of
 *    the six sub-cells (bit0 top-left, bit1 top-right, bit2 mid-left, bit3
 *    mid-right, bit4 bottom-left, bit5 bottom-right). They map to the Unicode
 *    "Symbols for Legacy Computing" sextants (U+1FB00…), with the two half-blocks
 *    and the full block standing in for the patterns Unicode gives dedicated
 *    characters.
 *  - 0xC0–0xFF are the space-compression codes (the print driver emits
 *    `code−0xC0` spaces); they are *not* glyph duplicates of the graphics, so
 *    they are written as `{0xNN}` and round-trip as distinct bytes.
 *
 * A `{...}` that is not a well-formed `{0xNN}` escape is literal text - the
 * TRS-80 has real `{`/`}` characters at 0x7B/0x7D. Escapes are only recognised
 * inside string / REM / DATA literals; the tokenizer's expression path stays
 * per-character, so `{` outside a literal is always the plain 0x7B byte.
 */

const SEXTANT_BASE = 0x1fb00;
// The four sextant patterns Unicode covers outside the U+1FB00 block.
const SEXTANT_SPECIAL: Record<number, string> = {
  0x00: ' ', // blank
  0x15: '▌', // 0b010101 left half  -> U+258C
  0x2a: '▐', // 0b101010 right half -> U+2590
  0x3f: '█', // full block          -> U+2588
};

/** Block-graphics pattern (0..63) -> Unicode glyph. */
function sextantGlyph(pattern: number): string {
  const special = SEXTANT_SPECIAL[pattern];
  if (special !== undefined) return special;
  // U+1FB00 enumerates the 60 remaining patterns in ascending bit order,
  // skipping the four that already have characters (0, 0x15, 0x2A, 0x3F).
  let index = pattern - 1; // pattern 0 isn't in the block
  if (pattern > 0x15) index--;
  if (pattern > 0x2a) index--;
  return String.fromCodePoint(SEXTANT_BASE + index);
}

// Build the forward map (Unicode glyph -> 0x80-based machine code) once. The
// blank (pattern 0 -> SPACE) is skipped: SPACE is ASCII 0x20 and 0x80 has its
// own `{0x80}` escape, so a graphics glyph only ever resolves to 0x81–0xBF.
const GLYPH_TO_CODE = new Map<string, number>();
for (let pattern = 1; pattern < 64; pattern++) {
  const glyph = sextantGlyph(pattern);
  if (!GLYPH_TO_CODE.has(glyph)) GLYPH_TO_CODE.set(glyph, 0x80 | pattern);
}

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** The `{0xNN}` raw-byte escape for a code with no printable form. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * The plain editor character(s) for a code that has a natural printable form:
 * ASCII 0x20–0x7E (case preserved) and the block-graphics sextants 0x81–0xBF.
 * Everything else - control codes, the blank-graphics byte 0x80 and the
 * 0xC0–0xFF compression codes - returns undefined and is written as a
 * {@link rawByte} escape instead.
 */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  if (c >= 0x20 && c <= 0x7e) return String.fromCharCode(c);
  if (c >= 0x81 && c <= 0xbf) return sextantGlyph(c & 0x3f);
  return undefined;
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const m = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  return m ? parseInt(m[1]!, 16) : null;
}

/**
 * Parse one editor unit - a character, an astral block-graphics glyph or a
 * `{0xNN}` escape - starting at index i. Returns the machine byte it encodes and
 * the number of source *code units* consumed. Used inside string / REM / DATA
 * literals; the tokenizer's expression path stays per-character (via
 * {@link trs80Charset.toMachine}), so escapes are not recognised there.
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
  // Read a full code point: block-graphics sextants live in the astral plane.
  const cp = String.fromCodePoint(text.codePointAt(i)!);
  const graphic = GLYPH_TO_CODE.get(cp);
  if (graphic !== undefined) return { code: graphic, length: cp.length };
  const code = cp.codePointAt(0)!;
  if (cp.length === 1 && code >= 0x20 && code <= 0x7e) {
    return { code, length: 1 };
  }
  throw new CharsetError(
    `Character ${JSON.stringify(cp)} has no TRS-80 equivalent`,
    i,
  );
}

/**
 * Decode one machine byte in a literal context to editor text, never reading at
 * or past `end`. Every byte becomes something {@link parseChar} maps back to the
 * same byte, so decode → tokenize is byte-exact: printable ASCII and graphics
 * sextants pass through, a literal `{` that would otherwise read as an escape is
 * itself escaped, and every other byte (controls, blank-graphics, compression
 * codes) becomes `{0xNN}`. Always advances one byte (the escapes carry no
 * operands).
 */
export function decodeSpan(
  bytes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = bytes[i]! & 0xff;
  if (b === OPEN_BRACE) {
    // Escape a literal '{' only when the bytes ahead happen to read as a
    // well-formed escape (otherwise the text would round-trip to a different
    // byte).
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
  const plain = plainChar(b);
  return plain !== undefined
    ? { text: plain, length: 1 }
    : { text: rawByte(b), length: 1 };
}

// --- runtime string values ---------------------------------------------------

/**
 * Private-Use-Area base for the interpreter's string values. The interpreter
 * stores strings as JS strings; a byte with no printable glyph (control code,
 * blank-graphics, compression code) maps to U+E0xx so it round-trips through the
 * value model and `ASC(CHR$(n)) === n` holds for every byte, while the Screen's
 * print path interprets the code. These characters never reach editor text -
 * that path uses the `{0xNN}` escapes above.
 */
const RUNTIME_PUA = 0xe000;

/** A TRS-80 code -> the interpreter's single-code-point string character. */
export function codeToRuntimeChar(code: number): string {
  const c = code & 0xff;
  return plainChar(c) ?? String.fromCodePoint(RUNTIME_PUA + c);
}

/** The interpreter's string character -> its TRS-80 code, or undefined. */
export function runtimeCharToCode(ch: string): number | undefined {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return undefined;
  if (cp >= RUNTIME_PUA && cp <= RUNTIME_PUA + 0xff) return cp - RUNTIME_PUA;
  const graphic = GLYPH_TO_CODE.get(ch);
  if (graphic !== undefined) return graphic;
  // Fold a stray lower-case letter typed at the keyboard onto its upper-case
  // code only as a last resort; a byte-preserving path never reaches here.
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  return undefined;
}

export const trs80Charset: CharsetMapping = {
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
    // round-trip path, which uses toUnicode/decodeSpan). Controls render as a
    // space; the graphics as their sextant.
    const c = code & 0xff;
    if (c >= 0x80) return sextantGlyph(c & 0x3f);
    if (c >= 0x20 && c <= 0x7e) return String.fromCharCode(c);
    return ' ';
  },
};
