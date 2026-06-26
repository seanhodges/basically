import type {
  EditorKeyAction,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow, centerRow } from '../../keyboard/templateRows';

/**
 * The BBC Micro Model B keyboard on the standard virtual-keyboard template.
 *
 * Three layers:
 *  - base:     the unshifted character
 *  - shifted:  the shifted symbol (top-left), active while SHIFT is held
 *  - sym:      the punctuation overflow (pinned by the SYM mode tab)
 *
 * The BBC has far more dedicated punctuation keys than fit a uniform ten-key
 * grid, so — trading authenticity for a clean, thumb-sized layout — the overflow
 * symbols (`- = + * @ £ ^ \ [ ] ~ | { } : ;`) are surfaced as the SYM mode's
 * editor inserts on the number and QWERTY rows rather than as their own matrix
 * keys. Code is written in the editor (where these inserts apply); the keyboard
 * therefore optimises for that path. The f0–f9 function keys live in the top
 * strip behind the mode/function toggle.
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
  key('Digit1', ['1', '!', '-']),
  key('Digit2', ['2', '"', '=']),
  key('Digit3', ['3', '#', '+']),
  key('Digit4', ['4', '$', '*']),
  key('Digit5', ['5', '%', '@']),
  key('Digit6', ['6', '&', '£']),
  key('Digit7', ['7', "'", '^']),
  key('Digit8', ['8', '(', '\\']),
  key('Digit9', ['9', ')', '[']),
  key('Digit0', ['0', null, ']']),
];

const qwertyRow = [
  key('KeyQ', ['Q', null, '~']),
  key('KeyW', ['W', null, '|']),
  key('KeyE', ['E', null, '{']),
  key('KeyR', ['R', null, '}']),
  key('KeyT', ['T', null, '_']),
  key('KeyY', ['Y', null, ':']),
  key('KeyU', ['U', null, ';']),
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

const functionKeys: KeyDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `F${i}`,
  spanX: 4,
  emits: [`F${i}`],
  style: 'fn',
  labels: [{ text: `f${i}`, editor: null }, null, null],
}));

export const bbcKeyboardLayout: KeyboardLayout = {
  id: 'bbcmicro',
  name: 'BBC Micro',
  theme: 'vk-theme-bbc',
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
  // BBC convention: Z/X = left/right, K/M = up/down; Space / Return as fire.
  controller: {
    fireButtons: 2,
    dpadMode: '4-way',
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
