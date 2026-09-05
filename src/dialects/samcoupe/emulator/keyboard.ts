import type { JoystickState } from '../../types';

/**
 * The SAM's key matrix, and the joystick port that shares it.
 *
 * Nine rows of up to eight keys. Rows 0-7 are selected exactly as the
 * Spectrum's are - by pulling the corresponding bit of the port's high address
 * byte low - but a row is eight keys wide here, not five, and the two halves
 * are read through different ports: bits 0-4 come back on 0xFE and bits 5-7 on
 * the status port 0xF9. That is where the SAM put the keys the Spectrum had no
 * room for: the ten function keys, ESC, TAB, CAPS, DELETE, EDIT and INV.
 *
 * Row 8 is the cursor cluster plus CONTROL, and is reached the other way round:
 * on port 0xFE with *no* row selected (high byte 0xFF).
 *
 * Tokens are DOM-code-style strings, matching what the virtual keyboard sends
 * and what a host `KeyboardEvent.code` carries where the two agree.
 */

/**
 * Rows 0-7 as the address lines select them, then row 8. Bit n of a row is the
 * key at index n. Empty slots are real: the matrix is not full.
 */
const MATRIX: readonly (readonly (string | null)[])[] = [
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'F1', 'F2', 'F3'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'F4', 'F5', 'F6'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'F7', 'F8', 'F9'],
  [
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Escape',
    'Tab',
    'CapsLock',
  ],
  ['Digit0', 'Digit9', 'Digit8', 'Digit7', 'Digit6', 'Minus', 'Plus', 'Delete'],
  ['KeyP', 'KeyO', 'KeyI', 'KeyU', 'KeyY', 'Equal', 'Quote', 'F0'],
  ['Enter', 'KeyL', 'KeyK', 'KeyJ', 'KeyH', 'Semicolon', 'Colon', 'Edit'],
  ['Space', 'SymShift', 'KeyM', 'KeyN', 'KeyB', 'Comma', 'Period', 'Inv'],
  [
    'Control',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    null,
    null,
    null,
  ],
];

/** Row 8, read on 0xFE when no address line is pulled low. */
const CURSOR_ROW = 8;

/** Every token the matrix can press, for the keyboard-layout test. */
export const SAMCOUPE_KEY_TOKENS: readonly string[] = MATRIX.flat().filter(
  (t): t is string => t !== null,
);

/** Where each token sits: [row, bit]. */
const POSITIONS = new Map<string, [number, number]>();
MATRIX.forEach((row, r) =>
  row.forEach((token, bit) => {
    if (token) POSITIONS.set(token, [r, bit]);
  }),
);

/**
 * Host `KeyboardEvent.code` values that are not already matrix tokens.
 *
 * The SAM's keyboard is close enough to a modern one that most codes pass
 * straight through. What needs mapping is the machine's own punctuation, which
 * sits on different keys, and the modifiers: CONTROL is one key on the SAM (the
 * host's two both reach it), and SYMBOL - the SAM's symbol shift - is taken
 * from the right Alt key, the nearest thing a host keyboard has spare.
 */
const HOST_ALIASES: Record<string, string> = {
  ShiftRight: 'ShiftLeft',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  AltLeft: 'SymShift',
  AltRight: 'SymShift',
  NumpadEnter: 'Enter',
  Backspace: 'Delete',
  NumpadAdd: 'Plus',
  NumpadSubtract: 'Minus',
  Backquote: 'Quote',
  Insert: 'Inv',
  End: 'Edit',
};

export class SamKeyboard {
  /** One byte per row, active low: a clear bit is a key held down. */
  private readonly rows = new Uint8Array(MATRIX.length).fill(0xff);
  /** Joystick switches, kept apart so releasing a key cannot release them. */
  private joystick = 0;

  setKey(token: string, down: boolean): void {
    const pos =
      POSITIONS.get(token) ?? POSITIONS.get(HOST_ALIASES[token] ?? '');
    if (!pos) return;
    const [row, bit] = pos;
    if (down) this.rows[row]! &= ~(1 << bit);
    else this.rows[row]! |= 1 << bit;
  }

  releaseAll(): void {
    this.rows.fill(0xff);
    this.joystick = 0;
  }

  /** True when the event named a key this machine has. */
  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const token = POSITIONS.has(e.code) ? e.code : HOST_ALIASES[e.code];
    if (!token) return false;
    this.setKey(token, down);
    return true;
  }

  /**
   * The SAM's 9-pin joystick port, wired onto the matrix as Sinclair's
   * interface was: left/right/down/up are the keys 6, 7, 8 and 9 and fire is 0,
   * all of them row 4. So a program that reads the joystick by reading those
   * keys - which is how SAM BASIC's own KEY functions see it - works with no
   * extra port at all.
   */
  setJoystick(state: JoystickState): void {
    let bits = 0;
    if (state.left) bits |= 1 << 4; // key 6
    if (state.right) bits |= 1 << 3; // key 7
    if (state.down) bits |= 1 << 2; // key 8
    if (state.up) bits |= 1 << 1; // key 9
    if (state.fire1 || state.fire2) bits |= 1 << 0; // key 0
    this.joystick = bits;
  }

  /** Bits 0-4 of the rows selected by `high`, as port 0xFE returns them. */
  readKeyPort(high: number): number {
    return this.readRows(high) & 0x1f;
  }

  /** Bits 5-7 of the rows selected by `high`, as the status port returns them. */
  readStatusKeys(high: number): number {
    // Row 8 is not reachable here: the status port never sees the cursor keys,
    // which is why they had to sit in a row of their own.
    let bits = 0xe0;
    for (let r = 0; r < CURSOR_ROW; r++) {
      if (!(high & (1 << r))) bits &= this.rowByte(r);
    }
    return bits & 0xe0;
  }

  private readRows(high: number): number {
    if ((high & 0xff) === 0xff) return this.rowByte(CURSOR_ROW);
    let bits = 0xff;
    for (let r = 0; r < CURSOR_ROW; r++) {
      if (!(high & (1 << r))) bits &= this.rowByte(r);
    }
    return bits;
  }

  /** A row's byte, with the joystick's switches merged into row 4. */
  private rowByte(row: number): number {
    const held = this.rows[row]!;
    return row === 4 ? held & ~this.joystick & 0xff : held;
  }
}
