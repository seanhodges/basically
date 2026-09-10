// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineScreenText } from '../../dialects/types';
import { sorcererCharset } from '../../dialects/sorcerer/charset';
import { SCREEN_COLUMNS, SCREEN_ROWS } from '../../dialects/sorcerer/addresses';

/** The one code that really is a question mark, as against the no-glyph mark. */
const QUESTION_MARK = 0x3f;

/**
 * The characters on screen, read straight out of screen RAM.
 *
 * There is no font matching to do: the Sorcerer's screen holds character codes,
 * one per cell, so what the video circuit draws and what this reports come from
 * the same byte. Codes are decoded through the dialect's own charset, so a
 * screen read and a listing agree about what a byte means - the standard
 * graphics come back as the same Unicode the editor shows.
 *
 * What that cannot recover is the top band. Codes 0xC0-0xFF are user-definable
 * and have whatever shape a program poked into generator RAM, and the fixed
 * pictorial symbols below 0x20 have shapes Unicode does not draw; both read
 * back as spaces rather than as a character that means something else.
 */
export function readSorcererScreenText(
  screenRam: Uint8Array,
): MachineScreenText {
  const lines: string[] = [];
  for (let row = 0; row < SCREEN_ROWS; row++) {
    let line = '';
    for (let col = 0; col < SCREEN_COLUMNS; col++) {
      const code = screenRam[row * SCREEN_COLUMNS + col] ?? 0x20;
      const glyph = sorcererCharset.glyph(code);
      // The charset spells a code it has no character for as a space already,
      // but its `?` is a real question mark - guard the reverse anyway, so this
      // reads the same way as every other machine's screen reader.
      line += glyph === '?' && code !== QUESTION_MARK ? ' ' : glyph;
    }
    lines.push(line);
  }
  return { lines, cols: SCREEN_COLUMNS, rows: SCREEN_ROWS };
}
