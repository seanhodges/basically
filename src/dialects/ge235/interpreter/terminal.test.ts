// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { ge235Charset } from '../charset';
import { CELL_HEIGHT, CELL_WIDTH, COLS, Ge235Terminal, ROWS } from './terminal';

describe('Ge235Terminal', () => {
  it('stores what was struck as BCD codes, not as Unicode', () => {
    const term = new Ge235Terminal();
    term.printText('AZ09');
    expect([...term.cells.slice(0, 4)]).toEqual([
      ...ge235Charset.toMachine('AZ09'),
    ]);
  });

  it('separates the carriage from the paper, as the two mechanisms were', () => {
    const term = new Ge235Terminal();
    term.printText('ABC');
    term.write(0o37); // carriage return: back to the left, same line
    expect(term.column).toBe(0);
    expect(term.line).toBe(0);
    term.write(0o72); // line feed: down a line, carriage where it was
    expect(term.line).toBe(1);
    term.printText('D');
    expect(term.readRow(0)).toBe('ABC');
    expect(term.readRow(1)).toBe('D');
  });

  it('swallows the codes that frame a tape rather than printing them', () => {
    const term = new Ge235Terminal();
    term.write(0o32); // bell
    term.write(0o77); // fill
    term.write(0o55); // end of message
    term.write(0o52); // tab, with no stops set
    expect(term.bells).toBe(1);
    expect(term.column).toBe(0);
    expect(term.text().trim()).toBe('');
  });

  it('wraps at the margin instead of overprinting the last column', () => {
    const term = new Ge235Terminal();
    term.printText('X'.repeat(COLS + 2));
    expect(term.readRow(0)).toBe('X'.repeat(COLS));
    expect(term.readRow(1)).toBe('XX');
  });

  it('rolls the paper past the platen once the window is full', () => {
    const term = new Ge235Terminal();
    for (let row = 0; row <= ROWS; row++) {
      if (row > 0) term.newline();
      term.printText(`L${row}`);
    }
    // The first line has scrolled off; the window holds the last ROWS of them.
    expect(term.readRow(0)).toBe('L1');
    expect(term.readRow(ROWS - 1)).toBe(`L${ROWS}`);
    expect(term.contains('L0')).toBe(false);
  });

  it('reads back as full-width rows, blanks and all', () => {
    const term = new Ge235Terminal();
    term.printText('HI');
    const screen = term.screenText();
    expect(screen.cols).toBe(COLS);
    expect(screen.rows).toBe(ROWS);
    expect(screen.lines).toHaveLength(ROWS);
    for (const line of screen.lines) expect([...line]).toHaveLength(COLS);
    expect(screen.lines[0]!.trimEnd()).toBe('HI');
  });

  it('paints each cell where the screen reader says it is', () => {
    const term = new Ge235Terminal();
    term.printText('AB');
    const drawn = new Map<string, string>();
    const ctx = {
      fillStyle: '',
      font: '',
      textBaseline: '',
      fillRect: () => {},
      fillText: (text: string, x: number, y: number) => {
        drawn.set(
          `${Math.round(y / CELL_HEIGHT)},${Math.round(x / CELL_WIDTH)}`,
          text,
        );
      },
    } as unknown as CanvasRenderingContext2D;
    term.renderTo(ctx);
    expect(drawn.get('0,0')).toBe('A');
    expect(drawn.get('0,1')).toBe('B');
  });
});
