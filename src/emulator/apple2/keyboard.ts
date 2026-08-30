// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple II's keyboard: an encoded ASCII latch, one character deep.
 *
 * Unlike the Apple I's connector the keyboard is part of the machine, but what
 * reaches the CPU is the same shape: an encoder resolves SHIFT and CTRL itself
 * and presents seven bits of ASCII at `$C000` with bit 7 set as the strobe. The
 * strobe stays up until something touches `$C010`, so software reads the byte,
 * clears the strobe and comes back for the next one - `LDA $C000 / BPL wait /
 * BIT $C010` is the shape of every input loop on the machine.
 *
 * ### It does not interrupt anything
 *
 * A key press sets a flag and nothing more: there is no interrupt, and a
 * running BASIC program keeps running. That is the difference from the Apple I
 * that matters most to this IDE, because it is what lets a program poll
 * `PEEK(-16384)` for a key, clear the strobe with `POKE -16368,0` and carry on -
 * the loop every real Apple II game was built around, and the reason this
 * machine can run an arcade sample at all.
 *
 * ### What the keys send
 *
 * The 1977 keyboard has no lower case and no `_`: the encoder produces
 * `$20`-`$5F` and nothing else, which is exactly the 64 shapes the character
 * generator can draw. SHIFT's second character is a fact about the key caps -
 * `:` carries `*`, `;` carries `+`, `-` carries `=`, and `P`, `K`, `L`, `M` and
 * `N` carry `@`, `[`, `\`, `]` and `^` - and CTRL clears bits 6 and 5, so a key
 * sends `code & 0x1F`.
 *
 * The two arrows are keys of their own rather than shifted anything: left sends
 * `$08` (this machine's backspace, which is what the interpreter's line editor
 * reads as a rub-out) and right sends `$15`. RESET is not a key at all - it is
 * wired to the CPU's reset line and never reaches the latch.
 *
 * ### Typeahead and REPT
 *
 * The latch holds one character, and a queue sits in front of it for the same
 * reason the Apple I's does: the host's key events arrive in bursts a real
 * typist could not produce, and the loader's own console commands go in a
 * character at a time. The two queues are kept apart so that "release every
 * key" - a blur, a stopped run - throws away the user's typeahead without
 * abandoning half of a `RUN` already in flight.
 *
 * REPT is the machine's auto-repeat: held alongside another key it re-sends
 * that key's character several times a second, which is how a listing is
 * scrolled and a line of dashes is drawn. It is the one key here with a rate,
 * and {@link Apple2Keyboard.endField} is what clocks it.
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
  KeyP: '@',
};

/** Keys that send one fixed code whatever the modifiers are. */
const FIXED: Record<string, number> = {
  Enter: 0x0d, // RETURN
  Escape: 0x1b, // ESC
  ArrowLeft: 0x08, // the machine's backspace
  ArrowRight: 0x15,
};

/** The button wired to the CPU's reset line, which sends no character. */
export const RESET_TOKEN = 'Reset';
/** Auto-repeat, held alongside the key being repeated. */
export const REPEAT_TOKEN = 'Rept';

const SHIFT_TOKENS = new Set(['Shift', 'ShiftLeft', 'ShiftRight']);
const CTRL_TOKENS = new Set(['Control', 'ControlLeft', 'ControlRight']);

/** Named DOM keys that map to a fixed code, by `KeyboardEvent.key`. */
const DOM_KEYS: Record<string, number> = {
  Enter: FIXED.Enter!,
  Escape: FIXED.Escape!,
  ArrowLeft: FIXED.ArrowLeft!,
  ArrowRight: FIXED.ArrowRight!,
  // Not a key this keyboard has: a host Backspace, sent as the left arrow the
  // line editor reads as a rub-out. Without it Backspace does nothing, which
  // reads as a broken emulator.
  Backspace: FIXED.ArrowLeft!,
};

/**
 * Video fields between auto-repeats while REPT is held: ten characters a
 * second, which is the rate the encoder's repeat oscillator is described as
 * running at and is chosen to feel right rather than read off the schematic.
 */
const REPEAT_FIELDS = 6;

/**
 * The byte a key sends with the given modifiers, or null when the token is not
 * a key this keyboard has. Exported so the layout test can check that every
 * token the rows emit is one the machine translates.
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

/** Every token {@link tokenToByte} understands, plus the modifiers and RESET. */
export function apple2KeyTokens(): string[] {
  return [
    ...Object.keys(UNSHIFTED),
    ...Object.keys(FIXED),
    'Shift',
    'Control',
    REPEAT_TOKEN,
    RESET_TOKEN,
  ];
}

/** What the board does with the key that is not a key. */
export interface Apple2Buttons {
  /** RESET: pulses the CPU's reset line, leaving RAM alone. */
  reset(): void;
}

export class Apple2Keyboard {
  private shift = false;
  private ctrl = false;
  private repeating = false;
  /** The last character sent, which REPT re-sends. */
  private lastByte: number | null = null;
  /** Fields left before the next auto-repeat. */
  private repeatCountdown = REPEAT_FIELDS;
  /** What the user typed ahead of the latch. */
  private readonly queue: number[] = [];
  /** The loader's console command, still going in a character per field. */
  private readonly command: number[] = [];

  constructor(private readonly buttons: Apple2Buttons) {}

  /** Characters typed but not yet taken by the machine. */
  get pending(): number {
    return this.command.length + this.queue.length;
  }

  /**
   * The next character for the latch, or null when nothing is waiting. Handed
   * over with bit 7 set, which is the strobe the encoder raises with it.
   *
   * The loader's command goes first: a key the user pressed while `RUN` was
   * still being typed belongs after it, not in the middle of it.
   */
  take(): number | null {
    const code = this.command.shift() ?? this.queue.shift();
    if (code === undefined) return null;
    this.lastByte = code;
    return code | 0x80;
  }

  /** Queue text as if it had been typed - the loader's console commands. */
  type(text: string): void {
    for (const ch of text) {
      const code = ch === '\n' ? 0x0d : ch.charCodeAt(0);
      this.command.push(code & 0x7f);
    }
  }

  /** Drop anything typed but not yet taken (a reset, a new program). */
  clearInput(): void {
    this.command.length = 0;
    this.queue.length = 0;
    this.lastByte = null;
  }

  /**
   * One video field. REPT's repeat rate is counted in these, so a held REPT
   * repeats at the same speed whether the machine is free-running or being
   * stepped a slice at a time.
   */
  endField(): void {
    if (!this.repeating || this.lastByte === null) return;
    if (this.pending > 0) return; // nothing to repeat into a full queue
    if (--this.repeatCountdown > 0) return;
    this.repeatCountdown = REPEAT_FIELDS;
    this.queue.push(this.lastByte);
  }

  /**
   * A virtual-keyboard token press. Only the press sends anything: the encoder
   * transmits once on the way down, and REPT rather than the key itself is
   * what makes a held key repeat.
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
    if (token === REPEAT_TOKEN) {
      this.repeating = down;
      this.repeatCountdown = REPEAT_FIELDS;
      return;
    }
    if (!down) return;
    if (token === RESET_TOKEN) {
      this.buttons.reset();
      return;
    }
    const byte = tokenToByte(token, { shift: this.shift, ctrl: this.ctrl });
    if (byte !== null) this.queue.push(byte);
  }

  /**
   * A physical DOM key event; returns true when consumed.
   *
   * A host keyboard is not a 1977 Apple keyboard, so this path works from the
   * character the browser reports rather than from the key-cap table above:
   * whatever the user's own layout produces is what the encoder would have
   * produced. Lower case folds to upper, because the character generator has no
   * lower case and the interpreter refuses it.
   */
  handleEvent(e: KeyboardEvent, down: boolean): boolean {
    if (!down) return false; // nothing is transmitted on release
    if (e.metaKey || e.altKey) return false;

    const named = DOM_KEYS[e.key];
    if (named !== undefined) {
      this.queue.push(named);
      return true;
    }

    if (e.key.length !== 1) return false; // a modifier, a function key
    const upper = e.key.toUpperCase();
    const code = upper.charCodeAt(0);

    // CTRL-<key> is how the control codes are typed at all - CTRL-C to stop a
    // program above everything - so it is claimed here even though it costs the
    // browser's own shortcuts while the emulator has focus.
    if (e.ctrlKey) {
      this.queue.push(code & 0x1f);
      return true;
    }
    if (code < 0x20 || code > 0x5f) return false;
    this.queue.push(code);
    return true;
  }

  /**
   * Drop modifier state and the user's typeahead (stop, blur, unmount).
   *
   * The loader's command survives: nothing here is a key anybody is holding, so
   * "release every key" is not a reason to abandon a `RUN` half sent.
   */
  releaseAll(): void {
    this.shift = false;
    this.ctrl = false;
    this.repeating = false;
    this.queue.length = 0;
  }
}
