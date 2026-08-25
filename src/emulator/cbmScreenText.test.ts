// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Commodore screen read, in both character sets.
 *
 * The regression this pins by name: a screen showing `hello` used to read back
 * as five blanks. The text set's letters were answered through the graphics
 * set's PETSCII table, which has no letter at those codes, so every one of them
 * fell through the "no single character" guard and became a space - a whole
 * screen of text reported as empty, on the three machines that boot into
 * upper case and are switched to lower by half the programs written for them.
 */
import { describe, expect, it } from 'vitest';
import { cbmScreenChar, readCbmScreenText } from './cbmScreenText';

/** The letters `A`-`Z` as screen codes, which is where the two sets differ. */
const LETTER_CODES = Array.from({ length: 26 }, (_, i) => i + 1);
/** Screen codes 0x41-0x5A: graphics in the default set, capitals in the other. */
const SHIFTED_CODES = Array.from({ length: 26 }, (_, i) => 0x41 + i);

describe('CBM screen text', () => {
  describe('the graphics set (the boot default)', () => {
    it('reads its letter codes as capitals', () => {
      expect(
        LETTER_CODES.map((c) => cbmScreenChar(c, 'graphics')).join(''),
      ).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });

    it('reads its shifted codes as the graphics they draw, not as letters', () => {
      for (const code of SHIFTED_CODES) {
        const char = cbmScreenChar(code, 'graphics');
        expect(char, `0x${code.toString(16)}`).not.toMatch(/[A-Za-z]/);
      }
    });
  });

  describe('the text set', () => {
    it('reads its letter codes as lower case', () => {
      expect(LETTER_CODES.map((c) => cbmScreenChar(c, 'text')).join('')).toBe(
        'abcdefghijklmnopqrstuvwxyz',
      );
    });

    it('reads its shifted codes as capitals', () => {
      expect(SHIFTED_CODES.map((c) => cbmScreenChar(c, 'text')).join('')).toBe(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      );
    });

    it('never reports a letter code as a blank', () => {
      for (const code of [...LETTER_CODES, ...SHIFTED_CODES]) {
        expect(cbmScreenChar(code, 'text'), `0x${code.toString(16)}`).not.toBe(
          ' ',
        );
      }
    });
  });

  it('reads digits, punctuation and space the same way in either set', () => {
    for (const code of [0x20, 0x21, 0x30, 0x39, 0x3f]) {
      expect(cbmScreenChar(code, 'graphics')).toBe(cbmScreenChar(code, 'text'));
    }
  });

  it('strips reverse video before deciding what a cell shows', () => {
    // Bit 7 of a stored byte is the reverse-video flag, not part of the code.
    expect(cbmScreenChar(0x01 | 0x80, 'text')).toBe('a');
    expect(cbmScreenChar(0x01 | 0x80, 'graphics')).toBe('A');
  });

  it('returns fixed-width rows padded with spaces', () => {
    // `hi` at the top left of a 4x2 matrix, in the text set.
    const bytes = new Map<number, number>([
      [0x0400, 0x08],
      [0x0401, 0x09],
    ]);
    const screen = readCbmScreenText({
      read: (addr) => bytes.get(addr) ?? 0x20,
      layout: { screen: 0x0400, cols: 4, rows: 2 },
      set: 'text',
    });
    expect(screen).toEqual({
      lines: ['hi  ', '    '],
      cols: 4,
      rows: 2,
    });
  });
});
