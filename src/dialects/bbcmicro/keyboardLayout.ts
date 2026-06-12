import type {
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';

/**
 * The BBC Micro Model B keyboard as virtual-keyboard layout data.
 *
 * Two layers: the base legend and the shifted legend (top-left, like the
 * shifted symbols printed on the real keycaps). To stay usable on phones the
 * keys are split across two pages (see `tabs`): an "ABC" page with the
 * letters/digits and a "#+=" page with the punctuation symbols, so no row
 * carries more than ten regular keys — matching the ZX81/Spectrum keyboards.
 *
 * The red f0–f9 strip and the non-typing specials (Esc, Tab, Caps Lock, Break)
 * sit on a shared function strip, and Ctrl/Shift-Lock/Copy/arrows share the
 * bottom row with the space bar; both strips appear on every page. Matrix
 * tokens are resolved by the BBC adapter (src/emulator/bbc/keyboard.ts); 'Break'
 * is the reset line, not a matrix key.
 */

type Legend = string | null;

/** Grid columns: regular keys span 6, so a full row holds ten of them. */
const GRID = 60;

const lbl = (text: Legend): KeyLabel | null =>
  text === null ? null : { text };

/** A key with a base legend and an optional shifted legend. */
function key(
  token: string,
  base: Legend,
  shifted: Legend = null,
  spanX = 6,
  opts: Partial<KeyDef> = {},
): KeyDef {
  return {
    id: token,
    spanX,
    emits: [token],
    labels: [lbl(base), lbl(shifted)],
    ...opts,
  };
}

/** A key bound to an editor action instead of the layer default. */
function actKey(
  token: string,
  base: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
  spanX = 6,
): KeyDef {
  return {
    id: token,
    spanX,
    emits: [token],
    labels: [{ text: base, editor: { action } }, null],
  };
}

/** A machine-only key that does nothing when targeting the editor. */
function machKey(
  token: string,
  base: string,
  spanX = 6,
  style?: string,
): KeyDef {
  return {
    id: token,
    spanX,
    emits: [token],
    labels: [{ text: base, editor: null }, null],
    style,
  };
}

/** The shift modifier key, reused on both pages (distinct ids per page). */
function shiftKey(id: string, spanX: number): KeyDef {
  return {
    id,
    spanX,
    emits: ['Shift'],
    labels: [{ text: '⇧', editor: null }, null],
    modifier: 'shift',
  };
}

// ---- Shared rows (rendered on every page) ---------------------------------

/** Esc / Tab / Caps Lock, the red f0–f9 strip, and Break. */
const fnStrip: KeyDef[] = [
  machKey('Escape', 'Esc', 5),
  machKey('Tab', '⇥', 5),
  machKey('CapsLock', '⇪', 5),
  ...Array.from({ length: 10 }, (_, i) => machKey(`F${i}`, `f${i}`, 4, 'fn')),
  machKey('Break', 'Brk', 5, 'fn'),
];

/** Ctrl / Shift-Lock / Copy / arrow cluster sharing the space bar's row. */
const bottomRow: KeyDef[] = [
  machKey('Ctrl', 'Ctrl', 6),
  machKey('ShiftLock', '⇧ Lk', 6),
  machKey('Copy', 'Copy', 6),
  actKey('ArrowLeft', '←', 'left', 5),
  actKey('ArrowDown', '↓', 'down', 5),
  actKey('ArrowUp', '↑', 'up', 5),
  actKey('ArrowRight', '→', 'right', 5),
  {
    id: 'Space',
    spanX: 22,
    emits: ['Space'],
    labels: [{ text: ' ', editor: { insert: ' ' } }, null],
  },
];

// ---- "ABC" page: letters and digits ---------------------------------------

const digitRow: KeyDef[] = [
  key('Digit1', '1', '!'),
  key('Digit2', '2', '"'),
  key('Digit3', '3', '#'),
  key('Digit4', '4', '$'),
  key('Digit5', '5', '%'),
  key('Digit6', '6', '&'),
  key('Digit7', '7', "'"),
  key('Digit8', '8', '('),
  key('Digit9', '9', ')'),
  key('Digit0', '0'),
];

const qwertyRow: KeyDef[] = [
  key('KeyQ', 'Q'),
  key('KeyW', 'W'),
  key('KeyE', 'E'),
  key('KeyR', 'R'),
  key('KeyT', 'T'),
  key('KeyY', 'Y'),
  key('KeyU', 'U'),
  key('KeyI', 'I'),
  key('KeyO', 'O'),
  key('KeyP', 'P'),
];

const homeRow: KeyDef[] = [
  key('KeyA', 'A'),
  key('KeyS', 'S'),
  key('KeyD', 'D'),
  key('KeyF', 'F'),
  key('KeyG', 'G'),
  key('KeyH', 'H'),
  key('KeyJ', 'J'),
  key('KeyK', 'K'),
  key('KeyL', 'L'),
  actKey('Enter', '↵', 'newline'),
];

const zxcvRow: KeyDef[] = [
  shiftKey('ShiftL', 9),
  key('KeyZ', 'Z'),
  key('KeyX', 'X'),
  key('KeyC', 'C'),
  key('KeyV', 'V'),
  key('KeyB', 'B'),
  key('KeyN', 'N'),
  key('KeyM', 'M'),
  actKey('Delete', '⌫', 'backspace', 9),
];

// ---- "#+=" page: punctuation symbols --------------------------------------

const symRow1: KeyDef[] = [
  key('Minus', '-', '='),
  key('Caret', '^', '~'),
  key('Backslash', '\\', '|'),
  key('At', '@'),
  key('BracketLeft', '[', '{'),
  key('Underscore', '_', '£'),
  key('Semicolon', ';', '+'),
  key('Colon', ':', '*'),
  key('BracketRight', ']', '}'),
  key('Comma', ',', '<'),
];

const symRow2: KeyDef[] = [
  shiftKey('ShiftSym', 9),
  key('Period', '.', '>'),
  key('Slash', '/', '?'),
  actKey('Enter', '↵', 'newline', 21),
  actKey('Delete', '⌫', 'backspace', 18),
];

const abcRows = [fnStrip, digitRow, qwertyRow, homeRow, zxcvRow, bottomRow];
const symRows = [fnStrip, symRow1, symRow2, bottomRow];

export const bbcKeyboardLayout: KeyboardLayout = {
  id: 'bbcmicro',
  name: 'BBC Micro',
  theme: 'vk-theme-bbc',
  gridColumns: GRID,
  layers: [
    {
      id: 'base',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shifted',
      position: 'tl',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows: abcRows,
  tabs: [
    { id: 'abc', name: 'ABC', rows: abcRows },
    { id: 'sym', name: '#+=', rows: symRows },
  ],
  glyphs: {},
  options: { minHoldFrames: 4 },
};
