import { CharsetError, type CharsetMapping } from '../types';
import { sextantGlyph } from '../sextants';

/**
 * BBC Micro character mapping: 7-bit ASCII with one quirk - code 0x60 (ASCII
 * backquote) displays as £ on the Beeb. The editor accepts both '£' and '`'
 * for it and always shows '£'.
 *
 * The BBC also stores the full 0x00–0xFF byte range inside strings, REM and
 * DATA - VDU control codes (0x00–0x1F), the SAA5050 teletext control codes
 * (0x80–0x9F, MODE 7 colour/flash/graphics attributes) and the top-bit range
 * 0xA0–0xFF. The MODE 7 mosaics among the latter have exact Unicode forms;
 * everything else is spelled as an escape so imported programs stay
 * byte-exact:
 *
 * - Named teletext escapes for the codes that carry a meaning in MODE 7:
 *   `{RED}` `{GREEN}` `{YELLOW}` `{BLUE}` `{MAGENTA}` `{CYAN}` `{WHITE}`,
 *   `{FLASH}` `{STEADY}`, `{DOUBLE HEIGHT}` … (see {@link TELETEXT_NAMES}).
 * - Unicode sextants for the mosaics, 0xA1–0xBF and 0xE0–0xFF (see
 *   {@link mosaicChar}). The SAA5050 treats a code as a mosaic iff bit 5 is
 *   set; `0xC0`–`0xDF` are the blast-through capitals, which stay escaped
 *   (a top-bit letter has no Unicode form of its own). 0xA0, the blank
 *   mosaic, also stays escaped: its only faithful form is a space, and 0x20
 *   owns that. The editor always shows a mosaic byte as its mosaic - whether
 *   MODE 7 would show a letter instead depends on control codes, mode and
 *   pokes the charset cannot know - and the byte round-trips exactly either
 *   way.
 * - `{0xNN}` for any other byte with no printable form (0x00–0x1F, 0x7F,
 *   0x80–0xFF outside the mosaics).
 *
 * A `{...}` that matches neither is literal text - the BBC has real `{`/`}`
 * characters at 0x7B/0x7D. These escapes are only recognised inside string /
 * REM / DATA / `*`-command literals; the tokenizer's expression path stays
 * per-character, so `{` outside a literal is always the plain 0x7B byte.
 */
const POUND = 0x60;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/**
 * SAA5050 teletext control codes (0x80–0x9F) with a canonical escape name.
 * The unnamed codes in the range (0x80, 0x8E–0x90, 0x9B) have no MODE 7 effect
 * and fall back to `{0xNN}`. Note 0x8D (double height) collides with the
 * tokenizer's line-number marker, which is exactly why the detokenizer must be
 * context-aware: 0x8D inside a literal is teletext data, not a line number.
 */
export const TELETEXT_NAMES: Record<number, string> = {
  0x81: 'RED',
  0x82: 'GREEN',
  0x83: 'YELLOW',
  0x84: 'BLUE',
  0x85: 'MAGENTA',
  0x86: 'CYAN',
  0x87: 'WHITE',
  0x88: 'FLASH',
  0x89: 'STEADY',
  0x8a: 'END BOX',
  0x8b: 'START BOX',
  0x8c: 'NORMAL HEIGHT',
  0x8d: 'DOUBLE HEIGHT',
  0x91: 'GRAPHICS RED',
  0x92: 'GRAPHICS GREEN',
  0x93: 'GRAPHICS YELLOW',
  0x94: 'GRAPHICS BLUE',
  0x95: 'GRAPHICS MAGENTA',
  0x96: 'GRAPHICS CYAN',
  0x97: 'GRAPHICS WHITE',
  0x98: 'CONCEAL',
  0x99: 'CONTIGUOUS',
  0x9a: 'SEPARATED',
  0x9c: 'BLACK BACKGROUND',
  0x9d: 'NEW BACKGROUND',
  0x9e: 'HOLD GRAPHICS',
  0x9f: 'RELEASE GRAPHICS',
};

/** Normalised teletext name -> code (upper case, single-spaced). */
const teletextByName = new Map<string, number>(
  Object.entries(TELETEXT_NAMES).map(([code, name]) => [name, Number(code)]),
);

