// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { PMD85_KEY_TOKENS, Pmd85Keyboard } from './keyboard';

/** A `keydown`/`keyup` carrying only what the keyboard reads. */
function keyEvent(code: string): KeyboardEvent {
  return { code } as KeyboardEvent;
}

describe('pmd85 keyboard', () => {
  it('reads a pressed key as a low bit of the row it is in', () => {
    const keyboard = new Pmd85Keyboard();
    // Nothing pressed: every line of every row floats high.
    expect(keyboard.readRow(0)).toBe(0xff);

    keyboard.setKey('KeyA', true);
    expect(keyboard.readRow(0)).toBe(0xff & ~0x08); // row 0, bit 3
    // The row select is a 4-bit binary number into a decoder, so only the row
    // asked for answers - unlike the Sinclair machines' one-hot address lines.
    expect(keyboard.readRow(1)).toBe(0xff);
  });

  it('reads SHIFT and STOP on every row, because they are wired across it', () => {
    const keyboard = new Pmd85Keyboard();
    keyboard.setKey('Shift', true);

    for (const row of [0, 7, 14]) {
      expect(keyboard.readRow(row), `row ${row}`).toBe(0xff & ~0x20);
    }

    keyboard.setKey('Stop', true);
    keyboard.setKey('KeyM', true); // row 7, bit 4
    expect(keyboard.readRow(7)).toBe(0xff & ~(0x20 | 0x40 | 0x10));
  });

  it('unions the physical and virtual keyboards, and releases both', () => {
    const keyboard = new Pmd85Keyboard();
    keyboard.handleEvent(keyEvent('KeyQ'), true);
    keyboard.setKey('KeyQ', true);

    // Released on one source only, the key is still held by the other.
    keyboard.handleEvent(keyEvent('KeyQ'), false);
    expect(keyboard.readRow(0)).toBe(0xff & ~0x04);

    keyboard.releaseAll();
    expect(keyboard.readRow(0)).toBe(0xff);
  });

  it('maps a host key onto the PMD 85 key that carries the same legend', () => {
    const keyboard = new Pmd85Keyboard();

    // ':' is its own key here rather than a shifted semicolon, so a positional
    // mapping would put the wrong character on screen.
    expect(keyboard.handleEvent(keyEvent('Quote'), true)).toBe(true);
    expect(keyboard.readRow(10)).toBe(0xff & ~0x08);

    expect(keyboard.handleEvent(keyEvent('ShiftLeft'), true)).toBe(true);
    expect(keyboard.readRow(10)).toBe(0xff & ~(0x08 | 0x20));
  });

  it('leaves a key it has no equivalent of to the browser', () => {
    const keyboard = new Pmd85Keyboard();
    expect(keyboard.handleEvent(keyEvent('F5'), true)).toBe(false);
    expect(keyboard.readRow(0)).toBe(0xff);
    keyboard.setKey('NoSuchKey', true);
    expect(keyboard.readRow(0)).toBe(0xff);
  });

  it('places every token in exactly one matrix cell', () => {
    const keyboard = new Pmd85Keyboard();
    const seen = new Map<string, string>();
    for (const token of PMD85_KEY_TOKENS) {
      keyboard.releaseAll();
      keyboard.setKey(token, true);
      const cells: string[] = [];
      for (let row = 0; row < 16; row++) {
        const down = ~keyboard.readRow(row) & 0xff;
        for (let bit = 0; bit < 8; bit++) {
          // SHIFT and STOP answer on every row; count them once, at their own.
          if (down & (1 << bit) && (bit < 5 || row === 15)) {
            cells.push(`${row}:${bit}`);
          }
        }
      }
      expect(cells, token).toHaveLength(1);
      expect(seen.has(cells[0]!), `${token} shares ${cells[0]}`).toBe(false);
      seen.set(cells[0]!, token);
    }
    // 15 rows of the matrix plus the two common keys, minus the three cells
    // the keyboard leaves unwired.
    expect(seen.size).toBe(PMD85_KEY_TOKENS.length);
  });
});
