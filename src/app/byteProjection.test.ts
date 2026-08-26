// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  BYTES_PER_ROW_STEPS,
  CHAR_PLACEHOLDER,
  byteOffset,
  bytesPerRowFor,
  caretAt,
  charCell,
  constrainField,
  hexCellRanges,
  hiddenRanges,
  parseBytes,
  projectBytes,
  rowColumns,
  snapOffset,
  type ByteViewMode,
} from './byteProjection';

/** An ASCII-ish stand-in for a machine charset: letters through, rest opaque. */
const ascii = (code: number) =>
  code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : `\\${code}`;

const MODES: ByteViewMode[] = ['hex', 'chars', 'both'];

function project(bytes: number[], bytesPerRow = 4) {
  return projectBytes(Uint8Array.from(bytes), { bytesPerRow, glyph: ascii });
}

describe('charCell', () => {
  it('keeps a single-column glyph, including a space', () => {
    expect(charCell('A')).toBe('A');
    expect(charCell(' ')).toBe(' ');
    // Astral block graphics are one column made of two UTF-16 units.
    expect(charCell('\u{1FB00}')).toBe('\u{1FB00}');
  });

  it('replaces anything that is not one column', () => {
    expect(charCell('\\118')).toBe(CHAR_PLACEHOLDER);
    expect(charCell('%A')).toBe(CHAR_PLACEHOLDER);
    expect(charCell('')).toBe(CHAR_PLACEHOLDER);
    expect(charCell('\n')).toBe(CHAR_PLACEHOLDER);
  });
});

describe('row geometry', () => {
  it('counts the columns each mode needs on screen', () => {
    expect(rowColumns(4, 'hex')).toBe(11);
    expect(rowColumns(4, 'chars')).toBe(4);
    expect(rowColumns(4, 'both')).toBe(17);
    expect(rowColumns(16, 'both')).toBe(65);
  });

  it('steps the row width down as the surface narrows', () => {
    expect(bytesPerRowFor(200, 'both')).toBe(16);
    expect(bytesPerRowFor(64, 'both')).toBe(8);
    expect(bytesPerRowFor(20, 'both')).toBe(4);
    // Never below the narrowest step, however little room there is.
    expect(bytesPerRowFor(0, 'both')).toBe(BYTES_PER_ROW_STEPS[0]);
    // One view on screen fits more bytes per row than two of the same width.
    expect(bytesPerRowFor(48, 'hex')).toBe(16);
    expect(bytesPerRowFor(48, 'both')).toBe(8);
  });
});

describe('projectBytes', () => {
  it('lays a row out as hex, a gap, then characters', () => {
    const p = project([0x41, 0x42, 0x43, 0x44]);
    expect(p.text.split('\n')[0]).toBe('41 42 43 44  ABCD');
    expect(p.charsColumn).toBe(13);
    expect(p.hexColumns).toBe(11);
  });

  it('pads a short row so the character field keeps its column', () => {
    const p = project([0x41, 0x42]);
    expect(p.text).toBe('41 42        AB');
    expect(p.rows).toBe(1);
    expect(p.text.indexOf('AB')).toBe(p.charsColumn);
  });

  it('renders one line per row', () => {
    const p = project([0x41, 0x42, 0x43, 0x44, 0x45]);
    expect(p.text.split('\n')).toEqual(['41 42 43 44  ABCD', '45           E']);
    expect(p.rows).toBe(2);
    expect(p.rowStarts).toEqual([0, 18]);
  });

  it('opens a row for the append position when the last row is full', () => {
    const p = project([1, 2, 3, 4]);
    expect(p.rows).toBe(2);
    expect(byteOffset(p, 4, 'hex')).toBe(p.rowStarts[1]);
  });

  it('projects an empty block as one empty row', () => {
    const p = project([]);
    expect(p.rows).toBe(1);
    expect(p.length).toBe(0);
    expect(byteOffset(p, 0, 'hex')).toBe(0);
  });

  it('uses the placeholder for a code with no single-column glyph', () => {
    const p = project([0x41, 0x00]);
    expect(p.text.slice(p.charsColumn)).toBe(`A${CHAR_PLACEHOLDER}`);
  });

  it('measures a wide glyph in the units the document counts in', () => {
    const p = projectBytes(Uint8Array.from([0x01, 0x41]), {
      bytesPerRow: 4,
      glyph: (c) => (c === 0x01 ? '\u{1FB00}' : ascii(c)),
    });
    // The astral cell is two UTF-16 units wide, so the byte after it follows
    // two positions later rather than one.
    expect(byteOffset(p, 1, 'chars')).toBe(byteOffset(p, 0, 'chars') + 2);
    expect(caretAt(p, byteOffset(p, 0, 'chars') + 2)).toEqual({
      index: 1,
      field: 'chars',
    });
  });
});

