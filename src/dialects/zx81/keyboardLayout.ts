import type {
  EditorKeyAction,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow, centerRow } from '../../keyboard/templateRows';
import { ZX81_GRAPHICS } from './graphics';

/**
 * The ZX81 keyboard on the standard virtual-keyboard template: a uniform
 * ten-key grid (number row, three QWERTY rows, a common bottom row) with the
 * machine's modes offered as top-strip tabs.
 *
 * Each alphanumeric key still carries the authentic ZX81 legends:
 *  - main:     the big white character
 *  - shift:    the red symbol in the top-right corner (SHIFT held)
 *  - keyword:  the white K-mode keyword (pinned by the KEYWORD mode tab)
 *  - function: the red FUNCTION-mode name (pinned by the FUNCTION mode tab)
 *
 * The block graphics are not key legends: there are twenty-one of them and they
 * would be illegible at keycap size, so the GRAPHICS mode shows them as a
 * palette instead (see ./graphics).
 *
 * Per the template, the dedicated cursor/EDIT/RUBOUT keys and the number-row
 * arrow legends are dropped (the editor handles cursor placement by touch); a
 * single quote and backspace key live on the common bottom row instead.
 */

// Label tuple order matches `layers` below: [main, shift, keyword, function].
type Legend = string | { text: string; editor: EditorKeyAction | null } | null;

/** Legend that inserts the keyword plus a trailing space. */
const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});
/** Legend bound to an editing action (backspace, newline). */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });
/** Legend that inserts different text than it shows. */
const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});

type Legends = [Legend, Legend, Legend, Legend];

const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : { text: legend.text, editor: legend.editor };

function key(token: string, [main, shift, keyword, fn]: Legends): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [lbl(main), lbl(shift), lbl(keyword), lbl(fn)],
  };
}

const numberRow = [
  key('Digit1', ['1', null, null, null]),
  key('Digit2', ['2', word('AND'), null, null]),
  key('Digit3', ['3', word('THEN'), null, null]),
  key('Digit4', ['4', word('TO'), null, null]),
  key('Digit5', ['5', { text: '←', editor: null }, null, null]),
  key('Digit6', ['6', { text: '↓', editor: null }, null, null]),
  key('Digit7', ['7', { text: '↑', editor: null }, null, null]),
  key('Digit8', ['8', { text: '→', editor: null }, null, null]),
  key('Digit9', ['9', null, null, null]),
  key('Digit0', ['0', null, null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', '""', 'PLOT', 'SIN']),
  key('KeyW', ['W', word('OR'), 'UNPLOT', 'COS']),
  key('KeyE', ['E', word('STEP'), 'REM', 'TAN']),
  key('KeyR', ['R', '<=', 'RUN', 'INT']),
  key('KeyT', ['T', '<>', 'RAND', 'RND']),
  key('KeyY', ['Y', '>=', 'RETURN', 'STR$']),
  key('KeyU', ['U', '$', 'IF', 'CHR$']),
  key('KeyI', ['I', '(', 'INPUT', 'CODE']),
  key('KeyO', ['O', ')', 'POKE', 'PEEK']),
  key('KeyP', ['P', '"', 'PRINT', 'TAB']),
];

const homeRow = [
  key('KeyA', ['A', word('STOP'), 'NEW', 'ARCSIN']),
  key('KeyS', ['S', word('LPRINT'), 'SAVE', 'ARCCOS']),
  key('KeyD', ['D', word('SLOW'), 'DIM', 'ARCTAN']),
  key('KeyF', ['F', word('FAST'), 'FOR', 'SGN']),
  key('KeyG', ['G', word('LLIST'), 'GOTO', 'ABS']),
  key('KeyH', ['H', '**', 'GOSUB', 'SQR']),
  // '−' is U+2212 (not in the ZX81 charset); insert the ASCII hyphen.
  key('KeyJ', ['J', ins('−', '-'), 'LOAD', 'VAL']),
  key('KeyK', ['K', '+', 'LIST', 'LEN']),
  key('KeyL', ['L', '=', 'LET', 'USR']),
  key('Enter', [act('↵', 'newline'), null, null, null]),
];

const zxcvRow = centerRow([
  key('KeyZ', ['Z', ':', 'COPY', 'LN']),
  key('KeyX', ['X', ';', 'CLEAR', 'EXP']),
  key('KeyC', ['C', '?', 'CONT', 'AT']),
  key('KeyV', ['V', '/', 'CLS', null]),
  key('KeyB', ['B', '*', 'SCROLL', 'INKEY$']),
  key('KeyN', ['N', '<', 'NEXT', 'NOT']),
  key('KeyM', ['M', '>', 'PAUSE', 'PI']),
  key('Period', ['.', ',', null, null]),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, { text: '£' }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'KeyP'],
  labels: [{ text: '"' }, null, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 4,
  emits: ['Shift', 'Digit0'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null, null],
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey], spaceKey, [quoteKey, backspaceKey]),
];

export const zx81KeyboardLayout: KeyboardLayout = {
  id: 'zx81',
  name: 'ZX81',
  theme: 'vk-theme-zx81',
  gridColumns: 40,
  layers: [
    {
      id: 'main',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shift',
      name: 'SHIFT',
      position: 'tr',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
    {
      id: 'keyword',
      name: 'KEYWORD',
      position: 'bl',
      activeWhen: [],
      editorInsertStyle: 'word',
    },
    {
      id: 'function',
      name: 'FUNCTION',
      position: 'below',
      activeWhen: [],
      editorInsertStyle: 'word',
    },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'main' },
    { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
    { id: 'function', name: 'FUNCTION', layer: 'function' },
    // The graphics have no key layer of their own; the mode shows the palette
    // below, whose cells insert the characters directly.
    { id: 'graphic', name: 'GRAPHICS', layer: 'main', palette: 'graphics' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  graphicsPalette: { sections: [{ entries: ZX81_GRAPHICS }] },
  glyphs: {},
  options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
  // Sinclair joystick convention: 5/6/7/8 = left/down/up/right; Space/Enter as
  // fire (key-mapped mode).
  controller: {
    bindings: {
      up: 'Digit7',
      down: 'Digit6',
      left: 'Digit5',
      right: 'Digit8',
      fire1: 'Space',
      fire2: 'Enter',
    },
  },
};
