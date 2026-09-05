// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';
import { plainChar } from './charset';
import { T } from './keywords';

/**
 * What `LIST` prints for each token.
 *
 * Several tokens share a spelling because they record which grammar rule
 * matched rather than which word was typed - `,` has eight bytes and `(` six -
 * so this table is many-to-one in exactly the way the interpreter's own decoder
 * is. The spacing is this decoder's own: the machine's `LIST` pads differently,
 * but what matters is that the text re-tokenizes to the same bytes, which
 * `tokenizer.test.ts` pins for every construct.
 *
 * Entries that a program cannot legally contain - the direct-mode commands, the
 * vestigial graphics statements, the unreachable `RNDX` - are still decoded, so
 * an imported image says what it holds instead of losing bytes.
 */
const TOKEN_TEXT: Record<number, string> = {
  [T.COLON]: ':',
  [T.LIST_RANGE]: 'LIST ',
  [T.LIST_COMMA]: ',',
  [T.LIST]: 'LIST',
  [T.RUN_LINE]: 'RUN ',
  [T.RUN]: 'RUN',
  [T.DEL]: 'DEL ',
  [T.DEL_COMMA]: ',',
  [T.SCR]: 'SCR',
  [T.CLR]: 'CLR',
  [T.AUTO]: 'AUTO ',
  [T.AUTO_COMMA]: ',',
  [T.OFF]: 'OFF',
  [T.HIMEM_SET]: 'HIMEM=',
  [T.LOMEM_SET]: 'LOMEM=',

  [T.ADD]: '+',
  [T.SUB]: '-',
  [T.MUL]: '*',
  [T.DIV]: '/',
  [T.EQ]: '=',
  [T.NE_HASH]: '#',
  [T.GE]: '>=',
  [T.GT]: '>',
  [T.LE]: '<=',
  [T.NE_ANGLE]: '<>',
  [T.LT]: '<',
  [T.AND]: ' AND ',
  [T.OR]: ' OR ',
  [T.MOD]: ' MOD ',
  [T.POW]: '^',

  [T.DIM_STR_LPAREN]: '(',
  [T.SUBSTR_COMMA]: ',',
  [T.THEN_LINE]: ' THEN ',
  [T.THEN_STMT]: ' THEN ',
  [T.INPUT_COMMA_STR]: ',',
  [T.INPUT_COMMA_NUM]: ',',
  [T.QUOTE_OPEN]: '"',
  [T.QUOTE_CLOSE]: '"',
  [T.SUBSTR_LPAREN]: '(',
  0x2b: '!',
  0x2c: '!',
  [T.ARRAY_LPAREN]: '(',

  [T.PEEK]: 'PEEK',
  [T.RND]: 'RND',
  [T.SGN]: 'SGN',
  [T.ABS]: 'ABS',
  [T.USR]: 'USR',
  0x33: 'RNDX',

  [T.DIM_NUM_LPAREN]: '(',
  [T.POS]: '+',
  [T.NEG]: '-',
  [T.NOT]: 'NOT ',
  [T.LPAREN]: '(',
  [T.STR_EQ]: '=',
  [T.STR_NE]: '#',
  [T.LEN]: 'LEN(',
  [T.COLOR_FN]: 'COLOR',
  [T.HIMEM_FN]: 'HIMEM',
  [T.LOMEM_FN]: 'LOMEM',
  [T.FN_LPAREN]: '(',
  [T.DOLLAR]: '$',
  0x41: '$',
  [T.STR_DEST_LPAREN]: '(',
  [T.DIM_COMMA_STR]: ',',
  [T.DIM_COMMA_NUM]: ',',
  [T.PRINT_SEMI_STR]: ';',
  [T.PRINT_SEMI_NUM]: ';',
  [T.PRINT_SEMI_END]: ';',
  [T.PRINT_COMMA_STR]: ',',
  [T.PRINT_COMMA_NUM]: ',',

  [T.CALL]: 'CALL ',
  [T.DIM_STR]: 'DIM ',
  [T.DIM_NUM]: 'DIM ',
  [T.TAB]: 'TAB ',
  [T.END]: 'END',
  [T.INPUT_STR]: 'INPUT ',
  [T.INPUT_PROMPT]: 'INPUT ',
  [T.INPUT_NUM]: 'INPUT ',
  [T.FOR]: 'FOR ',
  [T.FOR_EQ]: '=',
  [T.TO]: ' TO ',
  [T.STEP]: ' STEP ',
  [T.NEXT]: 'NEXT ',
  [T.NEXT_COMMA]: ',',
  [T.RETURN]: 'RETURN',
  [T.GOSUB]: 'GOSUB ',
  [T.REM]: 'REM',
  [T.LET]: 'LET ',
  [T.GOTO]: 'GOTO ',
  [T.IF]: 'IF ',
  [T.PRINT_STR]: 'PRINT ',
  [T.PRINT_NUM]: 'PRINT ',
  [T.PRINT]: 'PRINT',
  [T.POKE]: 'POKE ',
  [T.POKE_COMMA]: ',',
  [T.COLOR_SET]: 'COLOR=',
  [T.PLOT]: 'PLOT ',
  [T.PLOT_COMMA]: ',',
  [T.HLIN]: 'HLIN ',
  [T.HLIN_COMMA]: ',',
  [T.HLIN_AT]: ' AT ',
  [T.STR_ASSIGN]: '=',
  [T.NUM_ASSIGN]: '=',
  [T.RPAREN]: ')',
  0x73: ')',
};

