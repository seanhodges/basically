import type {
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';

/**
 * The BBC Micro Model B keyboard as virtual-keyboard layout data.
 *
 * Two layers: the base legend and the shifted legend (top-left, like the
 * shifted symbols printed on the real keycaps). The layout is responsive:
 *
 *   - On wide screens (tablets, wide landscape) the authentic single-page
 *     layout in `rows` is shown — every key at once, like the real machine.
 *   - On narrow phones the keys are split across two pages (see `tabs`): an
 *     "ABC" page with the letters/digits and a "#+=" page with the punctuation
 *     symbols, so no row carries more than ten regular keys.
 *
 * VirtualKeyboard chooses between them by container width.
 *
 * The red f0–f9 strip and the non-typing specials (Esc, Tab, Caps Lock, Break)
 * sit on the function strip; on the narrow pages Ctrl/Shift-Lock/Copy/Shift/
 * arrows share the bottom row with the space bar, and both shared strips appear
 * on every page. Matrix tokens are resolved by the BBC adapter
 * (src/emulator/bbc/keyboard.ts); 'Break' is the reset line, not a matrix key.
 */

type Legend = string | null;

/** Grid columns for the wide authentic single-page layout. */
const GRID = 66;
/** Grid columns for the narrow tabbed layout: regular keys span 6 (ten/row). */
const NARROW_GRID = 60;

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

/** The shift modifier key, reused across pages (distinct ids per spot). */
function shiftKey(id: string, spanX: number): KeyDef {
  return {
    id,
    spanX,
    emits: ['Shift'],
    labels: [{ text: '⇧', editor: null }, null],
    modifier: 'shift',
  };
}

/** A non-interactive filler so grid keys can be right-aligned. Emits nothing,
    so the input engine and layout tests ignore it. */
let spacerSeq = 0;
const spacer = (spanX: number): KeyDef => ({
  id: `spacer-${spacerSeq++}`,
  spanX,
  emits: [],
  labels: [null, null],
  style: 'spacer',
});

// Wide-layout helpers default to span 4 (the authentic dense sizing).
const wkey = (
  token: string,
  base: Legend,
  shifted: Legend = null,
  spanX = 4,
  opts: Partial<KeyDef> = {},
): KeyDef => key(token, base, shifted, spanX, opts);
const wmach = (
  token: string,
  base: string,
  spanX = 4,
  style?: string,
): KeyDef => machKey(token, base, spanX, style);
const wact = (
  token: string,
  base: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
  spanX = 4,
): KeyDef => actKey(token, base, action, spanX);

// ===========================================================================
// Wide authentic single-page layout (66 columns)
// ===========================================================================

const fnRowW: KeyDef[] = [
  wmach('Escape', 'Esc', 6),
  ...Array.from({ length: 10 }, (_, i) => wmach(`F${i}`, `f${i}`, 5, 'fn')),
  wmach('Break', 'Brk', 10, 'fn'),
];

const digitRowW: KeyDef[] = [
  wkey('Digit1', '1', '!'),
  wkey('Digit2', '2', '"'),
  wkey('Digit3', '3', '#'),
  wkey('Digit4', '4', '$'),
  wkey('Digit5', '5', '%'),
  wkey('Digit6', '6', '&'),
  wkey('Digit7', '7', "'"),
  wkey('Digit8', '8', '('),
  wkey('Digit9', '9', ')'),
  wkey('Digit0', '0'),
  wkey('Minus', '-', '='),
  wkey('Caret', '^', '~'),
  wkey('Backslash', '\\', '|'),
  wact('ArrowLeft', '←', 'left', 7),
  wact('ArrowRight', '→', 'right', 7),
];

const qwertyRowW: KeyDef[] = [
  wmach('Tab', '⇥', 6),
  wkey('KeyQ', 'Q'),
  wkey('KeyW', 'W'),
  wkey('KeyE', 'E'),
  wkey('KeyR', 'R'),
  wkey('KeyT', 'T'),
  wkey('KeyY', 'Y'),
  wkey('KeyU', 'U'),
  wkey('KeyI', 'I'),
  wkey('KeyO', 'O'),
  wkey('KeyP', 'P'),
  wkey('At', '@'),
  wkey('BracketLeft', '[', '{'),
  wkey('Underscore', '_', '£'),
  wact('ArrowUp', '↑', 'up', 4),
  wact('ArrowDown', '↓', 'down', 4),
];

const homeRowW: KeyDef[] = [
  wmach('CapsLock', '⇪', 5),
  wmach('Ctrl', 'Ctrl', 5),
  wkey('KeyA', 'A'),
  wkey('KeyS', 'S'),
  wkey('KeyD', 'D'),
  wkey('KeyF', 'F'),
  wkey('KeyG', 'G'),
  wkey('KeyH', 'H'),
  wkey('KeyJ', 'J'),
  wkey('KeyK', 'K'),
  wkey('KeyL', 'L'),
  wkey('Semicolon', ';', '+'),
  wkey('Colon', ':', '*'),
  wkey('BracketRight', ']', '}'),
  wact('Enter', '↵', 'newline', 8),
];

const bottomRowW: KeyDef[] = [
  wmach('ShiftLock', '⇧ Lk', 5),
  shiftKey('ShiftL', 6),
  wkey('KeyZ', 'Z'),
  wkey('KeyX', 'X'),
  wkey('KeyC', 'C'),
  wkey('KeyV', 'V'),
  wkey('KeyB', 'B'),
  wkey('KeyN', 'N'),
  wkey('KeyM', 'M'),
  wkey('Comma', ',', '<'),
  wkey('Period', '.', '>'),
  wkey('Slash', '/', '?'),
  shiftKey('ShiftR', 6),
  wact('Delete', '⌫', 'backspace', 5),
  wmach('Copy', 'Copy', 4),
];

const spaceRowW: KeyDef[] = [
  {
    id: 'Space',
    spanX: 66,
    emits: ['Space'],
    labels: [{ text: ' ', editor: { insert: ' ' } }, null],
  },
];

const wideRows = [
  fnRowW,
  digitRowW,
  qwertyRowW,
  homeRowW,
  bottomRowW,
  spaceRowW,
];

// ===========================================================================
// Narrow tabbed layout (60 columns)
// ===========================================================================

// ---- Shared rows (rendered on every narrow page) --------------------------

/** Esc, the red f0–f9 strip, and Break (Tab/Caps Lock drop on narrow). */
const fnStrip: KeyDef[] = [
  machKey('Escape', 'Esc', 5),
  ...Array.from({ length: 10 }, (_, i) => machKey(`F${i}`, `f${i}`, 5, 'fn')),
  machKey('Break', 'Brk', 5, 'fn'),
];

/** Ctrl / Shift-Lock / Copy / Shift on the left, then the centred space bar
    with the arrow cluster to its right. */
const bottomRow: KeyDef[] = [
  machKey('Ctrl', 'Ctrl', 5),
  machKey('ShiftLock', '⇧ Lk', 5),
  machKey('Copy', 'Copy', 5),
  shiftKey('ShiftBottom', 5),
  {
    id: 'Space',
    spanX: 20,
    emits: ['Space'],
    labels: [{ text: ' ', editor: { insert: ' ' } }, null],
  },
  actKey('ArrowLeft', '←', 'left', 5),
  actKey('ArrowDown', '↓', 'down', 5),
  actKey('ArrowUp', '↑', 'up', 5),
  actKey('ArrowRight', '→', 'right', 5),
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

// ---- "#+=" page: punctuation in 4 rows of 3, mirroring the BBC's right side.
// Return sits on the far right of row 3, Delete on the far right of row 4
// (return above delete); rows 1–2 are padded so the symbol columns line up.

const symRow1: KeyDef[] = [
  key('Minus', '-', '='),
  key('Caret', '^', '~'),
  key('Backslash', '\\', '|'),
  spacer(42),
];

const symRow2: KeyDef[] = [
  key('At', '@'),
  key('BracketLeft', '[', '{'),
  key('Underscore', '_', '£'),
  spacer(42),
];

const symRow3: KeyDef[] = [
  key('Semicolon', ';', '+'),
  key('Colon', ':', '*'),
  key('BracketRight', ']', '}'),
  spacer(30),
  actKey('Enter', '↵', 'newline', 12),
];

const symRow4: KeyDef[] = [
  key('Comma', ',', '<'),
  key('Period', '.', '>'),
  key('Slash', '/', '?'),
  spacer(30),
  actKey('Delete', '⌫', 'backspace', 12),
];

const abcRows = [fnStrip, digitRow, qwertyRow, homeRow, zxcvRow, bottomRow];
const symRows = [fnStrip, symRow1, symRow2, symRow3, symRow4, bottomRow];

export const bbcKeyboardLayout: KeyboardLayout = {
  id: 'bbcmicro',
  name: 'BBC Micro',
  theme: 'vk-theme-bbc',
  gridColumns: GRID,
  narrowGridColumns: NARROW_GRID,
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
  rows: wideRows,
  tabs: [
    { id: 'abc', name: 'ABC', rows: abcRows },
    { id: 'sym', name: '#+=', rows: symRows },
  ],
  glyphs: {},
  options: { minHoldFrames: 4 },
};
