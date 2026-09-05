// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';

/**
 * The MSX International character set - the one every European and American
 * MSX draws, as against the Japanese set with katakana at 0xA1-0xDF.
 *
 * 0x20-0x7E is ASCII exactly. 0x80-0xBF carries the accented letters and
 * currency symbols (including the Dutch ĳ and the Hungarian ű the
 * international set is unusual for having), 0xC0-0xDF the block graphics, and
 * 0xE0-0xFF Greek letters and mathematical symbols. Codes with a stable
 * Unicode form map to it and everything else uses a `{0xNN}` escape, so an
 * imported program stays byte-exact; a `{...}` matching no escape is literal
 * text, the machine having real `{`/`}` at 0x7B/0x7D.
 *
 * **The graphic header.** Codes 0x00-0x1F are control codes when printed, so
 * the machine reaches their *glyphs* through a two-byte sequence: 0x01
 * followed by the code plus 0x40. That is a fact about how a string holds a
 * character rather than about the keyboard, so both directions of this
 * charset carry it - a graphic character is one editor character and two
 * program bytes. A code in that range whose shape has no citable Unicode form
 * spells as the pair of escapes `{0x01}` and its second byte, which round-trips
 * for the same reason the single escapes do.
 */

/** Unicode forms for the upper half, 0x80-0xFF. */
export const MSX_GLYPHS: Record<number, string> = {
  // 0x80-0x9F: accented letters and currency, the first two rows of the
  // international set.
  0x80: 'Ç',
  0x81: 'ü',
  0x82: 'é',
  0x83: 'â',
  0x84: 'ä',
  0x85: 'à',
  0x86: 'å',
  0x87: 'ç',
  0x88: 'ê',
  0x89: 'ë',
  0x8a: 'è',
  0x8b: 'ï',
  0x8c: 'î',
  0x8d: 'ì',
  0x8e: 'Ä',
  0x8f: 'Å',
  0x90: 'É',
  0x91: 'æ',
  0x92: 'Æ',
  0x93: 'ô',
  0x94: 'ö',
  0x95: 'ò',
  0x96: 'û',
  0x97: 'ù',
  0x98: 'ÿ',
  0x99: 'Ö',
  0x9a: 'Ü',
  0x9b: '¢',
  0x9c: '£',
  0x9d: '¥',
  0x9e: '₧',
  0x9f: 'ƒ',
  // 0xA0-0xBF: more accents, the fractions, and the punctuation Spanish,
  // Portuguese, Dutch and Hungarian need.
  0xa0: 'á',
  0xa1: 'í',
  0xa2: 'ó',
  0xa3: 'ú',
  0xa4: 'ñ',
  0xa5: 'Ñ',
  0xa6: 'ª',
  0xa7: 'º',
  0xa8: '¿',
  0xa9: '⌐',
  0xaa: '¬',
  0xab: '½',
  0xac: '¼',
  0xad: '¡',
  0xae: '«',
  0xaf: '»',
  0xb0: 'Ã',
  0xb1: 'ã',
  0xb2: 'Ĩ',
  0xb3: 'ĩ',
  0xb4: 'Õ',
  0xb5: 'õ',
  0xb6: 'Ű',
  0xb7: 'ű',
  0xb8: 'Ĳ',
  0xb9: 'ĳ',
  0xba: '¾',
  0xbb: '∽',
  0xbc: '◊',
  0xbd: '‰',
  0xbe: '¶',
  0xbf: '§',
  // 0xC0-0xDF: the block graphics. Bars, quadrants, dithers and the four
  // triangles; the shapes Unicode covers only in Symbols for Legacy Computing
  // are astral, so each is a surrogate pair and {@link parseChar} reads whole
  // code points.
  0xc0: '▂',
  0xc1: '▚',
  0xc2: '▆',
  0xc3: '\u{1FB82}', // upper one quarter block
  0xc4: '▬',
  0xc5: '\u{1FB85}', // upper three quarters block
  0xc6: '▎',
  0xc7: '▞',
  0xc8: '▊',
  0xc9: '\u{1FB87}', // right one quarter block
  0xca: '\u{1FB8A}', // right three quarters block
  0xcb: '\u{1FB99}', // upper right to lower left fill
  0xcc: '\u{1FB98}', // upper left to lower right fill
  0xcd: '\u{1FB6D}', // upper triangular one quarter block
  0xce: '\u{1FB6F}', // lower triangular one quarter block
  0xcf: '\u{1FB6C}', // left triangular one quarter block
  0xd0: '\u{1FB6E}', // right triangular one quarter block
  0xd1: '\u{1FB9A}', // upper and lower triangular half block
  0xd2: '\u{1FB9B}', // left and right triangular half block
  0xd3: '▘',
  0xd4: '▗',
  0xd5: '▝',
  0xd6: '▖',
  0xd7: '\u{1FB96}', // inverse chequerboard fill
  0xd8: 'Δ',
  0xd9: '‡',
  0xda: 'ω',
  0xdb: '█',
  0xdc: '▄',
  0xdd: '▌',
  0xde: '▐',
  0xdf: '▀',
  // 0xE0-0xFF: Greek and mathematics.
  0xe0: 'α',
  0xe1: 'ß',
  0xe2: 'Γ',
  0xe3: 'π',
  0xe4: 'Σ',
  0xe5: 'σ',
  0xe6: 'µ',
  0xe7: 'τ',
  0xe8: 'Φ',
  0xe9: 'Θ',
  0xea: 'Ω',
  0xeb: 'δ',
  0xec: '∞',
  0xed: '⌀',
  0xee: '∈',
  0xef: '∩',
  0xf0: '≡',
  0xf1: '±',
  0xf2: '≥',
  0xf3: '≤',
  0xf4: '⌠',
  0xf5: '⌡',
  0xf6: '÷',
  0xf7: '≈',
  0xf8: '°',
  0xf9: '∙',
  0xfa: '·',
  0xfb: '√',
  0xfc: 'ⁿ',
  0xfd: '²',
  0xfe: '■',
  // 0xFF is the cursor cell, which has no character to stand for it; it keeps
  // its escape, as the blank graphic does on the Spectrum and the CPC.
};

