// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  FIRST_RAM_CODE,
  generatorAddress,
  SorcererDisplay,
} from './display';
import {
  CHARGEN_ROM_BASE,
  CHARGEN_ROM_SIZE,
  CHAR_CELL_HEIGHT,
  SCREEN_COLUMNS,
} from '../../dialects/sorcerer/addresses';
import { SCREEN_BYTES } from './memory';

/** Whether the pixel at (x, y) of the last frame is lit. */
function lit(display: SorcererDisplay, x: number, y: number): boolean {
  return display.frameBuffer[(y * DISPLAY_WIDTH + x) * 4]! > 0;
}

/** One character cell's rendered dots, as a row of `#` and `.` per scan line. */
function cell(display: SorcererDisplay, col: number, row: number): string[] {
  return Array.from({ length: CHAR_CELL_HEIGHT }, (_, line) =>
    Array.from({ length: 8 }, (_, dot) =>
      lit(display, col * 8 + dot, row * CHAR_CELL_HEIGHT + line) ? '#' : '.',
    ).join(''),
  );
}

describe('SorcererDisplay', () => {
  it('is 64 by 30 cells of 8 by 8 dots', () => {
    expect(DISPLAY_WIDTH).toBe(512);
    expect(DISPLAY_HEIGHT).toBe(240);
  });

  /**
   * The geometry this machine is easiest to get plausibly wrong: a code's
   * bitmap is eight consecutive bytes, the most significant bit is the leftmost
   * dot, and a screen row is 64 bytes on from the one above it.
   */
  it('scans each code through the generator, high bit leftmost', () => {
    const screen = new Uint8Array(SCREEN_BYTES);
    const rom = new Uint8Array(CHARGEN_ROM_SIZE);
    // Code 1: a lone dot in the top-left of the cell, and a full bottom row.
    rom.set([0x80, 0, 0, 0, 0, 0, 0, 0xff], 1 * CHAR_CELL_HEIGHT);
    screen[0] = 1;
    screen[SCREEN_COLUMNS + 63] = 1;

    const display = new SorcererDisplay();
    display.draw(screen, rom, new Uint8Array(0x400));

    expect(cell(display, 0, 0)).toEqual([
      '#.......',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '########',
    ]);
    // The second screen row starts 64 bytes on, so its last cell is the far
    // right of the second line of cells and nothing else is lit.
    expect(lit(display, 63 * 8, CHAR_CELL_HEIGHT)).toBe(true);
    expect(lit(display, 62 * 8, CHAR_CELL_HEIGHT)).toBe(false);
  });

  /**
   * The split generator. Codes below 0x80 come from the ROM and codes above it
   * from RAM at the same offset - which is what makes a program's POKE into
   * generator RAM change a character already on the screen.
   */
  it('takes the top half of the codes from generator RAM', () => {
    const screen = new Uint8Array(SCREEN_BYTES);
    const rom = new Uint8Array(CHARGEN_ROM_SIZE).fill(0xff);
    const ram = new Uint8Array(0x400);
    ram.set([0x0f, 0, 0, 0, 0, 0, 0, 0], 0);
    screen[0] = FIRST_RAM_CODE;

    const display = new SorcererDisplay();
    display.draw(screen, rom, ram);
    expect(cell(display, 0, 0)[0]).toBe('....####');
    // Nothing of the ROM's all-ones font leaked into a RAM-band code.
    expect(cell(display, 0, 0)[1]).toBe('........');
  });

  it('addresses a generator entry where the CPU sees it', () => {
    expect(generatorAddress(0)).toBe(CHARGEN_ROM_BASE);
    expect(generatorAddress(0x7f)).toBe(CHARGEN_ROM_BASE + 0x7f * 8);
    expect(generatorAddress(FIRST_RAM_CODE)).toBe(CHARGEN_ROM_BASE + 0x400);
    expect(generatorAddress(0xff)).toBe(0xfff8);
  });
});
