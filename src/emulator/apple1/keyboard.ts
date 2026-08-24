// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple I's keyboard: an ASCII latch, not a matrix.
 *
 * The machine has no keyboard of its own. The board carries a 16-pin connector
 * expecting a fully encoded ASCII keyboard - the owner's own, usually a surplus
 * Datanetics or Cherry unit - which presents seven bits of ASCII on PA0-PA6 and
 * pulses a strobe into CA1 when a key goes down. PA7 is strapped to +5V on the
 * board itself, which is why every code the machine ever sees has bit 7 set and
 * why `PEEK(-12272)` on a waiting `A` answers 193 rather than 65.
 *
 * So nothing here is ever "held": a key sends one character on the way down and
 * nothing at all on the way up, and only SHIFT and CTRL carry state - neither
 * of which the machine can see, because both are resolved inside the keyboard.
 * The two buttons on the board are not keys at all and are reported separately:
 * CLEAR SCREEN is wired to the video logic and RESET to the CPU's reset line,
 * and neither reaches the PIA.
 *
 * ### Typeahead
 *
 * The latch holds exactly one character, and a fast typist really could lose
 * one. {@link Apple1Keyboard} keeps a queue in front of it anyway and drains it
 * one character at a time as the machine takes them: the host's key events
 * arrive in bursts a real keyboard could never produce - a paste, or the
 * command the loader types to start BASIC - and dropping those would be
 * modelling the typist rather than the machine.
 *
 * ### What the keys send
 *
 * SHIFT's second character is a fact about key caps rather than about the
 * Apple I, and the arrangement below is the one the ASCII keyboards of the
 * period shared: the digits carry `!` to `)`, the punctuation keys carry the
 * comparison and arithmetic symbols BASIC needs, and six letters carry the
 * remaining ASCII punctuation. `O` is the one to know - it carries `_`, the
 * character both the monitor and Integer BASIC read as "rub out the last one
 * typed", and the only backspace this machine has.
 *
 * CTRL is the other half of the same encoding: it clears bits 5 and 6, so a key
 * sends `code & 0x1F`.
 */

/** The unshifted character of every printing key, by layout token. */
const UNSHIFTED: Record<string, string> = {
  Space: ' ',
  Colon: ':',
  Semicolon: ';',
  Comma: ',',
  Minus: '-',
  Period: '.',
  Slash: '/',
};
for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  UNSHIFTED[`Key${letter}`] = letter;
}
for (const digit of '0123456789') {
  UNSHIFTED[`Digit${digit}`] = digit;
}

/** The second character on a key face, where the key has one. */
const SHIFTED: Record<string, string> = {
  Digit1: '!',
  Digit2: '"',
  Digit3: '#',
  Digit4: '$',
  Digit5: '%',
  Digit6: '&',
  Digit7: "'",
  Digit8: '(',
  Digit9: ')',
  Colon: '*',
  Semicolon: '+',
  Comma: '<',
  Minus: '=',
  Period: '>',
  Slash: '?',
  KeyK: '[',
  KeyL: '\\',
  KeyM: ']',
  KeyN: '^',
  KeyO: '_',
  KeyP: '@',
};

/** Keys that send one fixed code whatever the modifiers are. */
const FIXED: Record<string, number> = {
  Enter: 0x0d, // RETURN
  Escape: 0x1b, // the monitor's "abandon this line"
  /**
   * Not a key an Apple I keyboard had: a host keyboard's Backspace, mapped to
   * the underline both the monitor and Integer BASIC read as a rub-out. Without
   * it Backspace would do nothing, which reads as a broken emulator.
   */
  Backspace: 0x5f,
};

/** The two buttons on the board, which send no character at all. */
export const RESET_TOKEN = 'Reset';
export const CLEAR_SCREEN_TOKEN = 'ClearScreen';

const SHIFT_TOKENS = new Set(['Shift', 'ShiftLeft', 'ShiftRight']);
const CTRL_TOKENS = new Set(['Control', 'ControlLeft', 'ControlRight']);

/** Named DOM keys that map to a fixed code, by `KeyboardEvent.key`. */
const DOM_KEYS: Record<string, number> = {
  Enter: FIXED.Enter!,
  Escape: FIXED.Escape!,
  Backspace: FIXED.Backspace!,
};

