import type {
  EditorKeyAction,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';

/**
 * The Amstrad CPC 464 keyboard as pure layout data.
 *
 * Three layers, like the BBC/Atom siblings:
 *  - base:    the unshifted character
 *  - shifted: the shifted symbol (top-left), active while SHIFT is held
 *  - sym:     the punctuation overflow (pinned by the SYM mode tab)
 *
 * Key tokens are exactly the matrix tokens the emulator's `setKey` decodes
 * (`src/emulator/cpc/keyboard.ts` — single letters `A`-`Z`, `Digit0`-`Digit9`,
 * `Return`, `Del`, `Shift`, `CursorUp`…, `Copy`, `F0`-`F9`), so the virtual
 * keyboard and the physical `keyEvent` map share one vocabulary. The CPC has
 * more dedicated punctuation keys (`- = ^ @ [ ] : ; \\ …`) than fit a uniform
 * ten-key grid, so — as the BBC/Atom layouts do — the overflow symbols are the
 * SYM mode's editor inserts on the number/QWERTY rows; the key still emits its
 * base matrix token, but code is written in the editor where SYM applies.
 *
 * The main block sits on the standard 40-column five-row template; the bottom
 * row carries the space bar, DEL, the COPY key and the cursor cluster (which the
 * on-screen controller binds as its joystick — the CPC's keyboard-joystick).
 * The numeric-keypad function keys `f0`-`f9` live in the top strip. The 464's
 * coloured keycaps come from the `vk-theme-cpc464` block in VirtualKeyboard.css;
 * the CPC 6128 sibling re-exports these rows under its own grey theme.
 */

type Legend = string | { text: string; editor: EditorKeyAction | null } | null;
type Legends = [Legend, Legend, Legend];

/** Legend bound to an editing action. */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });

const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : { text: legend.text, editor: legend.editor };

/** A standard key: [base, shifted, sym] legends, one matrix token. */
function key(token: string, legends: Legends): KeyDef {
  return { id: token, spanX: 4, emits: [token], labels: legends.map(lbl) };
}

// Shifted number row + the SYM punctuation overflow (editor inserts only).
const numberRow = [
  key('Digit1', ['1', '!', '-']),
  key('Digit2', ['2', '"', '=']),
  key('Digit3', ['3', '#', '+']),
  key('Digit4', ['4', '$', '*']),
  key('Digit5', ['5', '%', '^']),
  key('Digit6', ['6', '&', '@']),
  key('Digit7', ['7', "'", '[']),
  key('Digit8', ['8', '(', ']']),
  key('Digit9', ['9', ')', ':']),
  key('Digit0', ['0', '_', ';']),
];

const qwertyRow = [
  key('Q', ['Q', null, '{']),
  key('W', ['W', null, '}']),
  key('E', ['E', null, '\\']),
  key('R', ['R', null, '|']),
  key('T', ['T', null, '£']),
  key('Y', ['Y', null, '~']),
  key('U', ['U', null, null]),
  key('I', ['I', null, null]),
  key('O', ['O', null, null]),
  key('P', ['P', null, null]),
];

const homeRow = [
  key('A', ['A', null, null]),
  key('S', ['S', null, null]),
  key('D', ['D', null, null]),
  key('F', ['F', null, null]),
  key('G', ['G', null, null]),
  key('H', ['H', null, null]),
  key('J', ['J', null, null]),
  key('K', ['K', null, null]),
  key('L', ['L', null, null]),
  {
    id: 'Return',
    spanX: 4,
    emits: ['Return'],
    labels: [lbl(act('↵', 'newline')), null, null],
  } satisfies KeyDef,
];

const zxcvRow = [
  key('Z', ['Z', null, null]),
  key('X', ['X', null, null]),
  key('C', ['C', null, null]),
  key('V', ['V', null, null]),
  key('B', ['B', null, null]),
  key('N', ['N', null, null]),
  key('M', ['M', null, null]),
  key('Comma', [',', '<', null]),
  key('Period', ['.', '>', null]),
  key('Slash', ['/', '?', null]),
];

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

const spaceKey: KeyDef = {
  id: 'Space',
  spanX: 10,
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
};

const delKey: KeyDef = {
  id: 'Del',
  spanX: 4,
  emits: ['Del'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null],
};

/** COPY doubles as the on-screen controller's fire button (CPC convention). */
const copyKey: KeyDef = {
  id: 'Copy',
  spanX: 4,
  emits: ['Copy'],
  labels: [{ text: 'COPY', editor: null }, null, null],
};

/** A cursor key: a machine matrix cell that also nudges the editor caret. */
const cursorKey = (
  token: string,
  glyph: string,
  action: 'left' | 'right' | 'up' | 'down',
): KeyDef => ({
  id: token,
  spanX: 4,
  emits: [token],
  style: 'cursor',
  labels: [{ text: glyph, editor: { action } }, null, null],
});

// Bottom row: SHIFT · SPACE · DEL · COPY · ← ↓ ↑ → — sums to the 40-col grid.
const bottomRow: KeyDef[] = [
  shiftKey,
  spaceKey,
  delKey,
  copyKey,
  cursorKey('CursorLeft', '←', 'left'),
  cursorKey('CursorDown', '↓', 'down'),
  cursorKey('CursorUp', '↑', 'up'),
  cursorKey('CursorRight', '→', 'right'),
];

const rows: KeyDef[][] = [numberRow, qwertyRow, homeRow, zxcvRow, bottomRow];

// The numeric-keypad function keys f0–f9, in the top strip behind the toggle.
const functionKeys: KeyDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `F${i}`,
  spanX: 4,
  emits: [`F${i}`],
  style: 'fn',
  labels: [{ text: `f${i}`, editor: null }, null, null],
}));

export const cpc464KeyboardLayout: KeyboardLayout = {
  id: 'cpc464',
  name: 'CPC 464',
  theme: 'vk-theme-cpc464',
  gridColumns: 40,
  layers: [
    {
      id: 'base',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shifted',
      name: 'SHIFT',
      position: 'tl',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
    {
      id: 'sym',
      name: 'SYM',
      position: 'br',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'base' },
    { id: 'sym', name: 'SYM', layer: 'sym' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  functionKeys,
  glyphs: {},
  options: { minHoldFrames: 4 },
  // CPC keyboard-joystick: the cursor cluster steers, COPY (and SPACE) fire.
  controller: {
    bindings: {
      up: 'CursorUp',
      down: 'CursorDown',
      left: 'CursorLeft',
      right: 'CursorRight',
      fire1: 'Space',
      fire2: 'Copy',
    },
  },
};
