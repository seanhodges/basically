import type {
  EditorKeyAction,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow, centerRow } from '../../keyboard/templateRows';

/**
 * The Acorn Atom keyboard on the standard virtual-keyboard template.
 *
 * Three layers:
 *  - base:     the unshifted character
 *  - shifted:  the shifted symbol (top-left), active while SHIFT is held
 *  - sym:      the punctuation overflow (pinned by the SYM mode tab)
 *
 * Key tokens are the DOM-code-style names the Atom adapter's matrix understands
 * (`matrixForToken` in `src/emulator/atom/keyboard.ts`: 'KeyA', 'Digit1',
 * 'Enter', 'Comma'…). The Atom has more dedicated punctuation keys (`@ [ ] \ ^
 * : ; - =`) than fit a uniform ten-key grid, so — as the BBC layout does — the
 * overflow symbols are surfaced as the SYM mode's editor inserts on the number
 * row rather than as their own matrix keys; pressing them still emits the base
 * matrix token, but code is written in the editor where the SYM insert applies.
 * The Atom BASIC essentials reach the editor through SHIFT (`!` for `?`/byte
 * indirection's sibling, `"` for strings, `#` for hex, `$` for the string area,
 * `?` for indirection) and the SYM page (`@ [ ] \ ^`).
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

const numberRow = [
  key('Digit1', ['1', '!', '[']),
  key('Digit2', ['2', '"', ']']),
  key('Digit3', ['3', '#', '\\']),
  key('Digit4', ['4', '$', '@']),
  key('Digit5', ['5', '%', '^']),
  key('Digit6', ['6', '&', null]),
  key('Digit7', ['7', "'", null]),
  key('Digit8', ['8', '(', null]),
  key('Digit9', ['9', ')', null]),
  key('Digit0', ['0', null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', null, null]),
  key('KeyW', ['W', null, null]),
  key('KeyE', ['E', null, null]),
  key('KeyR', ['R', null, null]),
  key('KeyT', ['T', null, null]),
  key('KeyY', ['Y', null, null]),
  key('KeyU', ['U', null, null]),
  key('KeyI', ['I', null, null]),
  key('KeyO', ['O', null, null]),
  key('KeyP', ['P', null, null]),
];

const homeRow = [
  key('KeyA', ['A', null, null]),
  key('KeyS', ['S', null, null]),
  key('KeyD', ['D', null, null]),
  key('KeyF', ['F', null, null]),
  key('KeyG', ['G', null, null]),
  key('KeyH', ['H', null, null]),
  key('KeyJ', ['J', null, null]),
  key('KeyK', ['K', null, null]),
  key('KeyL', ['L', null, null]),
  key('Enter', [act('↵', 'newline'), null, null]),
];

const zxcvRow = centerRow([
  key('KeyZ', ['Z', null, null]),
  key('KeyX', ['X', null, null]),
  key('KeyC', ['C', null, null]),
  key('KeyV', ['V', null, null]),
  key('KeyB', ['B', null, null]),
  key('KeyN', ['N', null, null]),
  key('KeyM', ['M', null, null]),
  key('Comma', [',', '<', null]),
  key('Period', ['.', '>', null]),
  key('Slash', ['/', '?', null]),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

/** Escape, to the left of the space bar; a machine key with no editor insert. */
const escKey: KeyDef = {
  id: 'Escape',
  spanX: 4,
  emits: ['Escape'],
  labels: [{ text: 'Esc', editor: null }, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: 'SPACE', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

/** A double quote, typed as SHIFT+2 on the Atom matrix. */
const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'Digit2'],
  labels: [{ text: '"' }, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Delete',
  spanX: 4,
  emits: ['Delete'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null],
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey, escKey], spaceKey, [quoteKey, backspaceKey]),
];

export const atomKeyboardLayout: KeyboardLayout = {
  id: 'atom',
  name: 'Acorn Atom',
  theme: 'vk-theme-atom',
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
  glyphs: {},
  options: { minHoldFrames: 4 },
  // Acorn convention: Z/X = left/right, K/M = up/down; Space / Return as fire.
  controller: {
    fireButtons: 2,
    dpadMode: '8-way',
    bindings: {
      up: 'KeyK',
      down: 'KeyM',
      left: 'KeyZ',
      right: 'KeyX',
      fire1: 'Space',
      fire2: 'Enter',
    },
  },
};