/**
 * The byte a key sends with the given modifiers, or null when the token is not
 * a key this keyboard has. Exported so the layout test can check that every
 * token the Apple I rows emit is one the machine translates.
 */
export function tokenToByte(
  token: string,
  mods: { shift?: boolean; ctrl?: boolean } = {},
): number | null {
  const fixed = FIXED[token];
  if (fixed !== undefined) return fixed;

  const face = (mods.shift ? SHIFTED[token] : undefined) ?? UNSHIFTED[token];
  if (face === undefined) return null;
  const code = face.charCodeAt(0);
  return mods.ctrl ? code & 0x1f : code;
}

/** Every token {@link tokenToByte} understands, plus the modifiers and buttons. */
export function apple1KeyTokens(): string[] {
  return [
    ...Object.keys(UNSHIFTED),
    ...Object.keys(FIXED),
    'Shift',
    'Control',
    RESET_TOKEN,
    CLEAR_SCREEN_TOKEN,
  ];
}

/** What the board does with the two buttons that are not keys. */
export interface Apple1Buttons {
  /** RESET: pulses the CPU's reset line and the PIA's. */
  reset(): void;
  /** CLEAR SCREEN: blanks the display, without the CPU knowing. */
  clearScreen(): void;
}

export class Apple1Keyboard {
  private shift = false;
  private ctrl = false;
  private readonly queue: number[] = [];

  constructor(private readonly buttons: Apple1Buttons) {}

  /** Characters typed but not yet taken by the machine. */
  get pending(): number {
    return this.queue.length;
  }

  /**
   * The next character for the latch, or null when nothing is waiting. The
   * machine calls this when the latch is free; the character is handed over
   * with bit 7 set, as the board's strapped PA7 presents it.
   */
  take(): number | null {
    const code = this.queue.shift();
    return code === undefined ? null : code | 0x80;
  }

  /** Queue text as if it had been typed - the loader's console commands. */
  type(text: string): void {
    for (const ch of text) {
      const code = ch === '\n' ? 0x0d : ch.charCodeAt(0);
      this.queue.push(code & 0x7f);
    }
  }

  /** Drop anything typed but not yet taken (a reset, a new program). */
  clearInput(): void {
    this.queue.length = 0;
  }

  /**
   * A virtual-keyboard token press. Only the press sends anything: the keyboard
   * transmits once on the way down and nothing on release.
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
    if (token === RESET_TOKEN) {
      this.buttons.reset();
      return;
    }
    if (token === CLEAR_SCREEN_TOKEN) {
      this.buttons.clearScreen();
      return;
    }
    const byte = tokenToByte(token, { shift: this.shift, ctrl: this.ctrl });
    if (byte !== null) this.queue.push(byte);
  }

  /**
   * A physical DOM key event; returns true when consumed.
   *
   * A host keyboard is not a 1976 ASCII keyboard, so this path works from the
   * character the browser reports rather than from the key-cap table above:
   * whatever the user's own layout produces is what an Apple I owner's own
   * keyboard would have produced. Lower case folds to upper, because the
   * character generator has no lower case and the interpreter refuses it.
   */
  handleEvent(e: KeyboardEvent, down: boolean): boolean {
    if (!down) return false; // nothing is transmitted on release
    if (e.metaKey || e.altKey) return false;

    const named = DOM_KEYS[e.key];
    if (named !== undefined) {
      this.queue.push(named);
      return true;
    }

    if (e.key.length !== 1) return false; // a modifier, a function key, an arrow
    const upper = e.key.toUpperCase();
    const code = upper.charCodeAt(0);

    // CTRL-<key> is how the control codes are typed at all, so it is claimed
    // here even though it costs the browser's own shortcuts while the emulator
    // has focus.
    if (e.ctrlKey) {
      this.queue.push(code & 0x1f);
      return true;
    }
    if (code < 0x20 || code > 0x5f) return false;
    this.queue.push(code);
    return true;
  }

  /** Drop modifier state and anything typed ahead (stop, blur, unmount). */
  releaseAll(): void {
    this.shift = false;
    this.ctrl = false;
    this.queue.length = 0;
  }
}
