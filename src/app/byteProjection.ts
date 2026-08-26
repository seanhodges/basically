// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The byte editor's document projection: a block's bytes rendered as the text a
 * row-per-line editor shows, and the mapping in both directions between a
 * document offset and a byte index. Pure - no React, no CodeMirror - because
 * everything in that surface depends on this mapping being right, and a browser
 * is a poor place to pin it.
 *
 * A row is one line holding up to `bytesPerRow` bytes, hex field first, padded
 * to a fixed width so the character field starts at the same column on every
 * row:
 *
 *     41 42 43 44  ABCD
 *     ^hex          ^chars
 *
 * **Both fields are always in the document**, whichever the surface is showing:
 * the view mode hides one of them rather than leaving it out, so the hex field
 * is always there to read the bytes back from ({@link parseBytes}). That is what
 * lets the editor's undo history be the document's own - `bufferHistory.ts`
 * parks a serialized state, and CodeMirror's history serializes its document
 * changes but drops any state effects riding with them, so bytes carried in an
 * effect would not survive a tab switch.
 *
 * The addressable range is the bytes *plus one*: a block grows by the caret
 * resting one position past the last byte and a value being entered there, so
 * index `length` has an offset in both fields. That is the only place this
 * reaches outside the array it is projecting.
 *
 * A character cell is one column wide by construction. A glyph that is not a
 * single code point - the backslash escapes and `%`-inverses the Sinclair
 * charsets return for codes with no character of their own - renders as
 * {@link CHAR_PLACEHOLDER}, since a two-character cell would put the column out
 * of step with the addresses beside it. Cells are still measured in UTF-16 code
 * units rather than assumed to be one, because an astral glyph (the TRS-80's
 * sextants) is a single column made of two of them.
 */

/** Which of the two views a caret sits in. */
export type ByteField = 'hex' | 'chars';

/** Which views are on screen: one, the other, or both side by side. */
export type ByteViewMode = 'hex' | 'chars' | 'both';

/** Blank columns between the hex field and the character field. */
const FIELD_GAP = 2;

/** Stand-in for a machine code with no single-column glyph. */
export const CHAR_PLACEHOLDER = '·';

/** Row widths the surface steps through as it narrows. */
export const BYTES_PER_ROW_STEPS = [4, 8, 16] as const;

export interface ByteProjection {
  readonly bytesPerRow: number;
  /** How many bytes were projected (the block's length). */
  readonly length: number;
  /** The document text: one line per row, no trailing newline. */
  readonly text: string;
  /** Number of lines in {@link text}. */
  readonly rows: number;
  /** Document offset of each row's first character. */
  readonly rowStarts: readonly number[];
  /** Columns the hex field occupies, relative to the row's first. */
  readonly hexColumns: number;
  /** Column the character field starts at, relative to the row's first. */
  readonly charsColumn: number;
  /** Document offset of every byte's hex pair, plus the append position. */
  readonly hexOffsets: readonly number[];
  /** Document offset of every byte's character cell, plus the append position. */
  readonly charOffsets: readonly number[];
}

/** The single-column cell a glyph is rendered as. */
export function charCell(glyph: string): string {
  const points = [...glyph];
  if (points.length !== 1) return CHAR_PLACEHOLDER;
  const point = points[0]!;
  const code = point.codePointAt(0)!;
  // Controls and the C1/nbsp band have no column of their own; a space does.
  if (code < 0x20 || (code >= 0x7f && code <= 0xa0)) return CHAR_PLACEHOLDER;
  return point;
}

/** How many monospace columns a row occupies with `mode` on screen. */
export function rowColumns(bytesPerRow: number, mode: ByteViewMode): number {
  const hex = bytesPerRow * 3 - 1;
  if (mode === 'hex') return hex;
  if (mode === 'chars') return bytesPerRow;
  return hex + FIELD_GAP + bytesPerRow;
}

/**
 * The widest row that fits in `columns` monospace columns, never below the
 * narrowest step - a row has to hold some bytes even on a phone.
 */
export function bytesPerRowFor(columns: number, mode: ByteViewMode): number {
  let best: number = BYTES_PER_ROW_STEPS[0];
  for (const step of BYTES_PER_ROW_STEPS) {
    if (rowColumns(step, mode) <= columns) best = step;
  }
  return best;
}

export interface ByteProjectionOptions {
  bytesPerRow: number;
  /** The machine's own character for a code - `CharsetMapping.glyph`. */
  glyph: (code: number) => string;
}

/** Project `bytes` into the document text and the offset tables for it. */
export function projectBytes(
  bytes: Uint8Array,
  { bytesPerRow, glyph }: ByteProjectionOptions,
): ByteProjection {
  const length = bytes.length;
  const rows = Math.ceil((length + 1) / bytesPerRow);
  const hexColumns = bytesPerRow * 3 - 1;
  const charsColumn = hexColumns + FIELD_GAP;
  const hexOffsets = new Array<number>(length + 1);
  const charOffsets = new Array<number>(length + 1);
  const rowStarts = new Array<number>(rows);

  const lines: string[] = [];
  let lineStart = 0;
  for (let row = 0; row < rows; row++) {
    rowStarts[row] = lineStart;
    const first = row * bytesPerRow;
    const last = Math.min(length, first + bytesPerRow - 1);
    const end = Math.min(length, first + bytesPerRow);

    let hex = '';
    for (let i = first; i < end; i++) {
      if (i > first) hex += ' ';
      hex += bytes[i]!.toString(16).padStart(2, '0').toUpperCase();
    }
    // Padded even when the row is short, so the append position past the last
    // byte is a real offset and the character field keeps its column.
    hex = hex.padEnd(hexColumns, ' ');

    let chars = '';
    let charOffset = lineStart + charsColumn;
    for (let i = first; i <= last; i++) {
      hexOffsets[i] = lineStart + (i - first) * 3;
      charOffsets[i] = charOffset;
      if (i < end) {
        const cell = charCell(glyph(bytes[i]!));
        chars += cell;
        charOffset += cell.length;
      }
    }

    const line = hex + ' '.repeat(FIELD_GAP) + chars;
    lines.push(line);
    lineStart += line.length + 1; // + the newline
  }

  return {
    bytesPerRow,
    length,
    text: lines.join('\n'),
    rows,
    rowStarts,
    hexColumns,
    charsColumn,
    hexOffsets,
    charOffsets,
  };
}

