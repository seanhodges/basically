import { CharsetError, type CharsetMapping } from '../types';

/**
 * The Amstrad CPC 256-glyph character set, shared by the CPC 464 and 6128.
 *
 * 32-126 is near-ASCII with one deviation: code 0x5E displays as an up arrow
 * (↑) on the CPC. The editor accepts both '↑' and '^' for it and shows '↑'
 * (the power *operator* is a keyword token, so expressions still read `2^8`).
 *
 * The upper half (0x80-0xFF) is the CPC's block-graphics / box-drawing /
 * symbol range; codes with a stable BMP Unicode form map to it, and the rest
 * - along with the control range 0x00-0x1F, whose codes act as control
 * characters when printed - use `{0xNN}` escapes so imported programs stay
 * byte-exact. A `{...}` matching no escape is literal text (the CPC has real
 * `{`/`}` characters at 0x7B/0x7D). Escapes are only recognised inside
 * string / REM / DATA literals; the tokenizer's expression path stays
 * per-character. `npm run gen:escapes` scaffolds the published escape table; the glyph forms follow the CPC firmware manual's character
 * set as tabulated on Wikipedia's "Amstrad CPC character set".
 */
const UP_ARROW = 0x5e;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/**
 * Unicode forms for the upper-half codes. Every graphics code has one except
 * 0x80, a blank cell whose only text form would be a space - and the charset is
 * injective, so the space already spoken for by 0x20 cannot serve two bytes.
 * That single code is left to a `{0xNN}` escape, as the Spectrum's blank
 * graphic is.
 *
 * The shapes drawn from Symbols for Legacy Computing are astral, so they are
 * surrogate pairs in a JS string; {@link parseChar} reads whole code points for
 * that reason.
 */
export const CPC_GLYPHS: Record<number, string> = {
  // 0x81-0x8F: 2x2 quadrant mosaic (bit0 = top-left, bit1 = top-right,
  // bit2 = bottom-left, bit3 = bottom-right).
  0x81: '▘',
  0x82: '▝',
  0x83: '▀',
  0x84: '▖',
  0x85: '▌',
  0x86: '▞',
  0x87: '▛',
  0x88: '▗',
  0x89: '▚',
  0x8a: '▐',
  0x8b: '▜',
  0x8c: '▄',
  0x8d: '▙',
  0x8e: '▟',
  0x8f: '█',
  // 0x90-0x9F: dot and box-drawing segments.
  0x90: '·',
  0x91: '╵',
  0x92: '╶',
  0x93: '└',
  0x94: '╷',
  0x95: '│',
  0x96: '┌',
  0x97: '├',
  0x98: '╴',
  0x99: '┘',
  0x9a: '─',
  0x9b: '┴',
  0x9c: '┐',
  0x9d: '┤',
  0x9e: '┬',
  0x9f: '┼',
  // 0xA1-0xAF: accents and symbols (0xA0 is a circumflex glyph - escaped, so
  // the ASCII '^' input form stays unambiguous with 0x5E).
  0xa1: '´',
  0xa2: '¨',
  0xa3: '£',
  0xa4: '©',
  0xa5: '¶',
  0xa6: '§',
  0xa7: '’',
  0xa8: '¼',
  0xa9: '½',
  0xaa: '¾',
  0xab: '±',
  0xac: '÷',
  0xad: '¬',
  0xae: '¿',
  0xaf: '¡',
  // 0xB0-0xBF: Greek.
  0xb0: 'α',
  0xb1: 'β',
  0xb2: 'γ',
  0xb3: 'δ',
  0xb4: 'ε',
  0xb5: 'θ',
  0xb6: 'λ',
  0xb7: 'μ',
  0xb8: 'π',
  0xb9: 'σ',
  0xba: 'φ',
  0xbb: 'ψ',
  0xbc: 'χ',
  0xbd: 'ω',
  0xbe: 'Σ',
  0xbf: 'Ω',
  // 0xC0-0xCA: the diamond construction kit. 0xC0-0xC3 are the four diagonal
  // edges of a diamond and 0xC4-0xCA are unions of them, which is exactly how
  // Unicode's U+1FBA0-U+1FBAE family is defined; ./charsetRom.test.ts derives
  // the edges from the ROM and asserts each composite is their union.
  0xc0: '\u{1FBA0}', // NW: upper centre to middle left
  0xc1: '\u{1FBA1}', // NE: upper centre to middle right
  0xc2: '\u{1FBA3}', // SE: middle right to lower centre
  0xc3: '\u{1FBA2}', // SW: middle left to lower centre
  0xc4: '\u{1FBA7}', // NW+NE
  0xc5: '\u{1FBA5}', // NE+SE
  0xc6: '\u{1FBA6}', // SE+SW
  0xc7: '\u{1FBA4}', // NW+SW
  0xc8: '\u{1FBA8}', // NW+SE
  0xc9: '\u{1FBA9}', // NE+SW
  0xca: '\u{1FBAE}', // all four: the whole diamond
  // 0xCB-0xDF: diagonals, shades and eighth blocks.
  0xcb: '╳',
  0xcc: '╱',
  0xcd: '╲',
  0xce: '\u{1FB95}', // 2x2 chequerboard, twice the pitch of 0xCF
  0xcf: '▒',
  0xd0: '▔',
  0xd1: '▕',
  0xd2: '▁',
  0xd3: '▏',
  0xd4: '◤',
  0xd5: '◥',
  0xd6: '◢',
  0xd7: '◣',
  // 0xD8-0xDF: the same chequer dither as 0xCF, masked to half the cell and
  // then to each corner triangle. 0xD8/0xDA are byte-identical in the ROM to
  // ZX81 0x0A/0x09, which zx81/charset.ts already maps to these characters.
  0xd8: '\u{1FB8E}', // upper half medium shade
  0xd9: '\u{1FB8D}', // right half medium shade
  0xda: '\u{1FB8F}', // lower half medium shade
  0xdb: '\u{1FB8C}', // left half medium shade
  0xdc: '\u{1FB9C}', // upper left triangular medium shade
  0xdd: '\u{1FB9D}', // upper right triangular medium shade
  0xde: '\u{1FB9E}', // lower right triangular medium shade
  0xdf: '\u{1FB9F}', // lower left triangular medium shade
  // 0xE0-0xF7: pictographs, suits and arrows.
  0xe0: '☺',
  0xe1: '☹',
  0xe2: '♣',
  0xe3: '♦',
  0xe4: '♥',
  0xe5: '♠',
  0xe6: '○',
  0xe7: '●',
  0xe8: '□',
  0xe9: '■',
  0xea: '♂',
  0xeb: '♀',
  0xec: '♩',
  0xed: '♪',
  0xee: '☼',
  0xf0: '⭡',
  0xf1: '⭣',
  0xf2: '⭠',
  0xf3: '⭢',
  0xf4: '▲',
  0xf5: '▼',
  0xf6: '▶',
  0xf7: '◀',
};

