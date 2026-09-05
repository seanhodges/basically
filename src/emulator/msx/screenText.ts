// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping, MachineScreenText } from '../../dialects/types';
import { CHAR_ROWS, GRAPHIC_COLUMNS, TEXT_COLUMNS } from './display';
import { Tms9918 } from './vdp';

/**
 * The characters on screen, read straight out of the VDP's name table.
 *
 * SCREEN 0 and SCREEN 1 store real character codes, so this machine needs no
 * font matching to recover its text - the graphics modes do, and report null
 * instead. Codes are decoded through the dialect's own charset, so a screen
 * read and a listing agree about what a byte means; the charset's `glyph` is
 * what the character generator draws for a code rather than what a string
 * literal would spell it as, which is the same distinction as the machine's
 * own: the screen has a shape for every code, including the graphics the
 * control codes share their numbers with.
 */
/** The one code that really is a question mark, as against the no-glyph mark. */
const QUESTION_MARK = 0x3f;

export function readScreenText(
  vdp: Tms9918,
  charset: CharsetMapping,
): MachineScreenText | null {
  const mode = vdp.mode;
  if (mode !== 'text' && mode !== 'graphic1') return null;
  const cols = mode === 'text' ? TEXT_COLUMNS : GRAPHIC_COLUMNS;
  const base = vdp.nameTable;
  const lines: string[] = [];
  for (let row = 0; row < CHAR_ROWS; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const code = vdp.vram[(base + row * cols + col) & 0x3fff]!;
      const glyph = charset.glyph(code);
      // The charset spells a code it has no character for as a question mark,
      // and a screen cell wants one character or a blank: the cursor cell is
      // the one this reaches in practice, and reading it back as `?` would put
      // punctuation on screen that is not there. Same rule the other machines
      // apply to a code with no printable form.
      line += glyph === '?' && code !== QUESTION_MARK ? ' ' : glyph;
    }
    lines.push(line);
  }
  return { lines, cols, rows: CHAR_ROWS };
}