describe('parseBytes', () => {
  it('reads back exactly what was projected, at every row width', () => {
    const bytes = Uint8Array.from(
      Array.from({ length: 300 }, (_, i) => (i * 37) & 0xff),
    );
    for (const bytesPerRow of BYTES_PER_ROW_STEPS) {
      const p = projectBytes(bytes, { bytesPerRow, glyph: ascii });
      expect([...parseBytes(p.text, bytesPerRow)]).toEqual([...bytes]);
    }
  });

  it('round-trips an empty block and a single byte', () => {
    for (const source of [[], [0xff]]) {
      const p = project(source);
      expect([...parseBytes(p.text, p.bytesPerRow)]).toEqual(source);
    }
  });

  it('stops at the padding that says the block ended', () => {
    expect([...parseBytes('41 42        AB', 4)]).toEqual([0x41, 0x42]);
  });
});

describe('offset <-> byte round trips', () => {
  it('round-trips every byte and the append position in both fields', () => {
    const bytes = Array.from({ length: 21 }, (_, i) => i * 7);
    const p = project(bytes, 8);
    for (const field of ['hex', 'chars'] as const) {
      for (let i = 0; i <= p.length; i++) {
        expect(caretAt(p, byteOffset(p, i, field))).toEqual({
          index: i,
          field,
        });
      }
    }
  });

  it('snaps a caret in the gap between hex pairs onto a byte', () => {
    const p = project([1, 2, 3, 4]);
    // "01 02 03 04  ...." - offset 2 is the separator after the first pair.
    expect(caretAt(p, 2)).toEqual({ index: 1, field: 'hex' });
    expect(snapOffset(p, 2)).toBe(3);
    // Mid-pair snaps back onto the pair it is inside.
    expect(snapOffset(p, 4)).toBe(3);
  });

  it('snaps a caret in the gap between the two views onto a byte', () => {
    const p = project([1, 2, 3, 4]);
    // Columns 11 and 12 are the blank gap; 13 is the first character cell.
    expect(caretAt(p, 12)).toEqual({ index: 0, field: 'chars' });
    expect(snapOffset(p, 12)).toBe(13);
    expect(caretAt(p, 11)).toEqual({ index: 3, field: 'hex' });
  });

  it('holds either side of a row boundary', () => {
    const p = project([1, 2, 3, 4, 5, 6]);
    expect(caretAt(p, byteOffset(p, 3, 'hex'))).toEqual({
      index: 3,
      field: 'hex',
    });
    expect(caretAt(p, byteOffset(p, 4, 'hex'))).toEqual({
      index: 4,
      field: 'hex',
    });
    // The last byte of a row and the first of the next are on different lines.
    expect(byteOffset(p, 4, 'hex')).toBeGreaterThan(
      byteOffset(p, 3, 'hex') + 2,
    );
  });

  it('clamps an offset past the end onto the append position', () => {
    const p = project([1, 2, 3]);
    expect(caretAt(p, p.text.length + 50).index).toBe(3);
  });

  it('keeps the caret in the field on screen', () => {
    const p = project([1, 2, 3]);
    expect(constrainField('chars', 'hex')).toBe('hex');
    expect(constrainField('hex', 'chars')).toBe('chars');
    expect(constrainField('chars', 'both')).toBe('chars');
    // A click in the hidden field lands on the same byte in the visible one.
    expect(snapOffset(p, byteOffset(p, 1, 'chars'), 'hex')).toBe(
      byteOffset(p, 1, 'hex'),
    );
  });
});

describe('a mode change preserves the caret byte', () => {
  it('keeps the byte the caret is on across every mode and row width', () => {
    const bytes = Array.from({ length: 30 }, (_, i) => i);
    const wide = project(bytes, 16);
    const index = caretAt(wide, byteOffset(wide, 19, 'chars')).index;
    expect(index).toBe(19);
    for (const mode of MODES) {
      for (const bytesPerRow of BYTES_PER_ROW_STEPS) {
        const p = project(bytes, bytesPerRow);
        const field = constrainField('chars', mode);
        expect(caretAt(p, byteOffset(p, index, field)).index).toBe(19);
      }
    }
  });
});

describe('hexCellRanges', () => {
  it('covers each pair and nothing beyond the last byte', () => {
    expect(hexCellRanges(project([1, 2, 3]))).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 5 },
      { from: 6, to: 8 },
    ]);
  });
});

describe('hiddenRanges', () => {
  it('hides nothing when both views are on screen', () => {
    expect(hiddenRanges(project([1, 2, 3]), 'both')).toEqual([]);
  });

  it('hides the character field, and the gap, in the hex view', () => {
    const p = project([0x41, 0x42, 0x43, 0x44, 0x45]);
    const hidden = hiddenRanges(p, 'hex');
    expect(hidden).toHaveLength(p.rows);
    expect(hidden[0]).toEqual({ from: 11, to: 17 });
    // Every hidden stretch starts where the hex field ends, so no pair of hex
    // digits is ever inside one.
    for (const range of hidden) {
      expect(range.from % (p.text.split('\n')[0]!.length + 1)).toBe(
        p.hexColumns,
      );
    }
  });

  it('hides the hex field, and the gap, in the character view', () => {
    const p = project([0x41, 0x42, 0x43, 0x44, 0x45]);
    const hidden = hiddenRanges(p, 'chars');
    expect(hidden).toHaveLength(p.rows);
    expect(hidden[0]).toEqual({ from: 0, to: 13 });
    // What is left of each row is exactly the character cells.
    expect(p.text.slice(13, 17)).toBe('ABCD');
  });
});
