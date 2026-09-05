// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type MachineScreenText } from '../../types';
import { plainChar, parseChar, SPACE } from '../charset';

/**
 * The DTSS terminal was a Teletype Model 33 ASR printing on a paper roll, so
 * there is no screen memory and nothing can be redrawn once printed. Like the
 * Altair's terminal, the roll is modelled as a fixed window painted into a
 * canvas, because a canvas suits a screen better than a scroll: what has
 * scrolled off the top is gone, exactly as it would be if the paper had rolled
 * past the platen.
 *
 * 72 columns is the Model 33's own line. The run-time lays a line out in five
 * fifteen-character zones and breaks a semicolon-separated line once the
 * carriage passes column 66, so ordinary output stays well inside the paper;
 * what can reach the margin is a long item printed in the last zone, which
 * wraps here where a real carriage would have jammed against it.
 *
 * The cells hold BCD codes rather than Unicode, so the paper stores exactly
 * what was punched and a screen reading decodes through the same charset a
 * listing does.
 */

/** The Model 33's line, and the window of roll kept on screen. */
export const COLS = 72;
export const ROWS = 24;

/** Character cell in pixels; 8x16 gives the 576x384 canvas the dialect declares. */
export const CELL_WIDTH = 8;
export const CELL_HEIGHT = 16;

export const DISPLAY_WIDTH = COLS * CELL_WIDTH;
export const DISPLAY_HEIGHT = ROWS * CELL_HEIGHT;

/**
 * Control codes the paper acts on. A carriage return moves the carriage and
 * nothing else, and a line feed advances the paper and nothing else - the two
 * are separate mechanisms on a teletype, and a program that sends only one of
 * them overprints or steps down a column, which is what the machine did.
 */
const CR = 0o37;
const LF = 0o72;
const BELL = 0o32;
const TAB = 0o52;
const FILL = 0o77;
const EOM = 0o55;

/** Paper, and the ink the Model 33's ribbon laid on it. */
const PAPER = '#e9e4d6';
const INK = '#22201c';

/** The GE-235's paper roll: BCD codes in, a printed window out. */
export class Ge235Terminal {
  /** One BCD code per cell, row-major; blank paper is the space code. */
  readonly cells = new Uint8Array(COLS * ROWS);

  private col = 0;
  private row = 0;
  private bellCount = 0;

  constructor() {
    this.clear();
  }

  /** Feed fresh paper: blank the window and put the carriage at the top left. */
  clear(): void {
    this.cells.fill(SPACE);
    this.col = 0;
    this.row = 0;
    this.bellCount = 0;
  }

  /** Carriage position, 0-based - what the run-time's zone tabbing counts. */
  get column(): number {
    return this.col;
  }

  /** Which line of the window the carriage is on, 0-based. */
  get line(): number {
    return this.row;
  }

  /** Times the bell code has been printed since the last {@link clear}. */
  get bells(): number {
    return this.bellCount;
  }

  /** Print one BCD code. */
  write(code: number): void {
    const c = code & 0o77;
    switch (c) {
      case CR:
        this.col = 0;
        return;
      case LF:
        this.lineFeed();
        return;
      case BELL:
        this.bellCount++;
        return;
      case TAB:
      case FILL:
      case EOM:
        // Fill and end-of-message are tape framing rather than print
        // instructions, and no tab stops are set: the run-time pads with blanks
        // to reach a zone instead of tabbing to it.
        return;
      default:
        break;
    }
    if (plainChar(c) === undefined) return; // no glyph, nothing to strike
    this.put(c);
  }

  /** Print editor text, skipping anything the Teletype has no code for. */
  printText(text: string): void {
    let i = 0;
    while (i < text.length) {
      try {
        const { code, length } = parseChar(text, i);
        this.write(code);
        i += length;
      } catch (e) {
        if (!(e instanceof CharsetError)) throw e;
        i += String.fromCodePoint(text.codePointAt(i)!).length;
      }
    }
  }

  /** End the line: return the carriage, then advance the paper. */
  newline(): void {
    this.write(CR);
    this.write(LF);
  }

  /** One row of the window as text, trailing blanks trimmed (for tests). */
  readRow(row: number): string {
    if (row < 0 || row >= ROWS) return '';
    return this.rowText(row).trimEnd();
  }

  /** The whole window as newline-separated rows (for tests and diagnostics). */
  text(): string {
    const rows: string[] = [];
    for (let row = 0; row < ROWS; row++) rows.push(this.readRow(row));
    return rows.join('\n');
  }

  /** True when `needle` appears on any single row. */
  contains(needle: string): boolean {
    for (let row = 0; row < ROWS; row++) {
      if (this.readRow(row).includes(needle)) return true;
    }
    return false;
  }

  /** The window as the screen reader wants it: every row padded to `cols`. */
  screenText(): MachineScreenText {
    const lines: string[] = [];
    for (let row = 0; row < ROWS; row++) lines.push(this.rowText(row));
    return { lines, cols: COLS, rows: ROWS };
  }

  /** Paint the window onto the emulator canvas. */
  renderTo(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

    ctx.fillStyle = INK;
    ctx.textBaseline = 'top';
    ctx.font = `${CELL_HEIGHT}px monospace`;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const glyph = plainChar(this.cells[row * COLS + col]!);
        if (glyph === undefined || glyph === ' ') continue;
        ctx.fillText(glyph, col * CELL_WIDTH, row * CELL_HEIGHT);
      }
    }

    // The print head, which no ROM here draws for us: without it the paper
    // looks abandoned while the machine waits for a line of INPUT. An underline
    // rather than a block - nothing at this level counts frames, so it cannot
    // blink, and a block would hide the character under it.
    ctx.fillRect(
      this.col * CELL_WIDTH,
      this.row * CELL_HEIGHT + CELL_HEIGHT - 2,
      CELL_WIDTH,
      2,
    );
  }

  private rowText(row: number): string {
    let text = '';
    for (let col = 0; col < COLS; col++) {
      text += plainChar(this.cells[row * COLS + col]!) ?? ' ';
    }
    return text;
  }

  private put(code: number): void {
    // A real carriage jams against the right-hand margin and overprints the
    // last column; wrapping loses less of what the program said.
    if (this.col >= COLS) {
      this.col = 0;
      this.lineFeed();
    }
    this.cells[this.row * COLS + this.col] = code;
    this.col++;
  }

  private lineFeed(): void {
    if (this.row + 1 < ROWS) {
      this.row++;
      return;
    }
    this.cells.copyWithin(0, COLS);
    this.cells.fill(SPACE, COLS * (ROWS - 1));
  }
}
