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
    // A is bit 2 of the line 1/Q/A/Z/X share.
    expect(keyboard.readLine(2)).toBe(0x1f & ~0x04);
    expect(keyboard.readLine(0)).toBe(0x1f);

    keyboard.setKey('Shift', true);
    expect(keyboard.readLine(0)).toBe(0x1f & ~0x10);
    expect(keyboard.readLine(2)).toBe(0x1f & ~0x04);

    keyboard.setKey('KeyA', false);
    expect(keyboard.readLine(2)).toBe(0x1f);
  });

  it('reads only the low four bits of the selected line number', () => {
    const keyboard = new SorcererKeyboard();
    keyboard.setKey('Enter', true);
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