/** The `{0xNN}` raw-byte escape for a code with no printable/named form. */
function rawByte(code: number): string {
  return `{0x${code.toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * The Unicode sextant for a MODE 7 mosaic byte, or undefined for any other
 * byte. A code is a mosaic iff bits 7 and 5 are both set (the SAA5050's
 * graphics flag is bit 5; bit-5-clear codes blast through as capitals), which
 * makes the range 0xA0–0xBF and 0xE0–0xFF. The six cells sit in bits 0–4 and
 * 6 - bit 5 is the flag, so bottom-right skips to bit 6 - and are unpermuted
 * into {@link sextantGlyph}'s contiguous pattern. The blank mosaic 0xA0 stays
 * escaped: its only faithful form is a space, which 0x20 owns.
 */
export function mosaicChar(code: number): string | undefined {
  if ((code & 0xa0) !== 0xa0 || code === 0xa0) return undefined;
  return sextantGlyph((code & 0x1f) | ((code & 0x40) >> 1));
}

// The forward map (sextant -> mosaic byte), built from the same function so
// the two directions cannot drift apart.
const GLYPH_TO_CODE = new Map<string, number>();
for (let code = 0xa1; code <= 0xff; code++) {
  const glyph = mosaicChar(code);
  if (glyph !== undefined) GLYPH_TO_CODE.set(glyph, code);
}

/** The plain editor character for a code, or undefined if it needs an escape. */
export function plainChar(code: number): string | undefined {
  if (code === POUND) return '£';
  if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
  return mosaicChar(code);
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const raw = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  if (raw) return parseInt(raw[1]!, 16);
  const name = content.trim().replace(/\s+/g, ' ').toUpperCase();
  const code = teletextByName.get(name);
  return code === undefined ? null : code;
}

/**
 * Parse one editor unit - a character, an astral mosaic sextant or a `{...}`
 * escape - starting at index i. Returns the machine byte(s) it encodes and
 * the number of source *code units* consumed. Used inside string / REM /
 * DATA / `*`-command literals; the tokenizer's expression path stays
 * per-character (via {@link bbcCharset.toMachine}), so escapes are not
 * recognised there.
 */
export function parseChar(
  text: string,
  i: number,
): { codes: number[]; length: number } {
  if (text[i] === '{') {
    const close = text.indexOf('}', i + 1);
    if (close !== -1) {
      const code = parseEscape(text.slice(i + 1, close));
      if (code !== null) return { codes: [code], length: close + 1 - i };
    }
    // Not an escape: fall through to a literal '{' (0x7B).
  }
  // Read a full code point: the mosaic sextants live in the astral plane.
  const ch = String.fromCodePoint(text.codePointAt(i)!);
  if (ch === '£' || ch === '`') return { codes: [POUND], length: 1 };
  const mosaic = GLYPH_TO_CODE.get(ch);
  if (mosaic !== undefined) return { codes: [mosaic], length: ch.length };
  const code = ch.charCodeAt(0);
  if (ch.length !== 1 || code < 0x20 || code > 0x7e) {
    throw new CharsetError(
      `Character ${JSON.stringify(ch)} has no BBC Micro equivalent`,
      i,
    );
  }
  return { codes: [code], length: 1 };
}

/**
 * Decode one machine byte in a literal context (string / REM / DATA / `*`) to
 * editor text, never reading at or past `end`. Every byte becomes something
 * {@link parseChar} maps back to the same byte, so decode → tokenize is
 * byte-exact: teletext codes become named escapes, mosaics become their
 * sextants, other non-printables become `{0xNN}`, and a literal `{` that
 * would otherwise read as an escape is itself escaped. Always advances one
 * byte (BBC escapes carry no operands).
 */
export function decodeSpan(
  bytes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = bytes[i]!;
  const name = TELETEXT_NAMES[b];
  if (name !== undefined) return { text: `{${name}}`, length: 1 };
  if (b === OPEN_BRACE) {
    // If the bytes ahead happen to read as an escape, escape this brace so the
    // text still round-trips byte-exactly.
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

export const bbcCharset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < text.length) {
      if (text[i] === '\n') {
        out.push(0x0a);
        i++;
        continue;
      }
      const { codes, length } = parseChar(text, i);
      for (const b of codes) out.push(b);
      i += length;
    }
    return Uint8Array.from(out);
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    let i = 0;
    while (i < codes.length) {
      const code = codes[i]!;
      if (code === 0x0a || code === 0x0d) {
        text += '\n';
        i++;
        continue;
      }
      const { text: t, length } = decodeSpan(codes, i, codes.length);
      text += t;
      i += length;
    }
    return text;
  },

  glyph(code: number): string {
    return plainChar(code) ?? '?';
  },
};
