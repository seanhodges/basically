// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { CharsetError } from '../types';
import { CR, EOM, SPACE, ge235Charset, plainChar } from './charset';

/**
 * The 6-bit BCD table, asserted as the hard fact it is: it comes from the 1965
 * compiler's own `s2` and `s` tables in `BA-3`, which fix all 64 codes between
 * them. Written out here rather than derived, so a change to `charset.ts` has to
 * disagree with the source listing to pass.
 */
const SYMBOLS: [number, string][] = [
  [0o13, ':'],
  [0o14, '('],
  [0o15, ';'],
  [0o16, '='],
  [0o17, '\\'],
  [0o20, '+'],
  [0o33, '.'],
  [0o34, '"'],
  [0o35, '?'],
  [0o36, '<'],
  [0o40, '-'],
  [0o53, '$'],
  [0o54, '*'],
  [0o56, '>'],
  [0o57, '↑'],
  [0o60, ' '],
  [0o61, '/'],
  [0o73, ','],
  [0o74, ')'],
  [0o75, '['],
  [0o76, ']'],
];

/** The codes the Teletype prints nothing for, each written as an escape. */
const UNPRINTABLE = [0o12, 0o32, 0o37, 0o52, 0o55, 0o72, 0o77];

describe('ge235 charset', () => {
  it('puts the digits at 0o00 and the letters in three BCD zones', () => {
    for (let d = 0; d <= 9; d++) expect(plainChar(d), `${d}`).toBe(String(d));
    // a-i at 0o21, j-r at 0o41, s-z at 0o62: the classic BCD zone layout, which
    // is why the alphabet is not one run.
    const runs: [number, string][] = [
      [0o21, 'ABCDEFGHI'],
      [0o41, 'JKLMNOPQR'],
      [0o62, 'STUVWXYZ'],
    ];
    for (const [base, letters] of runs) {
      for (let i = 0; i < letters.length; i++) {
        expect(plainChar(base + i), `0o${(base + i).toString(8)}`).toBe(
          letters[i],
        );
      }
    }
  });

  it('places every symbol where the compiler tables put it', () => {
    for (const [code, ch] of SYMBOLS) {
      expect(plainChar(code), `0o${code.toString(8)}`).toBe(ch);
    }
    expect(SPACE).toBe(0o60);
    expect(CR).toBe(0o37);
    expect(EOM).toBe(0o55);
  });

  it('has no printable form for the control codes', () => {
    for (const code of UNPRINTABLE) {
      expect(plainChar(code), `0o${code.toString(8)}`).toBeUndefined();
    }
    // Everything else prints: 57 characters over the 64 codes.
    const printable = Array.from({ length: 64 }, (_, c) => plainChar(c)).filter(
      (g) => g !== undefined,
    );
    expect(printable).toHaveLength(64 - UNPRINTABLE.length);
  });

  it('maps every code to one text form that encodes back to it', () => {
    const forms = new Set<string>();
    for (let code = 0; code < 64; code++) {
      const text = ge235Charset.toUnicode([code]);
      expect(text, `0o${code.toString(8)}`).not.toBe('');
      forms.add(text);
      expect([...ge235Charset.toMachine(text)], text).toEqual([code]);
    }
    expect(forms.size, 'two codes share a text form').toBe(64);
  });

  it('writes an unprintable code as an octal escape', () => {
    expect(ge235Charset.toUnicode([CR, EOM])).toBe('{0o37}{0o55}');
    expect([...ge235Charset.toMachine('{0o37}')]).toEqual([CR]);
  });

  it('folds lower case onto the one alphabet the ASR-33 has', () => {
    expect([...ge235Charset.toMachine('print')]).toEqual([
      ...ge235Charset.toMachine('PRINT'),
    ]);
    expect(ge235Charset.toUnicode(ge235Charset.toMachine('let a1=2'))).toBe(
      'LET A1=2',
    );
  });

  it('refuses a character the machine has no code for', () => {
    // `{` and `}` are not GE-235 characters at all, which is what makes them
    // safe to spend on the escape syntax - but a stray one is still an error.
    for (const text of ['a^b', '{', '{0o99}']) {
      expect(() => ge235Charset.toMachine(text), text).toThrow(CharsetError);
    }
  });

  it('shows a space for a code with no glyph, in status readouts', () => {
    expect(ge235Charset.glyph(CR)).toBe(' ');
    expect(ge235Charset.glyph(0o21)).toBe('A');
  });
});
