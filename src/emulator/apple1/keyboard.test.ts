// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  Apple1Keyboard,
  CLEAR_SCREEN_TOKEN,
  RESET_TOKEN,
  apple1KeyTokens,
  tokenToByte,
} from './keyboard';

function harness() {
  const buttons = { resets: 0, clears: 0 };
  const keyboard = new Apple1Keyboard({
    reset: () => buttons.resets++,
    clearScreen: () => buttons.clears++,
  });
  /** Everything the machine would take out of the latch, as text. */
  const drain = (): string => {
    let text = '';
    for (;;) {
      const code = keyboard.take();
      if (code === null) return text;
      expect(code & 0x80).toBe(0x80); // PA7 is strapped high on the board
      text += String.fromCharCode(code & 0x7f);
    }
  };
  const press = (token: string): void => {
    keyboard.setToken(token, true);
    keyboard.setToken(token, false);
  };
  return { keyboard, buttons, drain, press };
}

/** A DOM key event, as much of one as the adapter reads. */
function key(
  k: string,
  mods: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
): KeyboardEvent {
  return { key: k, ...mods } as KeyboardEvent;
}

describe('apple1 keyboard', () => {
  it('sends one character on the way down and nothing on release', () => {
    const h = harness();
    h.keyboard.setToken('KeyA', true);
    h.keyboard.setToken('KeyA', false);
    h.keyboard.setToken('KeyA', false);
    expect(h.drain()).toBe('A');
  });

  it('resolves SHIFT inside the keyboard, as the encoder did', () => {
    const h = harness();
    h.keyboard.setToken('Shift', true);
    for (const token of ['Digit2', 'Digit4', 'Digit8', 'Digit9', 'KeyO']) {
      h.press(token);
    }
    h.keyboard.setToken('Shift', false);
    expect(h.drain()).toBe('"$()_');
  });

  it('leaves SHIFT inert on the letters that carry no second character', () => {
    expect(tokenToByte('KeyA', { shift: true })).toBe('A'.charCodeAt(0));
    expect(tokenToByte('KeyO', { shift: true })).toBe('_'.charCodeAt(0));
    expect(tokenToByte('Digit0', { shift: true })).toBe('0'.charCodeAt(0));
  });

  it('clears bits 5 and 6 for CTRL, which is how a program is stopped', () => {
    expect(tokenToByte('KeyC', { ctrl: true })).toBe(0x03);
    expect(tokenToByte('KeyG', { ctrl: true })).toBe(0x07);
  });

  it('gives the fixed keys their codes, Backspace included', () => {
    expect(tokenToByte('Enter')).toBe(0x0d);
    expect(tokenToByte('Escape')).toBe(0x1b);
    // The machine's only rub-out is the underline both firmwares read as one.
    expect(tokenToByte('Backspace')).toBe(0x5f);
    expect(tokenToByte('KeyEsc')).toBeNull();
  });

  it('sends nothing for the two buttons, which are not keys', () => {
    const h = harness();
    h.press(RESET_TOKEN);
    h.press(CLEAR_SCREEN_TOKEN);
    expect(h.drain()).toBe('');
    expect(h.buttons).toEqual({ resets: 1, clears: 1 });
  });

  it('queues ahead of the single latch the board really has', () => {
    const h = harness();
    h.keyboard.type('E000R\r');
    expect(h.keyboard.pending).toBe(6);
    expect(h.drain()).toBe('E000R\r');
    expect(h.keyboard.take()).toBeNull();
  });

  it('folds a host keyboard’s lower case, which the machine has no glyph for', () => {
    const h = harness();
    expect(h.keyboard.handleEvent(key('p'), true)).toBe(true);
    expect(h.keyboard.handleEvent(key('R'), true)).toBe(true);
    expect(h.keyboard.handleEvent(key('Enter'), true)).toBe(true);
    expect(h.drain()).toBe('PR\r');
  });

  it('claims CTRL combinations and declines the browser’s own modifiers', () => {
    const h = harness();
    expect(h.keyboard.handleEvent(key('c', { ctrlKey: true }), true)).toBe(
      true,
    );
    expect(h.keyboard.handleEvent(key('c', { metaKey: true }), true)).toBe(
      false,
    );
    expect(h.keyboard.handleEvent(key('ArrowLeft'), true)).toBe(false);
    expect(h.keyboard.handleEvent(key('A'), false)).toBe(false);
    expect(h.drain()).toBe('\x03');
  });

  it('drops modifiers and typeahead on release-all', () => {
    const h = harness();
    h.keyboard.setToken('Shift', true);
    h.press('KeyA');
    h.press('KeyB');
    h.keyboard.releaseAll();
    expect(h.drain()).toBe('');
    h.press('Digit2');
    expect(h.drain()).toBe('2'); // shift is no longer held
  });

  it('keeps the loader’s command through a release-all', () => {
    // The IDE releases every key whenever focus moves off the emulator - an
    // on-screen keyboard going away as a run starts, a blur, a pause - and the
    // `RUN` the loader types takes a field per character to go in. Dropping it
    // there leaves the machine at `>R`, waiting for the rest to be typed by
    // hand.
    const h = harness();
    h.keyboard.type('RUN\r');
    h.keyboard.releaseAll();
    expect(h.drain()).toBe('RUN\r');
  });

  it('takes the loader’s command before anything typed at it', () => {
    const h = harness();
    h.keyboard.type('RUN\r');
    h.press('KeyX'); // a keypress while the command is still going in
    expect(h.drain()).toBe('RUN\rX');
  });

  it('drops the loader’s command on a reset', () => {
    const h = harness();
    h.keyboard.type('RUN\r');
    h.keyboard.clearInput();
    expect(h.drain()).toBe('');
  });

  it('translates every token it advertises', () => {
    const modifiers = new Set([
      'Shift',
      'Control',
      RESET_TOKEN,
      CLEAR_SCREEN_TOKEN,
    ]);
    for (const token of apple1KeyTokens()) {
      if (modifiers.has(token)) continue;
      expect(tokenToByte(token), token).not.toBeNull();
    }
  });
});
