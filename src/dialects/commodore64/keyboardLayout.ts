import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The Commodore 64 keyboard as virtual-keyboard layout data. Each key `emits`
 * a viciious button name (see src/emulator/c64/c64Machine.ts), which the
 * machine maps to the 8×8 key matrix. Shift is a sticky/lockable modifier;
 * the shift layer surfaces the number-row symbols. RESTORE is wired to NMI on
 * the real machine (no matrix position) and is a no-op token here.
 */

/** Build a plain key: base label, optional shifted label, single token. */
function key(
  id: string,
  emit: string,
  base: string,
  shift?: string,
  spanX = 2,
): KeyDef {
  return {
    id,
    spanX,
    emits: [emit],
    labels: [{ text: base }, shift ? { text: shift } : null],
  };
}

const letters = (...ids: string[]): KeyDef[] => ids.map((l) => key(l, l, l));

const numberRow: KeyDef[] = [
  key('LeftArrow', 'LeftArrow', '←'),
  key('Num1', 'Num1', '1', '!'),
  key('Num2', 'Num2', '2', '"'),
  key('Num3', 'Num3', '3', '#'),
  key('Num4', 'Num4', '4', '$'),
  key('Num5', 'Num5', '5', '%'),
  key('Num6', 'Num6', '6', '&'),
  key('Num7', 'Num7', '7', "'"),
  key('Num8', 'Num8', '8', '('),
  key('Num9', 'Num9', '9', ')'),
  key('Num0', 'Num0', '0'),
  key('Plus', 'Plus', '+'),
  key('Minus', 'Minus', '-'),
  key('Pound', 'Pound', '£'),
  key('ClrHome', 'ClrHome', 'HOME'),
  key('InstDel', 'InstDel', 'DEL', undefined, 3),
];

const qwertyRow: KeyDef[] = [
  key('Ctrl', 'Ctrl', 'CTRL', undefined, 3),
  ...letters('Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'),
  key('At', 'At', '@'),
  key('Asterisk', 'Asterisk', '*'),
  key('UpArrow', 'UpArrow', '↑'),
  key('Restore', 'Restore', 'RESTORE', undefined, 3),
];

const asdfRow: KeyDef[] = [
  key('RunStop', 'RunStop', 'RUN STOP', undefined, 4),
  ...letters('A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'),
  key('Colon', 'Colon', ':', '['),
  key('Semicolon', 'Semicolon', ';', ']'),
  key('Equal', 'Equal', '='),
  key('Return', 'Return', 'RETURN', undefined, 4),
];

const zxcvRow: KeyDef[] = [
  key('Commodore', 'Commodore', 'C=', undefined, 3),
  {
    id: 'LeftShift',
    spanX: 3,
    emits: ['LeftShift'],
    modifier: 'shift',
    labels: [{ text: 'SHIFT' }, { text: 'SHIFT' }],
  },
  ...letters('Z', 'X', 'C', 'V', 'B', 'N', 'M'),
  key('Comma', 'Comma', ',', '<'),
  key('Period', 'Period', '.', '>'),
  key('Slash', 'Slash', '/', '?'),
  key('CursorUp', 'CursorUp', 'CRSR ↑'),
  key('CursorDown', 'CursorDown', 'CRSR ↓'),
  key('CursorLeft', 'CursorLeft', 'CRSR ←'),
  key('CursorRight', 'CursorRight', 'CRSR →'),
];

const spaceRow: KeyDef[] = [
  key('Space', 'Space', 'SPACE', undefined, 20),
  key('F1', 'F1', 'f1'),
  key('F3', 'F3', 'f3'),
  key('F5', 'F5', 'f5'),
  key('F7', 'F7', 'f7'),
];

export const c64KeyboardLayout: KeyboardLayout = {
  id: 'commodore64',
  name: 'Commodore 64',
  theme: 'vk-theme-commodore64',
  gridColumns: 36,
  layers: [
    { id: 'base', position: 'center', activeWhen: [] },
    { id: 'shift', position: 'tr', activeWhen: ['shift'] },
  ],
  modifiers: [
    { id: 'shift', emits: ['LeftShift'], sticky: true, lockable: true },
  ],
  rows: [numberRow, qwertyRow, asdfRow, zxcvRow, spaceRow],
  glyphs: {},
};
