// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  Altair8800Keyboard,
  altair8800KeyTokens,
  tokenToByte,
} from './keyboard';
import { Altair8800Serial } from './serial';
import { Altair8800Terminal } from './terminal';

function console_() {
  const serial = new Altair8800Serial(new Altair8800Terminal());
  return { serial, keyboard: new Altair8800Keyboard(serial) };
}

/** Every byte the machine has been handed, as text. */
function typed(serial: Altair8800Serial): number[] {
  const bytes: number[] = [];
  while (serial.pendingInput > 0) bytes.push(serial.readData());
  return bytes;
}

function press(
  keyboard: Altair8800Keyboard,
  token: string,
  ...modifiers: string[]
): void {
  for (const modifier of modifiers) keyboard.setToken(modifier, true);
  keyboard.setToken(token, true);
  keyboard.setToken(token, false);
  for (const modifier of modifiers) keyboard.setToken(modifier, false);
}

function domEvent(
  key: string,
  mods: Partial<KeyboardEvent> = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  } as KeyboardEvent;
}

describe('altair8800 keyboard', () => {
  it('sends a character on the way down and nothing on the way up', () => {
    const { serial, keyboard } = console_();
    keyboard.setToken('KeyA', true);
    expect(serial.pendingInput).toBe(1);
    keyboard.setToken('KeyA', false);
    expect(typed(serial)).toEqual([0x41]);
  });

  it("flips bit 4 for the ASR-33's shifted keys", () => {
    const { serial, keyboard } = console_();
    press(keyboard, 'Digit1', 'Shift'); // !
    press(keyboard, 'Digit2', 'Shift'); // "
    press(keyboard, 'Digit0', 'Shift'); // space - the 0 key's blank shift
    press(keyboard, 'Colon', 'Shift'); // *
    press(keyboard, 'Minus', 'Shift'); // =
    press(keyboard, 'Semicolon', 'Shift'); // +
    press(keyboard, 'Comma', 'Shift'); // <
    press(keyboard, 'Slash', 'Shift'); // ?
    expect(String.fromCharCode(...typed(serial))).toBe('!" *=+<?');
  });

  it('gives the six letters that carry a shifted symbol, and no others', () => {
    const { serial, keyboard } = console_();
    for (const letter of 'KLMNOP') press(keyboard, `Key${letter}`, 'Shift');
    expect(String.fromCharCode(...typed(serial))).toBe('[\\]^_@');

    // A-J and Q-Z have no second marking: flipping their bit would land on
    // another letter, so SHIFT does nothing at all.
    for (const letter of 'AJQZ') press(keyboard, `Key${letter}`, 'Shift');
    expect(String.fromCharCode(...typed(serial))).toBe('AJQZ');

    // Nor does the space bar shift; it is not a code bar.
    press(keyboard, 'Space', 'Shift');
    expect(typed(serial)).toEqual([0x20]);
  });

  it('clears bits 5 and 6 for CTRL, so CTRL-C breaks a program', () => {
    const { serial, keyboard } = console_();
    press(keyboard, 'KeyC', 'Control');
    expect(typed(serial)).toEqual([0x03]);

    press(keyboard, 'KeyG', 'Control'); // bell
    expect(typed(serial)).toEqual([0x07]);

    // SHIFT first, then CTRL: SHIFT-K is '[' (0x5B), and CTRL takes it to ESC.
    press(keyboard, 'KeyK', 'Shift', 'Control');
    expect(typed(serial)).toEqual([0x1b]);
  });

  it("sends the teletype's own function keys as fixed codes", () => {
    const { serial, keyboard } = console_();
    press(keyboard, 'Enter');
    press(keyboard, 'LineFeed');
    press(keyboard, 'Rubout');
    press(keyboard, 'Escape');
    expect(typed(serial)).toEqual([0x0d, 0x0a, 0x7f, 0x1b]);

    // Not an ASR-33 key: a host Backspace sends the underline BASIC itself
    // treats as "delete the last character typed".
    press(keyboard, 'Backspace');
    expect(typed(serial)).toEqual([0x5f]);
  });

  it('ignores tokens for keys this machine does not have', () => {
    const { serial, keyboard } = console_();
    press(keyboard, 'ArrowUp');
    press(keyboard, 'F1');
    expect(serial.pendingInput).toBe(0);
  });

  it('drops held modifiers when everything is released', () => {
    const { serial, keyboard } = console_();
    keyboard.setToken('Shift', true);
    keyboard.releaseAll();
    press(keyboard, 'Digit1');
    expect(typed(serial)).toEqual([0x31]); // '1', not '!'
  });

  it('translates physical key events, claiming CTRL for the machine', () => {
    const { serial, keyboard } = console_();

    expect(keyboard.handleEvent(domEvent('A'), true)).toBe(true);
    expect(keyboard.handleEvent(domEvent('Enter'), true)).toBe(true);
    expect(keyboard.handleEvent(domEvent('Backspace'), true)).toBe(true);
    expect(keyboard.handleEvent(domEvent('Delete'), true)).toBe(true);
    expect(typed(serial)).toEqual([0x41, 0x0d, 0x5f, 0x7f]);

    expect(keyboard.handleEvent(domEvent('c', { ctrlKey: true }), true)).toBe(
      true,
    );
    expect(typed(serial)).toEqual([0x03]);

    // Lower case goes through unfolded: the interpreter folds it to upper case
    // itself outside string literals, and inside one the user meant it.
    keyboard.handleEvent(domEvent('h'), true);
    expect(typed(serial)).toEqual([0x68]);
  });

  it("leaves alone the events that are not the machine's to consume", () => {
    const { serial, keyboard } = console_();
    expect(keyboard.handleEvent(domEvent('F5'), true)).toBe(false);
    expect(keyboard.handleEvent(domEvent('Shift'), true)).toBe(false);
    expect(keyboard.handleEvent(domEvent('s', { metaKey: true }), true)).toBe(
      false,
    );
    expect(keyboard.handleEvent(domEvent('A'), false)).toBe(false);
    expect(serial.pendingInput).toBe(0);
  });

  it('translates every token it advertises, modifiers aside', () => {
    for (const token of altair8800KeyTokens()) {
      if (token === 'Shift' || token === 'Control') continue;
      expect(tokenToByte(token), token).not.toBeNull();
    }
    expect(tokenToByte('KeyQ')).toBe(0x51);
    expect(tokenToByte('Digit7', { shift: true })).toBe(0x27); // '
    expect(tokenToByte('NotAKey')).toBeNull();
  });
});
