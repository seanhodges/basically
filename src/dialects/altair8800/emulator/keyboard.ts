// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Altair8800Serial } from './serial';

/**
 * Keyboard input for the Altair - a queue, not a matrix.
 *
 * Every other machine here scans a key matrix: the ROM strobes rows and reads
 * columns, so the emulator models which keys are physically *held*. The Altair
 * has no keyboard at all. Characters arrive over the serial line already
 * encoded as ASCII, one per keystroke, so this adapter turns key tokens and DOM
 * key events into bytes and hands them to {@link Altair8800Serial}'s input
 * queue. Nothing is ever "held down" except the two modifiers, which are not
 * keys the machine can see at all.
 *
 * That difference is worth preserving in the virtual keyboard's tokens too:
 * `setKey` receives DOM-code-style tokens from the ASR-33 layout (Stage 3), and
 * this module maps them - with the SHIFT layer and the CTRL combinations the
 * teletype offered - to the single byte the machine would have received.
 * CTRL-C (0x03) matters most: it is how a running Altair BASIC program is
 * interrupted.
 *
 * ### How the ASR-33 shifted
 *
 * The teletype's keyboard is a code-bar mechanism, not a lookup table, and its
 * SHIFT does one thing: it flips bit 4 (0x10) of the character the key would
 * otherwise send. That single rule reproduces the whole of the machine's
 * shifted row - `1`/`!` (0x31/0x21), `0`/space (0x30/0x20), `:`/`*`, `-`/`=`,
 * `;`/`+`, `,`/`<`, `.`/`>`, `/`/`?` - and also the shifted letters that
 * surprise people coming from a modern keyboard: `K`/`[` (0x4B/0x5B), `L`/`\`,
 * `M`/`]`, `N`/`^`, `O`/`_` and `P`/`@` (0x50/0x40). Those six are the only
 * letters with a second marking on the key face; A-J and Q-Z have none, because
 * flipping their bit 4 would land on another letter, so SHIFT is inert there
 * and they type the same character either way.
 *
 * CTRL is the same kind of rule from the other end: it clears bits 5 and 6, so
 * a key sends `code & 0x1F`. CTRL-C is 0x43 & 0x1F = 0x03, the break; CTRL-G is
 * the bell; SHIFT-K with CTRL gives 0x1B, escape. SHIFT is applied first,
 * exactly as the mechanism did.
 */

/** Letters A-Z: `KeyA` … `KeyZ`. */
const LETTER_TOKENS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Digits 0-9: `Digit0` … `Digit9`. */
const DIGIT_TOKENS = '0123456789';

/**
 * The punctuation and whitespace keys of the ASR-33, by the DOM-code-style
 * token the layout emits. The shifted forms are *not* listed: they follow from
 * the bit-4 rule above.
 */
const PUNCTUATION: Record<string, string> = {
  Space: ' ',
  Colon: ':',
  Minus: '-',
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
};

/**
 * The keys that send a fixed control code whatever the modifiers are - the
 * teletype's own function keys, down the right-hand side of the keyboard.
 */
const CONTROL_KEYS: Record<string, number> = {
  Enter: 0x0d, // RETURN
  LineFeed: 0x0a, // LINE FEED
  Rubout: 0x7f, // RUB OUT (all holes punched)
  Escape: 0x1b, // ALT MODE on the teletype, ESC on later terminals
  /**
   * Not an ASR-33 key at all: a host keyboard's Backspace, mapped to the
   * underline BASIC itself treats as "delete the last character typed" (the
   * manual's back-arrow). Without it Backspace would do nothing at the console,
   * which reads as a broken emulator rather than a faithful one.
   */
  Backspace: 0x5f,
};

/** Named DOM keys that map to a control code, by `KeyboardEvent.key` value. */
const DOM_KEY_CODES: Record<string, number> = {
  Enter: CONTROL_KEYS.Enter!,
  Backspace: CONTROL_KEYS.Backspace!,
  Delete: CONTROL_KEYS.Rubout!,
  Escape: CONTROL_KEYS.Escape!,
};

/** Tokens the layout may declare for the two modifiers. */
const SHIFT_TOKENS = new Set(['Shift', 'ShiftLeft', 'ShiftRight']);
const CTRL_TOKENS = new Set(['Control', 'ControlLeft', 'ControlRight']);