/** Unicode form -> machine code, plus accepted input alternates. */
const codeByGlyph = new Map<string, number>();
for (const [code, glyph] of Object.entries(CPC_GLYPHS)) {
  codeByGlyph.set(glyph, Number(code));
}
codeByGlyph.set('↑', UP_ARROW);

/** The `{0xNN}` raw-byte escape for a code with no plain form. */
function rawByte(code: number): string {
  return `{0x${code.toString(16).padStart(2, '0').toUpperCase()}}`;
}

/** The plain editor character for a code, or undefined if it needs an escape. */
export function plainChar(code: number): string | undefined {
  if (code === UP_ARROW) return '↑';
  if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
  return CPC_GLYPHS[code];
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const raw = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  return raw ? parseInt(raw[1]!, 16) : null;
}

/**
 * Parse one editor unit - a character or a `{0xNN}` escape - starting at
 * index i. Returns the machine byte(s) it encodes and the number of source
 * characters consumed. Used inside string / REM / DATA literals; the
 * tokenizer's expression path stays per-character (via
 * {@link cpcCharset.toMachine}), so escapes are not recognised there.
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
  // A whole code point, not a UTF-16 unit: the Legacy Computing shapes at
  // 0xC0-0xCA and 0xD8-0xDF are astral, so each is a surrogate pair.
  const ch = String.fromCodePoint(text.codePointAt(i)!);
  const mapped = codeByGlyph.get(ch);
  if (mapped !== undefined) return { codes: [mapped], length: ch.length };
  if (ch === '^') return { codes: [UP_ARROW], length: 1 };
  const code = ch.charCodeAt(0);
  if (ch.length !== 1 || code < 0x20 || code > 0x7e) {
    throw new CharsetError(
      `Character ${JSON.stringify(ch)} has no Amstrad CPC equivalent`,
      i,
    );
  }
  return { codes: [code], length: 1 };
}

/**
 * Decode one machine byte in a literal context (string / REM / DATA) to
 * editor text, never reading at or past `end`. Every byte becomes something
 * {@link parseChar} maps back to the same byte, so decode → tokenize is
 * byte-exact: codes without a glyph form become `{0xNN}`, and a literal `{`
 * that would otherwise read as an escape is itself escaped. Always advances
 * one byte (CPC escapes carry no operands).
 */
export function decodeSpan(
  bytes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = bytes[i]!;
  if (b === OPEN_BRACE) {
    // If the bytes ahead happen to read as an escape, escape this brace so
    // the text still round-trips byte-exactly.
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

export const cpcCharset: CharsetMapping = {
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