/** One decoded line, plus where the next record starts. */
interface Decoded {
  text: string;
  next: number;
  warnings: string[];
}

/**
 * Decode one line record. The byte classes are the interpreter's own, taken
 * from its execute loop: `$00`-`$7F` is a token, `$80`-`$BF` introduces a
 * two-byte integer constant, and `$C0`-`$FF` opens a variable name that runs on
 * through every following byte with bit 7 set (which is how the digit in `A1`,
 * stored as `$B1`, belongs to the name rather than starting a constant).
 */
function decodeLine(image: Uint8Array, at: number): Decoded {
  const warnings: string[] = [];
  const length = image[at]!;
  const end = Math.min(at + length, image.length);
  const lineNo = image[at + 1]! | (image[at + 2]! << 8);
  let text = `${lineNo} `;
  let i = at + 3;
  let literal = false; // inside a string literal or a REM body

  while (i < end) {
    const b = image[i]!;
    if (b === T.EOL) {
      i++;
      break;
    }
    if (literal && b >= 0x80) {
      text +=
        plainChar(b) ?? `{0x${b.toString(16).padStart(2, '0').toUpperCase()}}`;
      i++;
      continue;
    }
    if (b < 0x80) {
      const word = TOKEN_TEXT[b];
      if (word === undefined) {
        warnings.push(
          `Unknown token $${b.toString(16).toUpperCase()} in line ${lineNo}`,
        );
        i++;
        continue;
      }
      text += word;
      // REM and an opening quote hand the rest of their span to the literal
      // decoder; the closing quote takes it back.
      if (b === T.REM || b === T.QUOTE_OPEN) literal = true;
      else if (b === T.QUOTE_CLOSE) literal = false;
      i++;
      continue;
    }
    if (b < 0xc0) {
      const value = (image[i + 1] ?? 0) | ((image[i + 2] ?? 0) << 8);
      text += String(value);
      i += 3;
      continue;
    }
    // A variable name: this byte and every bit-7 byte after it.
    while (i < end && image[i]! >= 0x80) {
      text += plainChar(image[i]!) ?? '?';
      i++;
    }
  }

  return { text, next: at + length, warnings };
}

/** Stored program bytes back to the listing LIST would print. */
export function detokenizeProgram(image: Uint8Array): string {
  return detokenizeProgramWithReport(image).source;
}

export function detokenizeProgramWithReport(
  image: Uint8Array,
): DetokenizeResult {
  const lines: string[] = [];
  const warnings: string[] = [];
  let at = 0;
  while (at < image.length) {
    const length = image[at]!;
    // A zero or over-long length is not a record: the program area ends here,
    // and anything after it is whatever the workspace happened to hold.
    if (length < 5 || at + length > image.length) {
      if (image.slice(at).some((b) => b !== 0))
        warnings.push(
          `${image.length - at} trailing bytes after the last line are not a program record`,
        );
      break;
    }
    const decoded = decodeLine(image, at);
    lines.push(decoded.text);
    warnings.push(...decoded.warnings);
    at = decoded.next;
  }
  return { source: lines.join('\n'), warnings };
}
