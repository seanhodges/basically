// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it, vi } from 'vitest';
import {
  Apple2Keyboard,
  apple2KeyTokens,
  REPEAT_TOKEN,
  RESET_TOKEN,
  tokenToByte,
} from './keyboard';

function keyboard(reset = vi.fn()): {
  kb: Apple2Keyboard;
  reset: ReturnType<typeof vi.fn>;
} {
  return { kb: new Apple2Keyboard({ reset }), reset };
}

/** Everything the latch has taken, as text. */
function drain(kb: Apple2Keyboard): string {
  let text = '';
  for (;;) {
    const code = kb.take();
    if (code === null) return text;
    // Every code arrives with bit 7 set - the strobe the encoder raises with it.
    expect(code & 0x80).toBe(0x80);
    text += String.fromCharCode(code & 0x7f);
  }
}

describe('tokenToByte', () => {
  it('sends upper case, the digits and the punctuation the caps carry', () => {
    expect(tokenToByte('KeyA')).toBe(0x41);
    expect(tokenToByte('Digit7')).toBe(0x37);
    expect(tokenToByte('Digit7', { shift: true })).toBe("'".charCodeAt(0));
    expect(tokenToByte('Semicolon', { shift: true })).toBe('+'.charCodeAt(0));
    expect(tokenToByte('Colon', { shift: true })).toBe('*'.charCodeAt(0));
    expect(tokenToByte('Minus', { shift: true })).toBe('='.charCodeAt(0));
    expect(tokenToByte('KeyP', { shift: true })).toBe('@'.charCodeAt(0));
    expect(tokenToByte('KeyN', { shift: true })).toBe('^'.charCodeAt(0));
  });

  it('has no lower case and no underline to send', () => {
    // The encoder produces $20-$5F and the generator draws exactly those 64
    // shapes; `_` is not on any key cap on this machine.
    for (const token of apple2KeyTokens()) {
      const byte = tokenToByte(token, { shift: true });
      if (byte === null) continue;
      expect(byte).toBeLessThanOrEqual(0x5f);
      expect(byte).not.toBe(0x5f);
    }
  });

  it('clears bits 6 and 5 under CTRL', () => {
    expect(tokenToByte('KeyC', { ctrl: true })).toBe(0x03);
    expect(tokenToByte('KeyG', { ctrl: true })).toBe(0x07);
  });

  it('gives the arrows and RETURN their own codes', () => {
    expect(tokenToByte('Enter')).toBe(0x0d);
    expect(tokenToByte('Escape')).toBe(0x1b);
    expect(tokenToByte('ArrowLeft')).toBe(0x08);
    expect(tokenToByte('ArrowRight')).toBe(0x15);
  });

  it('translates every token the layout can name', () => {
    for (const token of apple2KeyTokens()) {
      const special =
        token === RESET_TOKEN ||
        token === REPEAT_TOKEN ||
        token === 'Shift' ||
        token === 'Control';
      expect(tokenToByte(token) === null).toBe(special);
    }
  });
});

describe('Apple2Keyboard', () => {
  it('queues what is typed and hands it over a character at a time', () => {
    const { kb } = keyboard();
    for (const token of ['KeyH', 'KeyI', 'Enter']) {
      kb.setToken(token, true);
      kb.setToken(token, false);
    }
    expect(kb.pending).toBe(3);
    expect(drain(kb)).toBe('HI\r');
    expect(kb.take()).toBeNull();
  });

  it('holds the modifiers rather than sending them', () => {
    const { kb } = keyboard();
    kb.setToken('Shift', true);
    kb.setToken('Digit2', true);
    kb.setToken('Digit2', false);
    kb.setToken('Shift', false);
    expect(drain(kb)).toBe('"');
  });

  it('sends RESET to the board and no character to the latch', () => {
    const { kb, reset } = keyboard();
    kb.setToken(RESET_TOKEN, true);
    kb.setToken(RESET_TOKEN, false);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(kb.pending).toBe(0);
  });

  it('puts the loader command ahead of the user typeahead, and keeps it', () => {
    const { kb } = keyboard();
    kb.setToken('KeyX', true);
    kb.type('RUN\r');
    // "Release every key" is a blur or a stopped run; it has no business
    // abandoning a console command already half sent.
    kb.releaseAll();
    expect(drain(kb)).toBe('RUN\r');
  });

  it('repeats the last character while REPT is held', () => {
    const { kb } = keyboard();
    kb.setToken('KeyA', true);
    kb.setToken('KeyA', false);
    expect(drain(kb)).toBe('A');
    kb.setToken(REPEAT_TOKEN, true);
    let repeats = '';
    for (let field = 0; field < 30; field++) {
      kb.endField();
      repeats += drain(kb);
    }
    expect(repeats).toBe('AAAAA');
    kb.setToken(REPEAT_TOKEN, false);
    for (let field = 0; field < 30; field++) kb.endField();
    expect(kb.pending).toBe(0);
  });

  it('takes what the host keyboard reports, folded to upper case', () => {
    const { kb } = keyboard();
    expect(kb.handleEvent({ key: 'a' } as KeyboardEvent, true)).toBe(true);
    expect(kb.handleEvent({ key: 'Enter' } as KeyboardEvent, true)).toBe(true);
    // Backspace is not a key this machine has; it goes in as the left arrow.
    expect(kb.handleEvent({ key: 'Backspace' } as KeyboardEvent, true)).toBe(
      true,
    );
    expect(
      kb.handleEvent({ key: 'c', ctrlKey: true } as KeyboardEvent, true),
    ).toBe(true);
    expect([...drain(kb)].map((ch) => ch.charCodeAt(0))).toEqual([
      0x41, 0x0d, 0x08, 0x03,
    ]);
  });

  it('ignores releases, shortcuts and keys the machine has no code for', () => {
    const { kb } = keyboard();
    expect(kb.handleEvent({ key: 'A' } as KeyboardEvent, false)).toBe(false);
    expect(
      kb.handleEvent({ key: 'a', metaKey: true } as KeyboardEvent, true),
    ).toBe(false);
    expect(kb.handleEvent({ key: 'F1' } as KeyboardEvent, true)).toBe(false);
    expect(kb.handleEvent({ key: '~' } as KeyboardEvent, true)).toBe(false);
    expect(kb.pending).toBe(0);
  });
});