/** The unshifted ASCII a printing key sends, or undefined if it is not one. */
function baseChar(token: string): number | undefined {
  if (token.startsWith('Key') && token.length === 4) {
    const letter = token[3]!;
    return LETTER_TOKENS.includes(letter) ? letter.charCodeAt(0) : undefined;
  }
  if (token.startsWith('Digit') && token.length === 6) {
    const digit = token[5]!;
    return DIGIT_TOKENS.includes(digit) ? digit.charCodeAt(0) : undefined;
  }
  return PUNCTUATION[token]?.charCodeAt(0);
}

/**
 * Whether SHIFT does anything on the key that sends `code`. Every key with a
 * second marking on its face flips bit 4; the letters other than K-P have none
 * (the flip would land on another letter), and neither has the space bar, which
 * is its own mechanism rather than a code bar.
 */
function hasShiftedForm(code: number): boolean {
  if (code === 0x20) return false; // space bar
  const isLetter = code >= 0x41 && code <= 0x5a;
  return !isLetter || (code >= 0x4b && code <= 0x50); // K L M N O P
}

/**
 * The byte a key sends with the given modifiers, or null when the token is not
 * a key this machine has. Exported so the Stage 3 layout test can check that
 * every token the ASR-33 rows emit is one the machine actually translates.
 */
export function tokenToByte(
  token: string,
  mods: { shift?: boolean; ctrl?: boolean } = {},
): number | null {
  const fixed = CONTROL_KEYS[token];
  if (fixed !== undefined) return fixed;

  const base = baseChar(token);
  if (base === undefined) return null;

  const shifted = mods.shift && hasShiftedForm(base) ? base ^ 0x10 : base;
  return mods.ctrl ? shifted & 0x1f : shifted;
}

/** Every token {@link tokenToByte} understands, modifiers included. */
export function altair8800KeyTokens(): string[] {
  return [
    ...[...LETTER_TOKENS].map((c) => `Key${c}`),
    ...[...DIGIT_TOKENS].map((c) => `Digit${c}`),
    ...Object.keys(PUNCTUATION),
    ...Object.keys(CONTROL_KEYS),
    'Shift',
    'Control',
  ];
}

export class Altair8800Keyboard {
  private shift = false;
  private ctrl = false;

  constructor(private readonly serial: Altair8800Serial) {}

  /**
   * Translate a virtual-keyboard token press into a queued ASCII byte.
   *
   * Only the press sends anything: a teletype key transmitted its character
   * once, on the way down, and nothing at all on the way up. The two modifiers
   * are the exception - they hold state and send nothing themselves.
   */
  setToken(token: string, down: boolean): void {
    if (SHIFT_TOKENS.has(token)) {
      this.shift = down;
      return;
    }
    if (CTRL_TOKENS.has(token)) {
      this.ctrl = down;
      return;
    }
    if (!down) return;
    const byte = tokenToByte(token, { shift: this.shift, ctrl: this.ctrl });
    if (byte !== null) this.serial.queueInput(byte);
  }

  /**
   * Translate a physical DOM key event; returns true when consumed.
   *
   * A host keyboard is not an ASR-33, so this path works from the character the
   * browser reports rather than the teletype's code bars: whatever the user's
   * layout produces is sent as-is if it is a printable 7-bit character, and the
   * named keys and CTRL combinations are handled explicitly. Lower case is
   * passed through unfolded - the interpreter folds it to upper case itself
   * outside string literals, and inside one the user meant it.
   */
  handleEvent(e: KeyboardEvent, down: boolean): boolean {
    if (!down) return false; // nothing is transmitted on release

    const named = DOM_KEY_CODES[e.key];
    if (named !== undefined) {
      this.serial.queueInput(named);
      return true;
    }

    if (e.key.length !== 1) return false; // a modifier, a function key, an arrow
    const code = e.key.charCodeAt(0);
    if (code < 0x20 || code > 0x7e) return false;

    // CTRL-<key> is how a running program is broken (CTRL-C) and how the
    // teletype's control codes were typed at all, so it is claimed here even
    // though it costs the browser's own CTRL shortcuts while the emulator has
    // focus.
    if (e.ctrlKey) {
      this.serial.queueInput(code & 0x1f);
      return true;
    }
    if (e.altKey || e.metaKey) return false;

    this.serial.queueInput(code);
    return true;
  }

  /** Drop any modifier state (stop, blur, unmount). */
  releaseAll(): void {
    this.shift = false;
    this.ctrl = false;
  }
}
