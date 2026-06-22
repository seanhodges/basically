/**
 * TRS-80 keyboard: an 8×8 matrix memory-mapped at 0x3800–0x3BFF. Unlike
 * the Sinclair machines (which scan the keyboard through IN 0xFE), the rows here
 * are selected by the *address* lines: reading 0x3800 | (1 << row) puts that
 * row's eight column bits on the data bus, and several rows can be read at once
 * by setting several address bits. Pressed keys read as 1 (active **high**), the
 * opposite of the active-low Sinclair matrix.
 *
 * Tokens are DOM-`KeyboardEvent.code`-style strings, matching the convention the
 * other dialects' machines use for {@link setKey}; Stage 3's keyboard layout
 * `emits` these same names.
 */
const ROWS: string[][] = [
  // 0x3801 (A0): @ A B C D E F G
  ['At', 'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG'],
  // 0x3802 (A1): H I J K L M N O
  ['KeyH', 'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO'],
  // 0x3804 (A2): P Q R S T U V W
  ['KeyP', 'KeyQ', 'KeyR', 'KeyS', 'KeyT', 'KeyU', 'KeyV', 'KeyW'],
  // 0x3808 (A3): X Y Z (D3-D7 unused)
  ['KeyX', 'KeyY', 'KeyZ', '', '', '', '', ''],
  // 0x3810 (A4): 0 1 2 3 4 5 6 7
  [
    'Digit0',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
  ],
  // 0x3820 (A5): 8 9 : ; , - . /
  [
    'Digit8',
    'Digit9',
    'Colon',
    'Semicolon',
    'Comma',
    'Minus',
    'Period',
    'Slash',
  ],
  // 0x3840 (A6): ENTER CLEAR BREAK ↑ ↓ ← → SPACE
  [
    'Enter',
    'Clear',
    'Break',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Space',
  ],
  // 0x3880 (A7): SHIFT (D1-D7 unused)
  ['Shift', '', '', '', '', '', '', ''],
];

/** Host keys translated to TRS-80 keys/shift combinations: code -> [code...] */
const COMBOS: Record<string, string[]> = {
  ShiftLeft: ['Shift'],
  ShiftRight: ['Shift'],
  Backspace: ['ArrowLeft'], // the TRS-80 backspaces with the left arrow
  Escape: ['Break'],
  // Host punctuation that sits on shifted number keys on a US TRS-80.
  Quote: ['Shift', 'Digit7'], // " is SHIFT-7
};

const keyPosition = new Map<string, { row: number; bit: number }>();
ROWS.forEach((keys, row) =>
  keys.forEach((code, bit) => {
    if (code) keyPosition.set(code, { row, bit });
  }),
);

export class Trs80Keyboard {
  /** Bit set = key currently pressed; matrix[row] bits 0-7 (active high). */
  private readonly matrix = new Uint8Array(8);
  /** Keys held via the physical keyboard (handleKey). */
  private readonly physicalDown = new Set<string>();
  /** Keys held via the virtual keyboard or scripted input (setKey). */
  private readonly virtualDown = new Set<string>();

  /** Translate a host key event into matrix state. Returns true if consumed. */
  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const codes = this.translate(e);
    if (codes.length === 0) return false;
    for (const code of codes) {
      if (down) this.physicalDown.add(code);
      else this.physicalDown.delete(code);
      this.applyKey(code);
    }
    return true;
  }

  releaseAll(): void {
    this.physicalDown.clear();
    this.virtualDown.clear();
    this.matrix.fill(0);
  }

  /** Press/release a matrix key directly by its token (virtual/scripted input). */
  setKey(code: string, down: boolean): void {
    if (!keyPosition.has(code)) return;
    if (down) this.virtualDown.add(code);
    else this.virtualDown.delete(code);
    this.applyKey(code);
  }

  /**
   * Compose the byte the CPU reads at a 0x3800-page address. The low address
   * byte selects rows one-hot (A0 = row 0 … A7 = row 7); the result is the OR of
   * every selected row's pressed-key bits. No key down → 0.
   */
  readMatrix(addr: number): number {
    const select = addr & 0xff;
    let data = 0;
    for (let row = 0; row < 8; row++) {
      if (select & (1 << row)) data |= this.matrix[row]!;
    }
    return data & 0xff;
  }

  /**
   * Sync one matrix cell with the union of both press sources, so a physical
   * keyup can't release a key the virtual keyboard still holds (and vice versa).
   */
  private applyKey(code: string): void {
    const pos = keyPosition.get(code);
    if (!pos) return;
    const down = this.physicalDown.has(code) || this.virtualDown.has(code);
    if (down) this.matrix[pos.row] = this.matrix[pos.row]! | (1 << pos.bit);
    else this.matrix[pos.row] = this.matrix[pos.row]! & ~(1 << pos.bit);
  }

  private translate(e: KeyboardEvent): string[] {
    const code = e.code;
    if (code in COMBOS) return COMBOS[code]!;
    if (keyPosition.has(code)) return [code];
    return [];
  }
}
