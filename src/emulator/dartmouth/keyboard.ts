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

/**
 * The teletype's own punctuation keys, by the token a layout emits:
 * [unshifted, shifted]. There is no quote key among them - `"` is SHIFT-2 on a
 * Model 33, and the on-screen quote keycap presses that pair.
 */
const PUNCTUATION: Record<string, [string, string]> = {
  Space: [' ', ' '],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Semicolon: [';', '+'],
  Colon: [':', '*'],
  Minus: ['-', '='],
};

/**
 * The digit row's shifted markings, in the places this character set has one.
 *
 * SHIFT flips bit 4 of the character a key sends, so the digits `0`-`9` shift
 * to ASCII `0x20`-`0x29`: space, then `! " # $ % & ' ( )`. Five of those nine
 * have a BCD code here and are queued; `! # % & '` have none and are dropped.
 */
const SHIFTED_DIGIT: Record<string, string> = {
  '0': ' ',
  '2': '"',
  '4': '$',
  '8': '(',
  '9': ')',
};

/**
 * The letter keys' shifted markings, by the same bit-4 flip: `@ [ \ ] ^ _` sit
 * on P K L M N O. Four have a BCD code and are queued - and one of them is not
 * decoration but the exponent operator, because `↑` is what the ASR-33 prints
 * where a later keyboard prints `^`. `@` and `_` have no code and are dropped.
 */
const SHIFTED_LETTER: Record<string, string> = {
  K: '[',
  L: '\\',
  M: ']',
  N: '↑',
};

/** Enter, and the RUB OUT key BASIC's line editor reads as a backspace. */
const ACTION_TOKENS: Record<string, string> = {
  Enter: '\r',
  Rubout: '\b',
};

/**
 * Host-keyboard names for keys the teletype calls something else, accepted so a
 * caller holding a browser's token still reaches the right character. No layout
 * emits these - the keycaps carry the machine's own names.
 */
const HOST_ALIASES: Record<string, string> = {
  Backspace: '\b',
  Quote: '"',
};

/**
 * The character a virtual-keyboard token types, or undefined where this machine
 * has none for it. Pure, so a layout's SYM cells can be checked against it: a
 * cell claiming to insert `[` must press a combination that really sends `[`.
 */
export function tokenToChar(token: string, shift = false): string | undefined {
  if (token.startsWith('Key') && token.length === 4) {
    const letter = token[3]!.toUpperCase();
    return (shift && SHIFTED_LETTER[letter]) || letter;
  }
  if (token.startsWith('Digit') && token.length === 6) {
    const digit = token[5]!;
    return (shift && SHIFTED_DIGIT[digit]) || digit;
  }
  return PUNCTUATION[token]?.[shift ? 1 : 0];
}

/**
 * Every token a keyboard layout may emit for this machine: the printing keys
 * {@link tokenToChar} translates, the two that act rather than print, and
 * SHIFT. The {@link HOST_ALIASES}, `ShiftLeft` and `ShiftRight` are accepted
 * too but are not here: they are the host keyboard's names for keys the
 * teletype calls something else, not keycaps a layout should carry.
 */
export function ge235KeyTokens(): string[] {
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => `Key${c}`);
  const digits = [...'0123456789'].map((d) => `Digit${d}`);
  return [
    ...letters,
    ...digits,
    ...Object.keys(PUNCTUATION),
    ...Object.keys(ACTION_TOKENS),
    'Shift',
  ];
}

/**
 * Every character the adapter can produce from {@link ge235KeyTokens}. The
 * layout's test holds itself to this set: a character the machine can type and
 * no keycap or SYM cell offers is one the on-screen keyboard cannot reach.
 */
export function ge235TypeableChars(): string[] {
  const chars = new Set<string>();
  for (const token of ge235KeyTokens()) {
    for (const shift of [false, true]) {
      const ch = tokenToChar(token, shift);
      if (ch !== undefined) chars.add(ch);
    }
  }
  return [...chars];
}

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
    const action = ACTION_TOKENS[token] ?? HOST_ALIASES[token];
    if (action !== undefined) {
      this.push(action);
      return;
    }
    const ch = tokenToChar(token, this.shift);
    if (ch !== undefined) this.push(ch);
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
