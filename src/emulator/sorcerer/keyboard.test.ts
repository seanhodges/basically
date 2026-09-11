// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  SORCERER_KEY_TOKENS,
  SorcererKeyboard,
  tokensForHostCode,
} from './keyboard';

/** An event carrying only what the keyboard reads off it. */
function press(code: string): KeyboardEvent {
  return { code } as KeyboardEvent;
}

describe('SorcererKeyboard', () => {
  it('reads an unpressed line as all ones', () => {
    const keyboard = new SorcererKeyboard();
    for (let line = 0; line < 16; line++) {
      expect(keyboard.readLine(line)).toBe(0x1f);
    }
  });

  /**
   * A pressed key pulls its bit low on its own line and nowhere else - the
   * matrix has no modifier row shared across every scan, so a shift held with a
   * letter shows up as two lines each missing one bit.
   */
  it('pulls one bit of one line low per key', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('KeyA', true);
    // Line 0 first: an ordinary key waits for that read before it appears.
    expect(keyboard.readLine(0)).toBe(0x1f);
    // A is bit 2 of the line 1/Q/A/Z/X share.
    expect(keyboard.readLine(2)).toBe(0x1f & ~0x04);

    keyboard.setKey('Shift', true);
    expect(keyboard.readLine(0)).toBe(0x1f & ~0x10);
    expect(keyboard.readLine(2)).toBe(0x1f & ~0x04);

    keyboard.setKey('KeyA', false);
    expect(keyboard.readLine(2)).toBe(0x1f);
  });

  /**
   * An ordinary key reaches the matrix only once the modifier line has been
   * read, so the scan that finds it has already read the modifiers it goes
   * with. Without the gate, a keycap that taps SHIFT and `[` in the same
   * instant lands between the Monitor's modifier read and its read of line 10,
   * and types `[`.
   */
  it('holds an ordinary key back until the modifier line is read', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('Shift', true);
    keyboard.setKey('BracketLeft', true);
    // Mid-pass: the modifier read has been and gone, so the key is not here yet.
    expect(keyboard.readLine(10)).toBe(0x1f);
    // The next pass reads the modifiers, and the key arrives behind them.
    expect(keyboard.readLine(0)).toBe(0x1f & ~0x10);
    expect(keyboard.readLine(10)).toBe(0x1f & ~0x08);
  });

  /**
   * The backstop: code free to read one line and nothing else would otherwise
   * hold a key out for ever. A whole pass of the sixteen lines, so it cannot
   * fire inside the pass the gate exists to protect.
   */
  it('gives up waiting after a whole pass of reads', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('Enter', true);
    // Each read answers with the matrix as it was and then opens the gate, so
    // the whole pass goes by reading high and the key is there on the next one.
    for (let i = 0; i < 16; i++)
      expect(keyboard.readLine(11), `read ${i}`).toBe(0x1f);
    expect(keyboard.readLine(11)).toBe(0x1f & ~0x02);
  });

  it('reads only the low four bits of the selected line number', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('Enter', true);
    keyboard.readLine(0);
    expect(keyboard.readLine(11)).toBe(0x1f & ~0x02);
    expect(keyboard.readLine(11 + 0x30)).toBe(0x1f & ~0x02);
  });

  /**
   * Host events and virtual keycaps are two independent sources, so releasing
   * one must not release a key the other is still holding - which is what a
   * user pressing SHIFT on screen and typing on the real keyboard does.
   */
  it('holds a key while either source holds it', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('Shift', true);
    keyboard.handleEvent(press('ShiftLeft'), true);
    keyboard.handleEvent(press('ShiftLeft'), false);
    expect(keyboard.readLine(0)).toBe(0x1f & ~0x10);
    keyboard.setKey('Shift', false);
    expect(keyboard.readLine(0)).toBe(0x1f);
  });

  it('releases everything on request', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('KeyQ', true);
    keyboard.handleEvent(press('Space'), true);
    keyboard.releaseAll();
    // Line 0 among them, so a key the gate was still holding is dropped too
    // rather than arriving after the release.
    expect(keyboard.readLine(0)).toBe(0x1f);
    expect(keyboard.readLine(2)).toBe(0x1f);
    expect(keyboard.readLine(1)).toBe(0x1f);
  });

  /**
   * The symbol keys are mapped by the character on the Sorcerer keycap rather
   * than by position, because this keyboard's unshifted symbols are not a PC's.
   */
  it('maps host codes onto the key with the same legend', () => {
    expect(tokensForHostCode('KeyA')).toEqual(['KeyA']);
    expect(tokensForHostCode('ControlRight')).toEqual(['Control']);
    expect(tokensForHostCode('Quote')).toEqual(['Colon']);
    expect(tokensForHostCode('Equal')).toEqual(['Caret']);
    expect(tokensForHostCode('Backspace')).toEqual(['Underscore']);
    // The cursor cluster: this machine has none of its own, so a host arrow
    // presses the Monitor's own CTRL + W/A/S/Z diamond. The keypad is not it:
    // its 4 and 8 type `4` and `8`.
    expect(tokensForHostCode('ArrowLeft')).toEqual(['Control', 'KeyA']);
    expect(tokensForHostCode('Numpad4')).toEqual(['Numpad4']);
    // A host key with nothing under it, so the browser keeps its own handling.
    expect(tokensForHostCode('F12')).toEqual([]);
  });

  it('ignores a token that is not on the matrix', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('NoSuchKey', true);
    for (let line = 0; line < 16; line++) {
      expect(keyboard.readLine(line)).toBe(0x1f);
    }
  });

  /**
   * Every token appears once. A duplicate would silently give one keycap two
   * matrix positions and leave the other cell unreachable.
   */
  it('names each matrix cell once', () => {
    expect(new Set(SORCERER_KEY_TOKENS).size).toBe(SORCERER_KEY_TOKENS.length);
    // Sixteen lines of five, less the four cells the matrix leaves unwired.
    expect(SORCERER_KEY_TOKENS.length).toBe(16 * 5 - 4);
  });
});
