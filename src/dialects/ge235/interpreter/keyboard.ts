// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Typing at the Teletype, which is a queue rather than a matrix.
 *
 * Every machine here with a keyboard scans one: the ROM strobes rows and reads
 * columns, so the emulator has to model which keys are physically held. This
 * one has no keyboard at all. A Model 33 sends a character down the wire when a
 * key is struck and the machine sees nothing else - no key is ever "down" - so
 * this adapter turns key events and virtual-keyboard tokens into characters and
 * queues them for `INPUT` to take a line from.
 *
 * The ASR-33 has one alphabet, so everything typed arrives in upper case. Only
 * the characters the machine's own 6-bit set can carry are queued; the rest of
 * the teletype's shifted row has no code here and is dropped rather than
 * guessed at.
 */

/** How many keystrokes wait before the oldest is dropped. */
const MAX_PENDING = 32;

/** Punctuation keys, by the token a layout emits: [unshifted, shifted]. */
const PUNCTUATION: Record<string, [string, string]> = {
  Space: [' ', ' '],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Semicolon: [';', '+'],
  Colon: [':', '*'],
  Minus: ['-', '='],
  Quote: ['"', '"'],
};

/** The digit row's shifted markings, in the places this character set has one. */
const SHIFTED_DIGIT: Record<string, string> = {
  '2': '"',
  '8': '(',
  '9': ')',
};

export class Ge235Keyboard {
  private pending: string[] = [];
  private shift = false;

  reset(): void {
    this.pending.length = 0;
    this.shift = false;
  }

  releaseAll(): void {
    this.shift = false;
  }

  /** Translate a host keyboard event. Returns true when it was consumed. */
  handleEvent(e: KeyboardEvent, down: boolean): boolean {
    if (e.key === 'Shift') {
      this.shift = down;
      return true;
    }
    if (!down) return false;
    if (e.key === 'Enter') this.push('\r');
    else if (e.key === 'Backspace' || e.key === 'Delete') this.push('\b');
    else if (e.key.length === 1) this.push(e.key.toUpperCase());
    else return false;
    return true;
  }

  /** Press or release a virtual-keyboard key. */
  setToken(token: string, down: boolean): void {
    if (token === 'Shift' || token === 'ShiftLeft' || token === 'ShiftRight') {
      this.shift = down;
      return;
    }
    if (!down) return;
    if (token === 'Enter') {
      this.push('\r');
      return;
    }
    if (token === 'Rubout' || token === 'Backspace') {
      this.push('\b');
      return;
    }
    if (token.startsWith('Key') && token.length === 4) {
      this.push(token[3]!.toUpperCase());
      return;
    }
    if (token.startsWith('Digit') && token.length === 6) {
      const digit = token[5]!;
      this.push((this.shift && SHIFTED_DIGIT[digit]) || digit);
      return;
    }
    const pair = PUNCTUATION[token];
    if (pair) this.push(this.shift ? pair[1] : pair[0]);
  }

  /** The next character typed, or undefined when none is waiting. */
  takeChar(): string | undefined {
    return this.pending.shift();
  }

  private push(ch: string): void {
    this.pending.push(ch);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
  }
}
