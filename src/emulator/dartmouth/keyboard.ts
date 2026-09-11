// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DartmouthCharset } from './profile';

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
 * The ASR-33 has one alphabet, so everything typed arrives in upper case.
 *
 * **The keyboard belongs to the terminal; the narrowing belongs to the
 * machine.** The tables below are the whole Model 33 key face - every key it
 * has, and both markings of each - because the same terminal stood in front of
 * every machine in this family. What differs is what the machine at the far end
 * of the wire has a code for, so a character is queued only when the profile's
 * charset can say it: on a machine speaking six-bit BCD that drops most of the
 * shifted digit row, and on one speaking ASCII it drops nothing at all.
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
 * The digit row's shifted markings, the whole row of them.
 *
 * SHIFT flips bit 4 of the character a key sends, so the digits `0`-`9` shift
 * to `0x20`-`0x29`: space, then `! " # $ % & ' ( )`.
 */
const SHIFTED_DIGIT: Record<string, string> = {
  '0': ' ',
  '1': '!',
  '2': '"',
  '3': '#',
  '4': '$',
  '5': '%',
  '6': '&',
  '7': "'",
  '8': '(',
  '9': ')',
};

/**
 * The letter keys' shifted markings, by the same bit-4 flip: P K L M N O send
 * `@ [ \ ] ↑ ←`. The last two are what this terminal prints where a later
 * keyboard prints `^` and `_`, and the up arrow is not decoration but the
 * exponent operator Dartmouth BASIC raises to a power with.
 */
const SHIFTED_LETTER: Record<string, string> = {
  K: '[',
  L: '\\',
  M: ']',
  N: '↑',
  O: '←',
  P: '@',
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
 * Every character one machine's set has a code for, read off the set itself
 * rather than listed: the codes it prints something for are the characters it
 * can carry, and a keystroke producing anything else would put a character on
 * the paper tape that no reader of it could show.
 */
function sayableChars(charset: DartmouthCharset): Set<string> {
  const chars = new Set<string>();
  for (let code = 0; code <= charset.codeMask; code++) {
    const ch = charset.plainChar(code);
    if (ch !== undefined) chars.add(ch);
  }
  return chars;
}

/**
 * The character a virtual-keyboard token types on this machine, or undefined
 * where the terminal's key face has none for it or the machine's set cannot
 * say the one it has. Pure, so a layout's SYM cells can be checked against it:
 * a cell claiming to insert `[` must press a combination that really sends `[`.
 */
export function tokenToChar(
  charset: DartmouthCharset,
  token: string,
  shift = false,
): string | undefined {
  const ch = keyFace(token, shift);
  return ch !== undefined && sayableChars(charset).has(ch) ? ch : undefined;
}

/** What the Model 33's key face sends, before any machine narrows it. */
function keyFace(token: string, shift: boolean): string | undefined {
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
export function dartmouthKeyTokens(): string[] {
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
 * Every character the adapter can produce from {@link dartmouthKeyTokens} on
 * one machine. The layout's test holds itself to this set: a character the
 * machine can type and no keycap or SYM cell offers is one the on-screen
 * keyboard cannot reach.
 */
export function dartmouthTypeableChars(charset: DartmouthCharset): string[] {
  const chars = new Set<string>();
  for (const token of dartmouthKeyTokens()) {
    for (const shift of [false, true]) {
      const ch = tokenToChar(charset, token, shift);
      if (ch !== undefined) chars.add(ch);
    }
  }
  return [...chars];
}

export class DartmouthKeyboard {
  private pending: string[] = [];
  private shift = false;
  /** What this machine can say: the filter every keystroke passes through. */
  private readonly sayable: Set<string>;

  constructor(charset: DartmouthCharset) {
    this.sayable = sayableChars(charset);
  }

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
    else if (e.key.length === 1) {
      // A host keyboard reaches characters no Model 33 has, and the machine at
      // the far end has codes for fewer still: one it cannot say is not typed.
      const ch = e.key.toUpperCase();
      if (!this.sayable.has(ch)) return false;
      this.push(ch);
    } else return false;
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
    const ch = keyFace(token, this.shift);
    if (ch !== undefined && this.sayable.has(ch)) this.push(ch);
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