/** The byte a graphic character's second byte carries: the code plus 0x40. */
const GRAPHIC_HEADER = 0x01;
const GRAPHIC_BIAS = 0x40;

/**
 * Unicode forms for the codes below 0x20, which a string can only hold behind
 * the graphic header. Only the four cursor arrows have a shape the published
 * character set names; the rest of the range spells as escapes until the
 * character generator says what it draws.
 */
export const MSX_GRAPHIC_GLYPHS: Record<number, string> = {
  0x11: '⇨',
  0x12: '⇦',
  0x13: '⇧',
  0x14: '⇩',
};

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** Unicode form -> machine code, for the single-byte half of the set. */
const codeByGlyph = new Map<string, number>();
for (const [code, glyph] of Object.entries(MSX_GLYPHS)) {
  codeByGlyph.set(glyph, Number(code));
}

/** Unicode form -> the code its graphic-header pair stands for. */
const graphicByGlyph = new Map<string, number>();
for (const [code, glyph] of Object.entries(MSX_GRAPHIC_GLYPHS)) {
  graphicByGlyph.set(glyph, Number(code));
}

/** The `{0xNN}` raw-byte escape for a code with no plain form. */
function rawByte(code: number): string {
  return `{0x${code.toString(16).padStart(2, '0').toUpperCase()}}`;
}

/** The plain editor character for a code, or undefined if it needs an escape. */
export function plainChar(code: number): string | undefined {
  if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
  return MSX_GLYPHS[code];
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const raw = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  return raw ? parseInt(raw[1]!, 16) : null;
}

/**
 * Parse one editor unit - a character, a graphic character or a `{0xNN}`
 * escape - starting at index i. Returns the machine byte(s) it encodes and the
 * number of source characters consumed. Used inside string / REM / DATA
 * literals; the tokenizer's expression path stays per-character (via
 * {@link hb10pCharset.toMachine}), so escapes are not recognised there.
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
  // A whole code point, not a UTF-16 unit: the Legacy Computing shapes in
  // 0xC0-0xD7 are astral, so each is a surrogate pair.
  const ch = String.fromCodePoint(text.codePointAt(i)!);
  const mapped = codeByGlyph.get(ch);
  if (mapped !== undefined) return { codes: [mapped], length: ch.length };
  const graphic = graphicByGlyph.get(ch);
  if (graphic !== undefined) {
    return {
      codes: [GRAPHIC_HEADER, graphic + GRAPHIC_BIAS],
      length: ch.length,
    };
  }
  const code = ch.charCodeAt(0);
  if (ch.length !== 1 || code < 0x20 || code > 0x7e) {
    throw new CharsetError(
      `Character ${JSON.stringify(ch)} has no MSX equivalent`,
      i,
    );
  }
  return { codes: [code], length: 1 };
}

/**
 * Decode machine bytes from index i in a literal context (string / REM / DATA)
 * to editor text, never reading at or past `end`. Every byte becomes something
 * {@link parseChar} maps back to the same byte, so decode -> tokenize is
 * byte-exact. A graphic header and its partner decode as one character where
 * the shape is known; otherwise the header decodes alone as an escape and its
 * partner decodes as the ordinary character it also is.
 */
export function decodeSpan(
  bytes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = bytes[i]!;
  if (b === GRAPHIC_HEADER && i + 1 < end) {
    const glyph = MSX_GRAPHIC_GLYPHS[bytes[i + 1]! - GRAPHIC_BIAS];
    if (glyph !== undefined) return { text: glyph, length: 2 };
  }
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

export const hb10pCharset: CharsetMapping = {
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
      const { text: t, length } = decodeSpan(codes, i, codes.length);
      text += t;
      i += length;
    }
    return text;
  },

  glyph(code: number): string {
    return plainChar(code) ?? MSX_GRAPHIC_GLYPHS[code] ?? '?';
  },
};
