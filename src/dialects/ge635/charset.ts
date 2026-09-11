// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';

/**
 * The GE-635's character codes, which are **ASCII** rather than the GE-235's
 * six-bit BCD.
 *
 * Section 2.7 prints the table itself, as the codes `CHANGE` moves between a
 * string and a numeric vector: space is 32, `!` 33, `"` 34 and on up in one
 * unbroken run, with `A` at 65 - the section's own worked example reads the
 * vector 5, 65, 66, 67, 68, 69 and prints `ABCDE`. The same page states the
 * width: "there are 128 characters numbered 0 through 127". Section 2.9
 * corroborates it from the other side, counting a program's characters as
 * `C/4` - four to a thirty-six-bit word, so nine bits each; six-bit BCD would
 * pack six to a word.
 *
 * Two readings of that table are worth spelling out, because the scan is not
 * crisp at either:
 *
 *  - **94 is the up arrow.** The manual's table ends there, and the paragraph
 *    under it introduces 95 as "(backward arrow)" among the "additional
 *    symbols useful on output". 94 and 95 are the pair the ASR-33 prints where
 *    a later ASCII has `^` and `_`, and the up arrow is this BASIC's exponent
 *    operator (section 1.2), so it is the character the table's last slot must
 *    hold. That is read off the position and the language rather than off a
 *    legible glyph, which is why it is argued here rather than asserted.
 *  - **There is no lower case.** The terminals are Teletype models 33 and 35
 *    (Appendix A), which have one alphabet, and the manual says as much of the
 *    codes it does not list: "some are for teletypes with upper and lower case
 *    letters". So the mapping folds `a`-`z` onto the letter codes and decodes
 *    them back as capitals.
 *
 * Codes outside 32-95 are written as a `{0xNN}` escape rather than dropped, so
 * decoding a tape and encoding it again returns the same bytes. Hexadecimal
 * rather than the GE-235's octal, even though this manual's own table is
 * decimal: the escape is the one every ASCII machine here writes - the
 * Altair's teletype tapes read the same way - and a machine's notation is
 * worth more shared than individually apt.
 */

/** The lowest code the Teletype prints: the space. */
const FIRST_GLYPH = 32;

/** The highest code the manual's table gives a character to. */
const LAST_GLYPH = 95;

/**
 * The two codes whose characters are the ASR-33's rather than a modern
 * terminal's. Everything else in 32-95 is its own ASCII character.
 */
const ARROWS: Readonly<Record<number, string>> = { 94: '↑', 95: '←' };

/**
 * The codes the paper acts on rather than prints, as far as the manual names
 * them. A carriage return moves the carriage and a line feed advances the
 * paper: two mechanisms on a teletype, and a program that sends one without
 * the other overprints or steps down a column.
 *
 * Section 2.7 lists these five under "additional symbols useful on output".
 * What it does **not** name is a tab code, a tape fill and an end-of-tape
 * marker - the three remaining slots of the shared interpreter's
 * `DartmouthCharset`. The GE-235 has all three because its compiler listing
 * names them; here the manual is silent, and the silence is left standing for
 * the stage that wires the profile to answer rather than filled in with a
 * plausible ASCII code.
 */

/** End of transmission, which section 2.7 says "turns off the teletype". */
export const EOT = 4;

/** The bell, which strikes a gong and prints nothing. */
export const BELL = 7;

/** Line feed: advances the paper without returning the carriage. */
export const LF = 10;

/** Carriage return: returns the carriage without advancing the paper. */
export const CR = 13;

/** Rub-out, which section 2.7 marks "(tape use only)". */
export const RUBOUT = 127;

/** The space code, and the first printing code in the table. */
export const SPACE = 32;

/**
 * The character one code prints as, or undefined for a code the Teletype
 * strikes nothing for.
 */
export function plainChar(code: number): string | undefined {
  const c = code & 0x7f;
  if (c < FIRST_GLYPH || c > LAST_GLYPH) return undefined;
  return ARROWS[c] ?? String.fromCharCode(c);
}

/** Character -> code, built from {@link plainChar} so the two cannot drift. */
const CODES = new Map<string, number>(
  Array.from({ length: LAST_GLYPH - FIRST_GLYPH + 1 }, (_, i) => {
    const code = FIRST_GLYPH + i;
    return [plainChar(code)!, code] as const;
  }),
);

/** The `{0xNN}` escape for a code with no printable form. */
function rawCode(code: number): string {
  return `{0x${(code & 0x7f).toString(16).toUpperCase().padStart(2, '0')}}`;
}

/** Parse the content of a `{...}` escape to a code; null if it isn't one. */
function parseEscape(content: string): number | null {
  const m = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  if (!m) return null;
  const code = parseInt(m[1]!, 16);
  return code <= 0x7f ? code : null;
}

/**
 * Parse one editor unit - a character or a `{0xNN}` escape - starting at index
 * `i`, returning the code it encodes and how many source characters it took.
 * Lower case folds onto the capital: the machine has one alphabet.
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
    // `{` is not a GE-635 character, so a malformed escape is not literal text
    // to fall back on - it is unmappable, and reaches the error below.
  }
  // Read a whole code point, so an astral character reports one error not two.
  const cp = String.fromCodePoint(text.codePointAt(i)!);
  const code = CODES.get(cp.toUpperCase());
  if (code !== undefined) return { code, length: cp.length };
  throw new CharsetError(
    `Character ${JSON.stringify(cp)} has no GE-635 equivalent`,
    i,
  );
}

/**
 * Decode one code to editor text. Always advances one code - no escape here
 * carries an operand - and every code decodes to something {@link parseChar}
 * maps back to it, so decode -> encode is exact.
 */
export function decodeSpan(
  codes: ArrayLike<number>,
  i: number,
): { text: string; length: number } {
  const code = codes[i]! & 0x7f;
  return { text: plainChar(code) ?? rawCode(code), length: 1 };
}

export const ge635Charset: CharsetMapping = {
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
    for (let i = 0; i < codes.length; i++) text += decodeSpan(codes, i).text;
    return text;
  },

  glyph(code: number): string {
    // A single-character display form for debug and status readouts, not the
    // round-trip path (that is toUnicode/decodeSpan): a code the Teletype
    // cannot print shows as a space.
    return plainChar(code) ?? ' ';
  },
};
