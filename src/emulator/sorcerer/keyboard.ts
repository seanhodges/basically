// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Sorcerer key matrix: sixteen lines of five keys.
 *
 * A line is selected by writing its *number* into the low four bits of the
 * control port - a 4-bit value into a 1-of-16 decoder, not the one-hot line
 * select the Sinclair machines use - and that line's keys come back in bits 0-4
 * of the same port, a pressed key reading 0. The Monitor clears bit 7 of the
 * write, which is also the RS-232 select, so scanning the keyboard hands the
 * UART back to the cassette; that is a documented quirk of the machine rather
 * than an accident of this model.
 *
 * A line is a physical column of the keyboard rather than a run of the
 * alphabet, which is why 1/Q/A/Z/X share one. The four modifiers are a line of
 * their own (line 0) rather than being wired across the matrix, so nothing here
 * needs the "read on every scan" row the PMD 85 has.
 *
 * The numeric keypad - the whole right-hand block, lines 12-15 - is on the same
 * matrix as the main keyboard and is included: it is a second way to type the
 * digits and the arithmetic symbols, and GRAPHIC with one of its keys types a
 * graphic no other key carries. It is *not* a cursor cluster, whatever its
 * arrangement suggests: the booted Monitor types `4` for its 4 and `8` for its
 * 8, and moves the cursor only for CTRL and the W/A/S/Z diamond (see
 * {@link HOST_COMBOS}).
 */
const LINES: readonly (readonly (string | null)[])[] = [
  //  bit0        bit1        bit2        bit3          bit4
  ['Stop', 'Graphic', 'Control', 'ShiftLock', 'Shift'],
  ['Clear', 'Repeat', 'Space', 'Skip', 'Sel'],
  ['KeyX', 'KeyZ', 'KeyA', 'KeyQ', 'Digit1'],
  ['KeyC', 'KeyD', 'KeyS', 'KeyW', 'Digit2'],
  ['KeyF', 'KeyR', 'KeyE', 'Digit4', 'Digit3'],
  ['KeyB', 'KeyV', 'KeyG', 'KeyT', 'Digit5'],
  ['KeyM', 'KeyN', 'KeyH', 'KeyY', 'Digit6'],
  ['KeyK', 'KeyI', 'KeyJ', 'KeyU', 'Digit7'],
  ['Comma', 'KeyL', 'KeyO', 'Digit9', 'Digit8'],
  ['Slash', 'Period', 'Semicolon', 'KeyP', 'Digit0'],
  ['Backslash', 'At', 'BracketRight', 'BracketLeft', 'Colon'],
  ['Underscore', 'Enter', 'LineFeed', 'Caret', 'Minus'],
  // The keypad, on the same matrix as the main keyboard. Four of its cells are
  // wired to nothing.
  ['NumpadAdd', 'NumpadMultiply', 'NumpadDivide', 'NumpadSubtract', null],
  ['Numpad0', 'Numpad1', 'Numpad4', 'Numpad8', 'Numpad7'],
  ['NumpadDecimal', 'Numpad2', 'Numpad5', 'Numpad6', 'Numpad9'],
  [null, null, null, 'NumpadEqual', 'Numpad3'],
];

/** Bits 0-4 of a control-port read are the selected line's five keys. */
const LINE_KEY_MASK = 0x1f;

/**
 * Host `KeyboardEvent.code`s that reach a Sorcerer key the browser spells
 * differently. Everything whose code already matches a token above - the
 * letters, the digits, Space, Comma, Period, Semicolon, the keypad - needs no
 * entry.
 *
 * The symbol keys are mapped by the *character on the Sorcerer keycap* rather
 * than by position, because this keyboard's unshifted symbols are not a PC's:
 * its `:` and `@` are keys of their own, and the key a PC spells `Equal` is
 * this machine's `^`. A positional mapping would put a different character on
 * screen from the one on the key that was pressed.
 */
