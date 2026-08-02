import { describe, expect, it } from 'vitest';
import { buildFontSignatures, matchCell, readFontText } from './fontMatcher';

/**
 * A toy font: space is blank, 'A' is a solid block, 'B' is a single top row,
 * and 0x7e (the last indexed code) is blank too - so it collides with space.
 */
const GLYPHS: Record<number, number[]> = {
  0x20: [0, 0, 0, 0, 0, 0, 0, 0], // space
  0x41: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], // 'A'
  0x42: [0xff, 0, 0, 0, 0, 0, 0, 0], // 'B'
  0x7e: [0, 0, 0, 0, 0, 0, 0, 0], // a blank graphic, clashing with space
};

const glyphByte = (code: number, row: number) => GLYPHS[code]?.[row] ?? 0x5a;

const SIGS = buildFontSignatures({
  glyphByte,
  firstCode: 0x20,
  lastCode: 0x7e,
});

describe('buildFontSignatures', () => {
  it('matches a glyph exactly', () => {
    expect(matchCell(SIGS, GLYPHS[0x41]!)).toBe(0x41);
    expect(matchCell(SIGS, GLYPHS[0x42]!)).toBe(0x42);
  });

  it('gives a clashing signature to the lowest code, so space wins a blank cell', () => {
    // Both 0x20 and 0x7E draw nothing; a blank cell must read as a space.
    expect(matchCell(SIGS, [0, 0, 0, 0, 0, 0, 0, 0])).toBe(0x20);
  });

  it('does not match a cell no glyph draws', () => {
    expect(matchCell(SIGS, [1, 2, 3, 4, 5, 6, 7, 8])).toBeUndefined();
  });

  it('starts at the space by default, so blank cells are never a control code', () => {
    const sigs = buildFontSignatures({ glyphByte: () => 0 });
    expect(matchCell(sigs, [0, 0, 0, 0, 0, 0, 0, 0])).toBe(0x20);
  });
});

describe('readFontText', () => {
  const screen = [
    [0x41, 0x42, 0x20],
    [0x20, 0x20, 0x41],
  ];

  it('reads a screen into fixed-width rows', () => {
    const lines = readFontText({
      signatures: SIGS,
      cols: 3,
      rows: 2,
      cellMask: (row, col) => GLYPHS[screen[row]![col]!]!,
    });
    expect(lines).toEqual(['AB ', '  A']);
  });

  it('reads an unmatched cell as a space rather than a placeholder', () => {
    const lines = readFontText({
      signatures: SIGS,
      cols: 2,
      rows: 1,
      // Neither cell is a glyph: free-hand graphics, which is not text.
      cellMask: () => [9, 9, 9, 9, 9, 9, 9, 9],
    });
    expect(lines).toEqual(['  ']);
  });

  it('pads every row to the full width', () => {
    const lines = readFontText({
      signatures: SIGS,
      cols: 4,
      rows: 3,
      cellMask: () => GLYPHS[0x20]!,
    });
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line).toHaveLength(4);
  });
});
