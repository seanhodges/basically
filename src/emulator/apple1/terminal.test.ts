// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  Apple1Terminal,
  CELL_HEIGHT,
  CELL_WIDTH,
  COLS,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  ROWS,
} from './terminal';

/** A round number, so a test can say "half a character time" and mean it. */
const CHARACTER_CYCLES = 1000;

function fresh(): Apple1Terminal {
  return new Apple1Terminal(CHARACTER_CYCLES);
}

/** Send text the way the PIA does: every character with bit 7 set. */
function send(terminal: Apple1Terminal, text: string): void {
  for (let i = 0; i < text.length; i++) {
    terminal.write(text.charCodeAt(i) | 0x80);
    for (let c = 0; c < CHARACTER_CYCLES; c++) terminal.tick();
  }
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
  return { rects, glyphs, ctx: ctx as unknown as CanvasRenderingContext2D };
}

describe('apple1 terminal', () => {
  it('is a 40x24 grid on the machine’s own 7x8 cell', () => {
    expect([COLS, ROWS]).toEqual([40, 24]);
    expect([CELL_WIDTH, CELL_HEIGHT]).toEqual([7, 8]);
    expect([DISPLAY_WIDTH, DISPLAY_HEIGHT]).toEqual([280, 192]);
  });

  it('starts blank with the cursor homed', () => {
    const terminal = fresh();
    expect(terminal.text().trim()).toBe('');
    expect([terminal.cursorCol, terminal.cursorRow]).toEqual([0, 0]);
    expect(terminal.busy).toBe(false);
  });

  it('stores characters as the machine does, with bit 7 set', () => {
    const terminal = fresh();
    send(terminal, 'HI');
    expect([...terminal.cells.subarray(0, 2)]).toEqual([0xc8, 0xc9]);
    expect(terminal.readRow(0)).toBe('HI');
  });

  it('treats carriage return as the whole line discipline', () => {
    const terminal = fresh();
    send(terminal, 'ONE\rTWO');
    expect(terminal.readRow(0)).toBe('ONE');
    expect(terminal.readRow(1)).toBe('TWO');
    expect([terminal.cursorCol, terminal.cursorRow]).toEqual([3, 1]);
  });

  it('discards what the character generator cannot draw', () => {
    const terminal = fresh();
    // Line feed, bell and rub-out: a teletype acted on all three and this
    // machine's display logic decodes none of them.
    send(terminal, 'A\n\x07\x7fB');
    expect(terminal.readRow(0)).toBe('AB');
    expect(terminal.readRow(1)).toBe('');
  });

  it('wraps at the right margin and scrolls off the bottom', () => {
    const terminal = fresh();
    for (let row = 0; row < ROWS - 1; row++) send(terminal, `L${row}\r`);
    expect(terminal.readRow(0)).toBe('L0');
    expect(terminal.cursorRow).toBe(ROWS - 1);

    send(terminal, 'X'.repeat(COLS + 1));
    // The 41st X wrapped, and wrapping off the last row scrolled the grid.
    expect(terminal.readRow(ROWS - 2)).toBe('X'.repeat(COLS));
    expect(terminal.readRow(ROWS - 1)).toBe('X');
    expect(terminal.readRow(0)).toBe('L1');
  });

  it('holds the busy line for a character time after every write', () => {
    const terminal = fresh();
    terminal.write(0xc1);
    expect(terminal.busy).toBe(true);
    for (let c = 0; c < CHARACTER_CYCLES - 1; c++) terminal.tick();
    expect(terminal.busy).toBe(true);
    terminal.tick();
    expect(terminal.busy).toBe(false);
  });

  it('holds it for a discarded character too, because the register still turns', () => {
    const terminal = fresh();
    terminal.write(0x8a); // line feed: nothing is drawn
    expect(terminal.busy).toBe(true);
  });

  it('flashes the cursor, counted in video fields', () => {
    const terminal = fresh();
    expect(terminal.cursorVisible).toBe(true);
    let fields = 0;
    while (terminal.cursorVisible && fields < 1000) {
      terminal.endField();
      fields++;
    }
    expect(fields).toBeGreaterThan(1);
    expect(fields).toBeLessThan(64); // a flash, not a once-a-second blink
  });

  it('paints the grid and the cursor', () => {
    const terminal = fresh();
    send(terminal, 'HI');
    const { rects, glyphs, ctx } = recordingContext();
    terminal.renderTo(ctx);
    expect(rects[0]).toEqual({
      x: 0,
      y: 0,
      w: DISPLAY_WIDTH,
      h: DISPLAY_HEIGHT,
    });
    expect(glyphs.map((g) => g.ch).join('')).toBe('HI@');
    expect(glyphs[2]).toEqual({ ch: '@', x: 2 * CELL_WIDTH, y: 0 });
  });

  it('clears the way the CLEAR SCREEN button does', () => {
    const terminal = fresh();
    send(terminal, 'HELLO\rTHERE');
    terminal.clear();
    expect(terminal.text().trim()).toBe('');
    expect([terminal.cursorCol, terminal.cursorRow]).toEqual([0, 0]);
  });

  it('reports a row as exactly COLS characters, padded', () => {
    const terminal = fresh();
    send(terminal, 'HI');
    expect(terminal.rowText(0)).toHaveLength(COLS);
    expect(terminal.rowText(0).startsWith('HI ')).toBe(true);
    expect(terminal.contains('HI')).toBe(true);
    expect(terminal.contains('NOPE')).toBe(false);
  });
});
