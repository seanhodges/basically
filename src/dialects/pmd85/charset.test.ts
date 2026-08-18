// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CharsetError } from '../types';
import {
  SOLID_BLOCK_CODE,
  decodeSpan,
  parseChar,
  plainChar,
  pmd85Charset,
} from './charset';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85.rom')),
);

/**
 * The Monitor 2 character generator, as two runs with the Monitor's own code
 * between them: codes 0x20-0x5F from 0x8600 and 0x60-0x7F from 0x88C0, eight
 * bytes each. The screen driver reaches them through a table of per-32-code
 * group bases, which is what lets the two runs be discontiguous.
 */
const FONT_LOW = 0x0600; // ROM offset of code 0x20 (0x8600)
const FONT_HIGH = 0x08c0; // ROM offset of code 0x60 (0x88C0)

/** The eight pixel rows of one character, low bit leftmost, six bits wide. */
function glyphRows(code: number): number[] {
  const base = code < 0x60 ? FONT_LOW - 0x20 * 8 : FONT_HIGH - 0x60 * 8;
  return [...rom.subarray(base + code * 8, base + code * 8 + 8)];
}

/** A glyph drawn as text, for readable comparisons. */
function art(code: number): string {
  return glyphRows(code)
    .map((row) =>
      Array.from({ length: 6 }, (_, b) => ((row >> b) & 1 ? '#' : '.')).join(
        '',
      ),
    )
    .join('\n');
}

describe('pmd85 charset', () => {
  it('is the ROM font, and the ROM font is ASCII', () => {
    // Sampled where a wrong base or a wrong bit order would show: an asymmetric
    // letter, a digit, a bracket and the space.
    expect(art(0x20)).toBe(
      [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
      ].join('\n'),
    );
    expect(art(0x41 /* A */)).toBe(
      [
        '...#..',
        '..#.#.',
        '.#...#',
        '.#...#',
        '.#####',
        '.#...#',
        '.#...#',
        '......',
      ].join('\n'),
    );
    expect(art(0x4a /* J */)).toBe(
      [
        '.....#',
        '.....#',
        '.....#',
        '.....#',
        '.#...#',
        '.#...#',
        '..###.',
        '......',
      ].join('\n'),
    );
    expect(art(0x37 /* 7 */)).toBe(
      [
        '.#####',
        '.....#',
        '....#.',
        '...#..',
        '..#...',
        '..#...',
        '..#...',
        '......',
      ].join('\n'),
    );
    expect(art(0x61 /* a */)).toBe(
      [
        '......',
        '......',
        '..##..',
        '....#.',
        '..###.',
        '.#..#.',
        '..###.',
        '......',
      ].join('\n'),
    );
  });

  it('spells 0x20-0x7E as the ASCII character of the same value', () => {
    for (let code = 0x20; code <= 0x7e; code++) {
      expect(plainChar(code), code.toString(16)).toBe(
        String.fromCharCode(code),
      );
    }
  });

  it('runs out of glyphs at 0x7F, with no accented set behind it', () => {
    // The machine is Czechoslovak, which makes this the surprising fact worth
    // pinning: there is no room in the ROM for the háčeked letters, because the
    // font stops. Every glyph row is six pixels wide, so a row byte cannot
    // exceed 0x3F - and the bytes straight after the last glyph do, which is
    // how we know they are the Monitor's code and not a second character set.
    const afterFont = FONT_HIGH + (0x80 - 0x60) * 8;
    const next = [...rom.subarray(afterFont, afterFont + 32)];
    expect(next.some((b) => b > 0x3f)).toBe(true);
    // The same holds in front of the low run, so neither end is a truncation.
    const beforeFont = [...rom.subarray(FONT_LOW - 32, FONT_LOW)];
    expect(beforeFont.some((b) => b > 0x3f)).toBe(true);
  });

  it('spells the solid cell at 0x7F as a full block', () => {
    expect(plainChar(SOLID_BLOCK_CODE)).toBe('█');
    // Six columns of seven rows lit, the eighth row left clear as the gap
    // between text lines.
    expect(glyphRows(SOLID_BLOCK_CODE)).toEqual([
      0x3e, 0x3e, 0x3e, 0x3e, 0x3e, 0x3e, 0x3e, 0x00,
    ]);
    expect(pmd85Charset.toMachine('█')).toEqual(
      Uint8Array.of(SOLID_BLOCK_CODE),
    );
  });

  it('round-trips every byte through toUnicode and toMachine', () => {
    for (let code = 0; code < 256; code++) {
      const text = pmd85Charset.toUnicode([code]);
      expect(pmd85Charset.toMachine(text), `code ${code}`).toEqual(
        Uint8Array.of(code),
      );
    }
  });

  it('escapes a literal { only where the bytes would read as an escape', () => {
    const asEscape = [0x7b, 0x30, 0x78, 0x34, 0x31, 0x7d]; // "{0x41}"
    expect(pmd85Charset.toUnicode(asEscape)).toBe('{0x7B}0x41}');
    expect(pmd85Charset.toMachine('{0x7B}0x41}')).toEqual(
      Uint8Array.from(asEscape),
    );
    expect(pmd85Charset.toUnicode([0x7b, 0x41, 0x7d])).toBe('{A}');
  });

  it('reports an unmappable character instead of dropping it', () => {
    expect(() => pmd85Charset.toMachine('č')).toThrow(CharsetError);
    expect(() => pmd85Charset.toMachine('▛')).toThrow(/no PMD 85 equivalent/);
  });

  it('reads an escape and a plain character as one unit each', () => {
    expect(parseChar('{0x0D}x', 0)).toEqual({ code: 0x0d, length: 6 });
    expect(parseChar('{0x0D}x', 6)).toEqual({ code: 0x78, length: 1 });
    expect(decodeSpan([0x0d], 0, 1)).toEqual({ text: '{0x0D}', length: 1 });
  });

  it('renders a code with no glyph as a space for status readouts', () => {
    expect(pmd85Charset.glyph(0x41)).toBe('A');
    expect(pmd85Charset.glyph(0x1c)).toBe(' ');
    expect(pmd85Charset.glyph(0xff)).toBe(' ');
  });
});
