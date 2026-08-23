import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type CursorAction,
  type Legend,
  act,
  cursorKey,
  ins,
  key as kitKey,
  withLegend,
  word,
} from '../../keyboard/legendKit';
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { SPECTRUM_BLOCK_GRAPHICS, SPECTRUM_UDG_GRAPHICS } from './graphics';

/**
 * The ZX Spectrum 48K keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the CAPS
 * SHIFT/backspace-flanked bottom letter row, and a bottom row of SYMBOL
 * SHIFT, space, quote, and Enter at the far right - the machine's symbols
 * in the SYM mode at the template's canonical positions, each pressing the
 * SYMBOL SHIFT combination the real keyboard sends.
 *
 * Each alphanumeric key carries up to five legends, matching the real machine:
 *  - main:     the big white letter / digit
 *  - caps:     CAPS SHIFT (the uppercase letter)
 *  - symbol:   SYMBOL SHIFT - the red symbol
 *  - keyword:  the white K-mode BASIC keyword
 *  - function: the green extended-mode function
 *
 * The keyword and function legends stay printed on the keys but are not
 * input modes - keyword entry is the editor autocomplete's job. The SYMBOL
 * SHIFT modifier keeps its authentic red legends and still works in ABC
 * mode; the SYM mode is the same characters at the canonical positions.
 *
 * The machine's graphics mode (CAPS SHIFT + 9 on the real keyboard) is a
 * GRAPHICS tab showing the palette: the sixteen block graphics on the digit
 * keys and the twenty-one user-defined graphics on A-U, each labelled with the
 * key - and, for the inverse blocks, the CAPS SHIFT - that types it. They are
 * not key legends because a UDG has no fixed shape to print.
 *
 * The cursor keys are CAPS SHIFT + 5/6/7/8, so the arrows sit on those number
 * keys, where the machine prints them: they are the CAPS legends there, and
 * CURSOR mode repeats them on the same keycaps so the pair can be sent without
 * the modifier held.
 */

type Legends = [Legend, Legend, Legend, Legend, Legend];

const key = (token: string, legends: Legends): KeyDef =>
  kitKey(token, [...legends, null]);

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

/** Index of the CURSOR layer in `layers` below - the last of them. */
const CURSOR_LAYER = 5;

/**
 * A digit key that is also one of the machine's cursor keys. Both legends move
 * the editor caret, and the CURSOR one presses CAPS SHIFT + the digit - the
 * pair the real keyboard sends - rather than the digit's own cell.
 */
const arrowDigit = (
  token: string,
  digit: string,
  arrow: string,
  action: CursorAction,
  symbol: Legend,
): KeyDef =>
  withLegend(
    key(token, [digit, act(arrow, action), symbol, null, null]),
    CURSOR_LAYER,
    cursorKey(arrow, action, ['CapsShift', token]),
  );

