// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  buildFontSignatures,
  readFontText,
  type GlyphSignatures,
} from '../../../emulator/fontMatcher';
import type { MachineScreenText } from '../../types';
import { plainChar } from '../charset';
import { DISPLAYED_BYTES_PER_LINE, VIDEO_RAM_STRIDE } from './display';

/**
 * Reading the PMD 85's screen back as text.
 *
 * There are no characters in video RAM to read: the machine has a bitmap and
 * nothing else, so a character is recovered by comparing the pixels where it
 * would have been drawn against the glyph the Monitor's character generator
 * would have drawn there. That is the same route the Spectrums and the CPCs
 * take, over the same {@link ../../../emulator/fontMatcher} - the only thing
 * particular to this machine is where the font and the cells are.
 *
 * **The text grid is the Monitor's, not the video circuit's.** The hardware
 * puts 256 scanlines on the screen and has no notion of a row; the Monitor
 * draws 26 rows of 48 characters into them, each glyph eight pixel rows tall on
 * a nine-scanline pitch starting at scanline 1 - so the last row is at 226 and
 * the eight scanlines above the dialogue line are simply unused. The pitch and
 * the row count were read off a running machine (print 30 lines and see where
 * they land), not assumed from 256/8.
 *
 * **The dialogue line is not one of those rows.** The Monitor keeps a separate
 * editing line at the very bottom of the frame, below the scrolling text area,
 * and that is where what the user types and BASIC-G's `DISP` output appear. It
 * is reported here as one more row, because it is a row of the screen a reader
 * would expect to see.
 */

/** Displayed characters across; a character is one byte, six pixels wide. */
const COLS = DISPLAYED_BYTES_PER_LINE;

/** Scanline the first text row's glyphs start on, and the pitch between rows. */
const TEXT_TOP = 1;
const ROW_PITCH = 9;

/** Rows in the Monitor's scrolling text area. */
const TEXT_ROWS = 26;

/** Scanline the Monitor's separate editing line starts on. */
const DIALOGUE_TOP = 246;

/** Pixel rows in one glyph. */
const GLYPH_ROWS = 8;

/**
 * Where the two runs of the character generator sit in the Monitor ROM. The
 * font is not one contiguous block: 0x20-0x5F is at 0x8600 and 0x60-0x7F at
 * 0x88C0, with Monitor code in between (see `../charset.ts`).
 */
const FONT_LOW_OFFSET = 0x0600;
const FONT_LOW_FIRST = 0x20;
const FONT_HIGH_OFFSET = 0x08c0;
const FONT_HIGH_FIRST = 0x60;

/** The six bits of a video byte that are pixels; the top two are the attribute. */
const PIXEL_MASK = 0x3f;

/** The last code with a glyph: the solid cell, this font's one non-ASCII shape. */
const LAST_CODE = 0x7f;

/** One glyph row from the Monitor ROM, or 0 when the ROM is too short to hold it. */
function glyphByte(monitor: Uint8Array, code: number, row: number): number {
  const base =
    code < FONT_HIGH_FIRST
      ? FONT_LOW_OFFSET - FONT_LOW_FIRST * GLYPH_ROWS
      : FONT_HIGH_OFFSET - FONT_HIGH_FIRST * GLYPH_ROWS;
  return monitor[base + code * GLYPH_ROWS + row] ?? 0;
}

/**
 * Index the Monitor's character generator by glyph shape.
 *
 * Masked to the six displayed bits so that a cell drawn dim or blinking matches
 * the same character a plain one does: the attribute is not part of the shape.
 */
export function pmd85FontSignatures(monitor: Uint8Array): GlyphSignatures {
  return buildFontSignatures({
    glyphByte: (code, row) => glyphByte(monitor, code, row) & PIXEL_MASK,
    lastCode: LAST_CODE,
  });
}

/**
 * The screen as text: the Monitor's 26 scrolling rows, then its editing line.
 *
 * `read` takes a video-RAM offset from 0xC000, which is what the machine's own
 * `videoRam` view is indexed by.
 */
export function readPmd85ScreenText(
  signatures: GlyphSignatures,
  read: (offset: number) => number,
): MachineScreenText {
  const topOf = (row: number): number =>
    row < TEXT_ROWS ? TEXT_TOP + row * ROW_PITCH : DIALOGUE_TOP;
  const lines = readFontText({
    signatures,
    cols: COLS,
    rows: TEXT_ROWS + 1,
    cellMask: (row, col) => {
      const top = topOf(row);
      return Array.from(
        { length: GLYPH_ROWS },
        (_, i) => read((top + i) * VIDEO_RAM_STRIDE + col) & PIXEL_MASK,
      );
    },
    // Everything the font holds is ASCII except the solid cell at 0x7F, which
    // the charset spells as a block - so a screen read agrees with a listing.
    charFor: (code) => plainChar(code) ?? ' ',
  });
  return { lines, cols: COLS, rows: TEXT_ROWS + 1 };
}