const HOST_CODES: Readonly<Record<string, string>> = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  CapsLock: 'ShiftLock',
  Escape: 'Stop',
  Tab: 'Skip',
  Backspace: 'Underscore',
  Equal: 'Caret',
  Backquote: 'At',
  Quote: 'Colon',
  NumpadEnter: 'Enter',
  // F-keys for the four Sorcerer keys a PC keyboard has nothing at all like.
  F1: 'Graphic',
  F2: 'Sel',
  F4: 'Repeat',
  F5: 'Clear',
  F6: 'LineFeed',
};

/**
 * Host keys that reach a Sorcerer *combination* rather than one key.
 *
 * The machine has no cursor cluster: the Monitor moves the cursor with CTRL
 * and the W/A/S/Z diamond, and takes it home with CTRL+Q. Its numeric keypad
 * is not that cluster - its 4 and 8 type `4` and `8` like any other digit key
 * - so a host arrow mapped there would put a digit on the screen instead of
 * moving anything.
 */
const HOST_COMBOS: Readonly<Record<string, readonly string[]>> = {
  ArrowUp: ['Control', 'KeyW'],
  ArrowDown: ['Control', 'KeyZ'],
  ArrowLeft: ['Control', 'KeyA'],
  ArrowRight: ['Control', 'KeyS'],
  Home: ['Control', 'KeyQ'],
};

interface KeyPosition {
  line: number;
  bit: number;
}

const KEY_POSITIONS = new Map<string, KeyPosition>();
LINES.forEach((keys, line) =>
  keys.forEach((token, bit) => {
    if (token) KEY_POSITIONS.set(token, { line, bit });
  }),
);

/** Every token this keyboard answers to, for the layout tests to check against. */
export const SORCERER_KEY_TOKENS: readonly string[] = [...KEY_POSITIONS.keys()];

/**
 * The Sorcerer keys a host `KeyboardEvent.code` reaches: one cell for most of
 * them, two for the arrows, and none where the host key has no equivalent on
 * this machine. Exported because it is the only statement of which matrix keys
 * are typeable without a keycap.
 */
export function tokensForHostCode(code: string): readonly string[] {
  const combo = HOST_COMBOS[code];
  if (combo) return combo;
  const token = HOST_CODES[code] ?? code;
  return KEY_POSITIONS.has(token) ? [token] : [];
}

/** The Sorcerer keyboard as the control port sees it. */
export class SorcererKeyboard {
  /** Bit set = key down, one entry per matrix line. */
  private readonly matrix = new Uint8Array(LINES.length);
  private readonly physicalDown = new Set<string>();
  private readonly virtualDown = new Set<string>();

  /**
   * A host key event, translated to whatever Sorcerer key sits under it.
   * Returns false for a key this machine has no equivalent of, so the browser
   * keeps its own handling of it.
   */
  handleEvent(e: KeyboardEvent, down: boolean): boolean {
    const tokens = tokensForHostCode(e.code);
    if (tokens.length === 0) return false;
    for (const token of tokens) {
      if (down) this.physicalDown.add(token);
      else this.physicalDown.delete(token);
      this.apply(token);
    }
    return true;
  }

  /** A key pressed on the virtual keyboard, by layout token. */
  setKey(token: string, down: boolean): void {
    if (!KEY_POSITIONS.has(token)) return;
    if (down) this.virtualDown.add(token);
    else this.virtualDown.delete(token);
    this.apply(token);
  }

  releaseAll(): void {
    this.physicalDown.clear();
    this.virtualDown.clear();
    this.matrix.fill(0);
  }

  /**
   * The five key bits the control port reads with `line` selected, active low.
   * The caller merges them with the rest of the port; everything unconnected -
   * the three empty cells above - reads high, as an unpulled matrix line does.
   */
  readLine(line: number): number {
    const keys = this.matrix[line & 0x0f]! & LINE_KEY_MASK;
    return ~keys & LINE_KEY_MASK;
  }

  /** Sync one matrix cell with the union of the two press sources. */
  private apply(token: string): void {
    const position = KEY_POSITIONS.get(token);
    if (!position) return;
    const down =
      this.physicalDown.has(token) || this.virtualDown.has(token) ? 1 : 0;
    const mask = 1 << position.bit;
    if (down) this.matrix[position.line]! |= mask;
    else this.matrix[position.line]! &= ~mask & 0xff;
  }
}
