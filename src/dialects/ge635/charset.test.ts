// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { CharsetError } from '../types';
import {
  BELL,
  CR,
  EOT,
  LF,
  RUBOUT,
  SPACE,
  ge635Charset,
  plainChar,
} from './charset';

/**
 * The figures section 2.7 prints in its own table, written out here rather
 * than derived, so a change to `charset.ts` has to disagree with the manual to
 * pass. The section gives the whole run 32-94 and then names 95 separately as
 * the backward arrow; these are the rows the scan is unambiguous about.
 */
const TABLE: [number, string][] = [
  [32, ' '],
  [33, '!'],
  [34, '"'],
  [35, '#'],
  [36, '$'],
  [37, '%'],
  [38, '&'],
  [39, "'"],
  [40, '('],
  [41, ')'],
  [42, '*'],
  [48, '0'],
  [57, '9'],
  [58, ':'],
  [59, ';'],
  [60, '<'],
  [61, '='],
  [62, '>'],
  [63, '?'],
  [64, '@'],
  [65, 'A'],
  [90, 'Z'],
  [91, '['],
  [92, '\\'],
  [93, ']'],
];

describe('ge635 charset', () => {
  it('places every character the manual tabulates at its own code', () => {
    for (const [code, ch] of TABLE) {
      expect(plainChar(code), `${code}`).toBe(ch);
    }
    expect(SPACE).toBe(32);
  });

  it('ends the table with the two ASR-33 arrows', () => {
    // 95 the manual names outright, "(backward arrow)"; 94 is the slot before
    // it, and the up arrow is this BASIC's exponent operator (1.2).
    expect(plainChar(94)).toBe('↑');
    expect(plainChar(95)).toBe('←');
  });

  it('decodes the CHANGE example the manual works through', () => {
    // 2.7 reads the vector 5, 65, 66, 67, 68, 69 into A and prints ABCDE - the
    // zero component being the length rather than a character.
    expect(ge635Charset.toUnicode([65, 66, 67, 68, 69])).toBe('ABCDE');
    expect([...ge635Charset.toMachine('ABCDE')]).toEqual([65, 66, 67, 68, 69]);
  });

  it('names the control codes 2.7 lists as useful on output', () => {
    expect([EOT, BELL, LF, CR, RUBOUT]).toEqual([4, 7, 10, 13, 127]);
    for (const code of [EOT, BELL, LF, CR, RUBOUT]) {
      expect(plainChar(code), `${code}`).toBeUndefined();
    }
  });

  it('prints 32 to 95 and nothing else, over the 128 codes there are', () => {
    const printable = Array.from({ length: 128 }, (_, c) => c).filter(
      (c) => plainChar(c) !== undefined,
    );
    expect(printable[0]).toBe(32);
    expect(printable[printable.length - 1]).toBe(95);
    expect(printable).toHaveLength(64);
  });

  it('maps every code to one text form that encodes back to it', () => {
    const forms = new Set<string>();
    for (let code = 0; code < 128; code++) {
      const text = ge635Charset.toUnicode([code]);
      expect(text, `${code}`).not.toBe('');
      forms.add(text);
      expect([...ge635Charset.toMachine(text)], text).toEqual([code]);
    }
    expect(forms.size, 'two codes share a text form').toBe(128);
  });

  it('writes an unprintable code as a hex escape', () => {
    expect(ge635Charset.toUnicode([CR, LF])).toBe('{0x0D}{0x0A}');
    expect([...ge635Charset.toMachine('{0x0D}')]).toEqual([CR]);
  });

  it('folds lower case onto the one alphabet the teletype has', () => {
    expect([...ge635Charset.toMachine('print')]).toEqual([
      ...ge635Charset.toMachine('PRINT'),
    ]);
    expect(ge635Charset.toUnicode(ge635Charset.toMachine('let a1$="x"'))).toBe(
      'LET A1$="X"',
    );
  });

  it('refuses a character the machine has no code for', () => {
    // `^` and `_` are where a later ASCII put the two arrows, so neither is a
    // GE-635 character; `{` and `}` are not either, which is what makes them
    // safe to spend on the escape syntax.
    for (const text of ['A^B', 'A_B', '{', '{0x99}', '{0xZZ}']) {
      expect(() => ge635Charset.toMachine(text), text).toThrow(CharsetError);
    }
  });

  it('shows a space for a code with no glyph, in status readouts', () => {
    expect(ge635Charset.glyph(CR)).toBe(' ');
    expect(ge635Charset.glyph(65)).toBe('A');
  });
});