/**
 * Read a document produced by {@link projectBytes} back as bytes. The hex field
 * is a total, lossless encoding - a pair is either two hex digits or the blank
 * padding that says the block ended - so this is the inverse, and the character
 * field (which is not, once a glyph has become a placeholder) is only ever read
 * by eye.
 */
export function parseBytes(text: string, bytesPerRow: number): Uint8Array {
  const out: number[] = [];
  for (const line of text.split('\n')) {
    for (let column = 0; column < bytesPerRow; column++) {
      const pair = line.slice(column * 3, column * 3 + 2);
      if (!/^[0-9a-f]{2}$/i.test(pair)) return Uint8Array.from(out);
      out.push(parseInt(pair, 16));
    }
  }
  return Uint8Array.from(out);
}

/**
 * The document offset of `index` in `field`, clamped to the append position at
 * the end.
 */
export function byteOffset(
  p: ByteProjection,
  index: number,
  field: ByteField,
): number {
  const clamped = Math.max(0, Math.min(p.length, index));
  const table = field === 'hex' ? p.hexOffsets : p.charOffsets;
  return table[clamped] ?? 0;
}

/** The row `offset` falls in. */
function rowOfOffset(p: ByteProjection, offset: number): number {
  let low = 0;
  let high = p.rows - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (p.rowStarts[mid]! <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

/**
 * The byte a document offset addresses, snapped to the nearest byte boundary -
 * the caret never rests in the gaps between hex pairs or between the two views.
 */
export function caretAt(
  p: ByteProjection,
  offset: number,
): { index: number; field: ByteField } {
  const clampedOffset = Math.max(0, Math.min(p.text.length, offset));
  const row = rowOfOffset(p, clampedOffset);
  const rel = clampedOffset - p.rowStarts[row]!;
  // The blank gap between the views belongs to whichever field it is nearer.
  const field: ByteField =
    rel < (p.hexColumns + p.charsColumn) / 2 ? 'hex' : 'chars';
  const first = row * p.bytesPerRow;

  let index: number;
  if (field === 'hex') {
    // Clamped to the columns this row actually has: the position one past the
    // last of them is the first byte of the next row, and is addressed there.
    const column = Math.max(
      0,
      Math.min(p.bytesPerRow - 1, Math.round(rel / 3)),
    );
    index = first + column;
  } else {
    // Character cells vary in UTF-16 width, so the nearest one is found in the
    // offset table rather than computed from the column.
    const last = Math.min(p.length, first + p.bytesPerRow);
    index = first;
    let bestGap = Infinity;
    for (let i = first; i <= last; i++) {
      const candidate = p.charOffsets[i];
      if (candidate === undefined) break;
      const gap = Math.abs(candidate - clampedOffset);
      if (gap > bestGap) break;
      bestGap = gap;
      index = i;
    }
  }
  return { index: Math.max(0, Math.min(p.length, index)), field };
}

/** The field a caret may rest in with `mode` on screen. */
export function constrainField(
  field: ByteField,
  mode: ByteViewMode,
): ByteField {
  return mode === 'both' ? field : mode;
}

/** The document offset the caret at `offset` snaps to, with `mode` on screen. */
export function snapOffset(
  p: ByteProjection,
  offset: number,
  mode: ByteViewMode = 'both',
): number {
  const { index, field } = caretAt(p, offset);
  return byteOffset(p, index, constrainField(field, mode));
}

/** The hex pair of every byte, as ranges a caret treats as one unit. */
export function hexCellRanges(
  p: ByteProjection,
): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  for (let i = 0; i < p.length; i++) {
    const from = p.hexOffsets[i]!;
    ranges.push({ from, to: from + 2 });
  }
  return ranges;
}

/**
 * The stretches of each row the surface does not show in `mode` - the field
 * that is not on screen, together with the gap beside it. Empty for `both`.
 */
export function hiddenRanges(
  p: ByteProjection,
  mode: ByteViewMode,
): { from: number; to: number }[] {
  if (mode === 'both') return [];
  const ranges: { from: number; to: number }[] = [];
  for (let row = 0; row < p.rows; row++) {
    const start = p.rowStarts[row]!;
    const lineEnd =
      row + 1 < p.rows ? p.rowStarts[row + 1]! - 1 : p.text.length;
    const range =
      mode === 'hex'
        ? { from: start + p.hexColumns, to: lineEnd }
        : { from: start, to: start + p.charsColumn };
    if (range.to > range.from) ranges.push(range);
  }
  return ranges;
}
