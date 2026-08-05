// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  Altair8800Terminal,
  CELL_HEIGHT,
  CELL_WIDTH,
  COLS,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  ROWS,
} from './terminal';

function type(terminal: Altair8800Terminal, text: string): void {
  for (let i = 0; i < text.length; i++) terminal.write(text.charCodeAt(i));
}

/** Enough of a 2D context to record what `renderTo` asked to be drawn. */
function recordingContext() {
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const glyphs: { ch: string; x: number; y: number }[] = [];
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    fillRect: (x: number, y: number, w: number, h: number) =>
      rects.push({ x, y, w, h }),
    fillText: (ch: string, x: number, y: number) => glyphs.push({ ch, x, y }),
  };
  return {
    rects,
    glyphs,
    ctx: ctx as unknown as CanvasRenderingContext2D,
  };
}

describe('altair8800 terminal', () => {
  it('starts blank with the cursor homed', () => {
    const terminal = new Altair8800Terminal();
    expect(terminal.text().trim()).toBe('');
    expect(terminal.cursorRow).toBe(0);
    expect(terminal.cursorCol).toBe(0);
  });

  it('prints characters along the row', () => {
    const terminal = new Altair8800Terminal();
    type(terminal, 'ALTAIR 8800');
    expect(terminal.readRow(0)).toBe('ALTAIR 8800');
    expect(terminal.cursorCol).toBe(11);
  });

  it('takes CR and LF as the separate motions a teletype made', () => {
    const terminal = new Altair8800Terminal();
    type(terminal, 'OK\r\nREADY');
    expect(terminal.readRow(0)).toBe('OK');
    expect(terminal.readRow(1)).toBe('READY');

    // A bare line feed advances the paper without returning the carriage, so
    // the next text lands in the column it left off in.
    const stagger = new Altair8800Terminal();
    type(stagger, 'AB\nCD');
    expect(stagger.readRow(0)).toBe('AB');
    expect(stagger.readRow(1)).toBe('  CD');
  });

  it('backspaces within the line only', () => {
    const terminal = new Altair8800Terminal();
    type(terminal, 'PRINT\b\bX');
    // The backspaces move the carriage; only the overtyped cell changes.
    expect(terminal.readRow(0)).toBe('PRIXT');

    const homed = new Altair8800Terminal();
    type(homed, 'A\r\b\b');
    expect(homed.cursorCol).toBe(0);
    expect(homed.cursorRow).toBe(0);
  });

  it('counts the bell instead of printing it', () => {
    const terminal = new Altair8800Terminal();
    type(terminal, 'A\x07B');
    expect(terminal.readRow(0)).toBe('AB');
    expect(terminal.bells).toBe(1);
  });

  it('swallows NUL padding and the rest of the control codes', () => {
    const terminal = new Altair8800Terminal();
    // BASIC pads a carriage return with NULs to give the carriage time.
    type(terminal, 'HI\r\0\0\0\nX\x7f\x1b');
    expect(terminal.readRow(0)).toBe('HI');
    expect(terminal.readRow(1)).toBe('X');
  });

  it('drops the high bit rather than inventing a character for it', () => {
    const terminal = new Altair8800Terminal();
    terminal.write(0xc1); // 'A' with a parity bit set
    expect(terminal.readRow(0)).toBe('A');
  });

  it('wraps at the right margin', () => {
    const terminal = new Altair8800Terminal();
    type(terminal, 'X'.repeat(COLS) + 'Y');
    expect(terminal.readRow(0)).toBe('X'.repeat(COLS));
    expect(terminal.readRow(1)).toBe('Y');
  });

  it('scrolls when the output passes the last row', () => {
    const terminal = new Altair8800Terminal();
    for (let line = 0; line < ROWS; line++) type(terminal, `LINE ${line}\r\n`);

    // ROWS line feeds from the top row leave the cursor on the last row having
    // scrolled once, so the first line has gone and the last is blank.
    expect(terminal.readRow(0)).toBe('LINE 1');
    expect(terminal.readRow(ROWS - 2)).toBe(`LINE ${ROWS - 1}`);
    expect(terminal.readRow(ROWS - 1)).toBe('');
    expect(terminal.cursorRow).toBe(ROWS - 1);
    expect(terminal.contains('LINE 0')).toBe(false);
  });

  it('clears back to a blank screen', () => {
    const terminal = new Altair8800Terminal();
    type(terminal, 'SOMETHING\x07');
    terminal.clear();
    expect(terminal.text().trim()).toBe('');
    expect(terminal.bells).toBe(0);
    expect(terminal.cursorCol).toBe(0);
  });

  it('paints the grid and an underline cursor', () => {
    const terminal = new Altair8800Terminal();
    type(terminal, 'HI');
    const { ctx, rects, glyphs } = recordingContext();
    terminal.renderTo(ctx);

    expect(glyphs).toEqual([
      { ch: 'H', x: 0, y: 0 },
      { ch: 'I', x: CELL_WIDTH, y: 0 },
    ]);
    // A full-screen background wash, then the cursor under the third cell.
    expect(rects[0]).toEqual({
      x: 0,
      y: 0,
      w: DISPLAY_WIDTH,
      h: DISPLAY_HEIGHT,
    });
    expect(rects[1]).toEqual({
      x: 2 * CELL_WIDTH,
      y: CELL_HEIGHT - 2,
      w: CELL_WIDTH,
      h: 2,
    });
  });
});
