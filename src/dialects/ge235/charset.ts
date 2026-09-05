// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type CharsetMapping } from '../types';

/**
 * The GE-235's 6-bit BCD character set - 64 codes, three to a 20-bit word in
 * the low 18 bits.
 *
 * The table is the compiler's own. `BA-3` carries two tables side by side: `s2`
 * translates an incoming BCD code to the compiler's internal code and is
 * indexed by the BCD code itself, and `s` classifies an internal code and
 * names the character each one is. Reading them together fixes all 64 codes,
 * and the packed literals elsewhere in the source confirm the reading - the
 * error messages end `oct 0606037` (space, space, carriage return) and
 * `oct 0623337` ("s", ".", carriage return).
 *
 * The zone layout is classic 6-bit BCD, which is why the letters come in three
 * runs rather than one: `a`-`i` at 0o21, `j`-`r` at 0o41, `s`-`z` at 0o62, with
 * `+`, `-` and space opening the three zones above the digits.
 *
 * Two things a reader coming from any other machine here will trip on:
 *
 *  - **There is no lower case.** The ASR-33 has one case, so the mapping folds
 *    `a`-`z` onto the letter codes and decodes them back as capitals. The 1965
 *    compiler listing is written in lower case for the same reason - the
 *    printer had only one alphabet and it did not matter which one you called
 *    it.
 *  - **Brackets and parentheses are different characters** on the tape (0o75 /
 *    0o76 against 0o14 / 0o74) even though the compiler folds them together and
 *    accepts either as a subscript bracket.
 *
 * Seven codes have no printable form: 0o32 bell, 0o37 carriage return, 0o52
 * tab, 0o55 end of message, 0o72 line feed, 0o77 fill, and 0o12, which `s`
 * marks unusable in a program. Each is written as a `{0oNN}` escape - octal,
 * because this machine is octal everywhere else - and the braces cost nothing
 * to reserve, since neither `{` nor `}` is a GE-235 character.
 *
 * The mapping is total and injective: every code 0o00-0o77 has exactly one text
 * form, and that form encodes back to the same code.
 */

/**
 * BCD code -> the character the Teletype prints, `undefined` where it prints
 * none. Indexed by the code, so the array *is* the table.
 */
const GLYPHS: readonly (string | undefined)[] = [
  // 0o00-0o07
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  // 0o10-0o17
  '8',
  '9',
  undefined, // 0o12 - reaches the compiler as an internal code `s` rejects
  ':',
  '(',
  ';',
  '=',
  '\\',
  // 0o20-0o27
  '+',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  // 0o30-0o37
  'H',
  'I',
  undefined, // 0o32 bell
  '.',
  '"',
  '?',
  '<',
  undefined, // 0o37 carriage return
  // 0o40-0o47
  '-',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  // 0o50-0o57
  'Q',
  'R',
  undefined, // 0o52 tab
  '$',
  '*',
  undefined, // 0o55 end of message
  '>',
  '↑',
  // 0o60-0o67
  ' ',
  '/',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  // 0o70-0o77
  'Y',
  'Z',
  undefined, // 0o72 line feed
  ',',
  ')',
  '[',
  ']',
  undefined, // 0o77 fill
];

/** Carriage return: the code that ends a line on the paper tape. */
export const CR = 0o37;

/** End of message: the code that ends the whole tape. */
export const EOM = 0o55;

/** The space code, which the compiler deletes outside a string literal. */
export const SPACE = 0o60;

/** Character -> BCD code, built from {@link GLYPHS} so the two cannot drift. */
const CODES = new Map<string, number>(
  GLYPHS.flatMap((glyph, code) => (glyph === undefined ? [] : [[glyph, code]])),
);

/** The `{0oNN}` escape for a code with no printable form. */
function rawCode(code: number): string {
  return `{0o${(code & 0o77).toString(8).padStart(2, '0')}}`;
}

/**
 * The plain editor character for a code the Teletype can print, or undefined
 * for one written as a {@link rawCode} escape instead.
 */
export function plainChar(code: number): string | undefined {
  return GLYPHS[code & 0o77];
}

/** Parse the content of a `{...}` escape to a code; null if it isn't one. */
function parseEscape(content: string): number | null {
  const m = /^0o([0-7]{2})$/.exec(content);
  return m ? parseInt(m[1]!, 8) : null;
}

/**
 * Parse one editor unit - a character or a `{0oNN}` escape - starting at index
 * `i`, returning the BCD code it encodes and how many source characters it
 * consumed. Lower case folds onto the capital: the machine has one alphabet.
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
    // No `{` character exists on this machine, so a malformed escape is not
    // literal text the way the Altair's is - it is simply unmappable, and falls
    // through to the error below.
  }
  // Read a whole code point, so an astral character reports one error not two.
  const cp = String.fromCodePoint(text.codePointAt(i)!);
  const code = CODES.get(cp.toUpperCase());
  if (code !== undefined) return { code, length: cp.length };
  throw new CharsetError(
    `Character ${JSON.stringify(cp)} has no GE-235 equivalent`,
    i,
  );
}

/**
 * Decode one BCD code to editor text. Always advances one code (no escape here
 * carries an operand), and every code decodes to something {@link parseChar}
 * maps back to it, so decode -> encode is exact.
 */
export function decodeSpan(
  codes: ArrayLike<number>,
  i: number,
): { text: string; length: number } {
  const code = codes[i]! & 0o77;
  return { text: plainChar(code) ?? rawCode(code), length: 1 };
}

export const ge235Charset: CharsetMapping = {
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
    // A single-character display form for debug/status readouts, not the
    // round-trip path (that is toUnicode/decodeSpan): a code the Teletype
    // cannot print shows as a space.
    return plainChar(code) ?? ' ';
  },
};
