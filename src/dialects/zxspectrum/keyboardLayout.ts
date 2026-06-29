import type {
  EditorKeyAction,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow, centerRow } from '../../keyboard/templateRows';

/**
 * The ZX Spectrum 48K keyboard on the standard virtual-keyboard template.
 *
 * Each alphanumeric key carries up to five legends, matching the real machine:
 *  - main:     the big white letter / digit
 *  - caps:     CAPS SHIFT (the uppercase letter)
 *  - symbol:   SYMBOL SHIFT — the red symbol
 *  - keyword:  the white K-mode BASIC keyword (pinned by the KEYWORD mode tab)
 *  - function: the green extended-mode function (pinned by the FUNCTION mode tab)
 *
 * Per the template the number-row CAPS edit/cursor functions are dropped (the
 * editor handles cursor placement by touch); CAPS and SYMBOL shift sit on the
 * common bottom row either side of the space bar, with a quote and backspace.
 */

type Legend = string | { text: string; editor: EditorKeyAction | null } | null;
type Legends = [Legend, Legend, Legend, Legend, Legend];

/** Legend that inserts the keyword plus a trailing space. */
const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});
/** Legend bound to an editing action. */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });
/** Legend that inserts different text than it shows. */
const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});

const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : { text: legend.text, editor: legend.editor };

function key(token: string, legends: Legends): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: legends.map(lbl),
  };
}

/** A letter key: caps inserts the uppercase form. */
function letter(
  token: string,
  ch: string,
  symbol: Legend,
  keyword: string,
  fn: Legend,
): KeyDef {
  return key(token, [
    ch,
    ins(ch.toUpperCase(), ch.toUpperCase()),
    symbol,
    word(keyword),
    fn,
  ]);
}

const numberRow = [
  key('Digit1', ['1', null, '!', null, null]),
  key('Digit2', ['2', null, '@', null, null]),
  key('Digit3', ['3', null, '#', null, null]),
  key('Digit4', ['4', null, '$', null, null]),
  key('Digit5', ['5', { text: '←', editor: null }, '%', null, null]),
  key('Digit6', ['6', { text: '↓', editor: null }, '&', null, null]),
  key('Digit7', ['7', { text: '↑', editor: null }, ins("'", "'"), null, null]),
  key('Digit8', ['8', { text: '→', editor: null }, '(', null, null]),
  key('Digit9', ['9', null, ')', null, null]),
  key('Digit0', ['0', null, '_', null, null]),
];

const qwertyRow = [
  letter('KeyQ', 'q', '<=', 'PLOT', word('SIN')),
  letter('KeyW', 'w', '<>', 'DRAW', word('COS')),
  letter('KeyE', 'e', '>=', 'REM', word('TAN')),
  letter('KeyR', 'r', '<', 'RUN', word('INT')),
  letter('KeyT', 't', '>', 'RANDOMIZE', word('RND')),
  letter('KeyY', 'y', word('AND'), 'RETURN', word('STR$')),
  letter('KeyU', 'u', word('OR'), 'IF', word('CHR$')),
  letter('KeyI', 'i', word('AT'), 'INPUT', word('CODE')),
  letter('KeyO', 'o', ';', 'POKE', word('PEEK')),
  letter('KeyP', 'p', '"', 'PRINT', word('TAB')),
];

const homeRow = [
  letter('KeyA', 'a', '~', 'NEW', word('READ')),
  letter('KeyS', 's', '|', 'SAVE', word('RESTORE')),
  letter('KeyD', 'd', '\\', 'DIM', word('DATA')),
  letter('KeyF', 'f', '{', 'FOR', word('SGN')),
  letter('KeyG', 'g', '}', 'GO TO', word('ABS')),
  letter('KeyH', 'h', ins('↑', '↑'), 'GO SUB', word('SQR')),
  letter('KeyJ', 'j', '-', 'LOAD', word('VAL')),
  letter('KeyK', 'k', '+', 'LIST', word('LEN')),
  letter('KeyL', 'l', '=', 'LET', word('USR')),
  key('Enter', [act('↵', 'newline'), null, null, null, null]),
];

/** Full stop, to the right of M (SYMBOL SHIFT + M on the real machine). */
const periodKey: KeyDef = {
  id: 'Period',
  spanX: 4,
  emits: ['SymShift', 'KeyM'],
  labels: [{ text: '.' }, null, null, null, null],
};

const zxcvRow = centerRow([
  letter('KeyZ', 'z', ':', 'COPY', word('LN')),
  letter('KeyX', 'x', ins('£', '£'), 'CLEAR', word('EXP')),
  letter('KeyC', 'c', '?', 'CONTINUE', word('INKEY$')),
  letter('KeyV', 'v', '/', 'CLS', word('VAL$')),
  letter('KeyB', 'b', '*', 'BORDER', word('BIN')),
  letter('KeyN', 'n', ',', 'NEXT', word('INKEY$')),
  letter('KeyM', 'm', '.', 'PAUSE', word('PI')),
  periodKey,
]);

const capsKey: KeyDef = {
  id: 'CapsShift',
  spanX: 6,
  emits: ['CapsShift'],
  modifier: 'caps',
  style: 'shift',
  labels: [{ text: '⇧ Cap' }, null, null, null, null],
};

const symKey: KeyDef = {
  id: 'SymShift',
  spanX: 6,
  emits: ['SymShift'],
  modifier: 'symbol',
  style: 'symshift',
  labels: [{ text: '⇧ Sym' }, null, null, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['SymShift', 'KeyP'],
  labels: [{ text: '"' }, null, null, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 4,
  emits: ['CapsShift', 'Digit0'],
  labels: [
    { text: '⌫', editor: { action: 'backspace' } },
    null,
    null,
    null,
    null,
  ],
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([capsKey], spaceKey, [quoteKey, backspaceKey, symKey]),
];

export const spectrumKeyboardLayout: KeyboardLayout = {
  id: 'zxspectrum',
  name: 'ZX Spectrum',
  theme: 'vk-theme-zxspectrum',
  gridColumns: 40,
  layers: [
    {
      id: 'main',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'caps',
      name: 'CAPS',
      position: 'tl',
      activeWhen: ['caps'],
      editorInsertStyle: 'char',
    },
    {
      id: 'symbol',
      name: 'SYMBOL',
      position: 'tr',
      activeWhen: ['symbol'],
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
    { id: 'symbol', name: 'SYMBOL', layer: 'symbol' },
  ],
  modifiers: [
    { id: 'caps', emits: ['CapsShift'], sticky: true, lockable: true },
    { id: 'symbol', emits: ['SymShift'], sticky: true, lockable: true },
  ],
  rows,
  glyphs: {},
  options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
  // Sinclair joystick convention: 5/6/7/8 = left/down/up/right; 0/9 as fire.
  controller: {
    bindings: {
      up: 'Digit7',
      down: 'Digit6',
      left: 'Digit5',
      right: 'Digit8',
      fire1: 'Digit0',
      fire2: 'Digit9',
    },
  },
};