const numberRow = [
  key('Digit1', ['1', null, '!', null, null]),
  key('Digit2', ['2', null, '@', null, null]),
  key('Digit3', ['3', null, '#', null, null]),
  key('Digit4', ['4', null, '$', null, null]),
  arrowDigit('Digit5', '5', '←', 'left', '%'),
  arrowDigit('Digit6', '6', '↓', 'down', '&'),
  arrowDigit('Digit7', '7', '↑', 'up', ins("'", "'")),
  arrowDigit('Digit8', '8', '→', 'right', '('),
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

const homeRow = centerRow([
  letter('KeyA', 'a', '~', 'NEW', word('READ')),
  letter('KeyS', 's', '|', 'SAVE', word('RESTORE')),
  letter('KeyD', 'd', '\\', 'DIM', word('DATA')),
  letter('KeyF', 'f', '{', 'FOR', word('SGN')),
  letter('KeyG', 'g', '}', 'GO TO', word('ABS')),
  letter('KeyH', 'h', ins('↑', '↑'), 'GO SUB', word('SQR')),
  letter('KeyJ', 'j', '-', 'LOAD', word('VAL')),
  letter('KeyK', 'k', '+', 'LIST', word('LEN')),
  letter('KeyL', 'l', '=', 'LET', word('USR')),
]);

const capsKey: KeyDef = {
  id: 'CapsShift',
  spanX: 6,
  emits: ['CapsShift'],
  modifier: 'caps',
  style: 'shift',
  labels: [{ text: '⇧ Cap' }, null, null, null, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 6,
  emits: ['CapsShift', 'Digit0'],
  labels: [
    { text: '⌫', editor: { action: 'backspace' } },
    null,
    null,
    null,
    null,
    null,
  ],
};

const zxcvRow = flankedRow(
  capsKey,
  [
    letter('KeyZ', 'z', ':', 'COPY', word('LN')),
    letter('KeyX', 'x', ins('£', '£'), 'CLEAR', word('EXP')),
    letter('KeyC', 'c', '?', 'CONTINUE', word('INKEY$')),
    letter('KeyV', 'v', '/', 'CLS', word('VAL$')),
    letter('KeyB', 'b', '*', 'BORDER', word('BIN')),
    letter('KeyN', 'n', ',', 'NEXT', word('INKEY$')),
    letter('KeyM', 'm', '.', 'PAUSE', word('PI')),
  ],
  backspaceKey,
);

const symKey: KeyDef = {
  id: 'SymShift',
  spanX: 6,
  emits: ['SymShift'],
  modifier: 'symbol',
  style: 'symshift',
  labels: [{ text: '⇧ Sym' }, null, null, null, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [
    { text: '␣', editor: { insert: ' ' } },
    null,
    null,
    null,
    null,
    null,
  ],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['SymShift', 'KeyP'],
  labels: [{ text: '"' }, null, null, null, null, null],
};

const enterKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([symKey], spaceKey, [quoteKey, enterKey]),
];

/**
 * How the Spectrum reaches each canonical SYM symbol: the SYMBOL SHIFT
 * combination the red legends record. The `^` slot shows the machine's own
 * `↑` (the Spectrum's exponent character). `~ | \ { }` are extended-mode
 * characters - CAPS+SYM first, then SYMBOL SHIFT + the letter - a two-chord
 * sequence no single combination sends (plain SymShift+A types STOP), so
 * their cells insert into the editor and press nothing on the machine.
 */
const SPECTRUM_SYMBOLS: SymbolTable = {
  '+': { emits: ['SymShift', 'KeyK'] },
  '!': { emits: ['SymShift', 'Digit1'] },
  '-': { emits: ['SymShift', 'KeyJ'] },
  '=': { emits: ['SymShift', 'KeyL'] },
  '/': { emits: ['SymShift', 'KeyV'] },
  '*': { emits: ['SymShift', 'KeyB'] },
  '<': { emits: ['SymShift', 'KeyR'] },
  '>': { emits: ['SymShift', 'KeyT'] },
  '(': { emits: ['SymShift', 'Digit8'] },
  ')': { emits: ['SymShift', 'Digit9'] },
  '@': { emits: ['SymShift', 'Digit2'] },
  '#': { emits: ['SymShift', 'Digit3'] },
  $: { emits: ['SymShift', 'Digit4'] },
  '%': { emits: ['SymShift', 'Digit5'] },
  '^': { emits: ['SymShift', 'KeyH'], insert: '↑', text: '↑' },
  '&': { emits: ['SymShift', 'Digit6'] },
  _: { emits: ['SymShift', 'Digit0'] },
  "'": { emits: ['SymShift', 'Digit7'] },
  '"': { emits: ['SymShift', 'KeyP'] },
  ':': { emits: ['SymShift', 'KeyZ'] },
  ';': { emits: ['SymShift', 'KeyO'] },
  ',': { emits: ['SymShift', 'KeyN'] },
  '.': { emits: ['SymShift', 'KeyM'] },
  '~': { emits: [] },
  '|': { emits: [] },
  '\\': { emits: [] },
  '{': { emits: [] },
  '}': { emits: [] },
  '£': { emits: ['SymShift', 'KeyX'] },
  '?': { emits: ['SymShift', 'KeyC'] },
};

export const spectrumKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
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
      {
        id: 'cursor',
        name: 'CURSOR',
        position: 'br',
        activeWhen: [],
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'main' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // GRAPHICS pins no layer - the palette carries the characters, and CAPS /
      // SYMBOL keep their ordinary meaning while it is open.
      { id: 'graphics', name: 'GRAPHICS', layer: 'main', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'caps', emits: ['CapsShift'], sticky: true, lockable: true },
      { id: 'symbol', emits: ['SymShift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [
        { title: 'Block graphics', entries: SPECTRUM_BLOCK_GRAPHICS },
        { title: 'User-defined graphics', entries: SPECTRUM_UDG_GRAPHICS },
      ],
    },
    glyphs: {},
    options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
    // Sinclair joystick convention: 5/6/7/8 = left/down/up/right; Space/Enter
    // as fire (key-mapped mode).
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
  },
  SPECTRUM_SYMBOLS,
);
