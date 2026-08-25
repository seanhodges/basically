import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type CursorAction,
  type Legend,
  act,
  cursorKey,
  key as kitKey,
  withLegend,
} from '../../keyboard/legendKit';
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { ZX80_GRAPHICS } from './graphics';

/**
 * The Sinclair ZX80 keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the
 * shift/backspace-flanked bottom letter row, and a bottom row ending
 * quote-then-Enter - the machine's symbols in the SYM mode at the template's
 * canonical positions.
 *
 * The ZX80 shares the ZX81's 8×5 matrix (so the machine key tokens - `emits` -
 * are identical) but has fewer legends. Each alphanumeric key carries up to
 * three:
 *  - main:     the letter / digit
 *  - shift:    the symbol/operator typed with SHIFT held
 *  - keyword:  the white K-mode command
 *
 * The keyword layer is a marking, not an input mode - keyword entry is the
 * editor autocomplete's job - and a key prints one marking at a time, so it
 * shows only where no mode or modifier selects another. As on the ZX81, the block
 * graphics are shown as a palette rather than as key legends (see ./graphics).
 * The ZX80 has no FUNCTION cursor mode, so there is no function layer. The
 * cursor keys are SHIFT + 5/6/7/8, so the arrows sit on those number keys,
 * where the machine prints them: they are the SHIFT legends there, and CURSOR
 * mode repeats them on the same keycaps so the pair can be sent without the
 * modifier held.
 */

// Label tuple order matches `layers` below: [main, shift, keyword].
type Legends = [Legend, Legend, Legend];

const key = (token: string, legends: Legends): KeyDef =>
  kitKey(token, [...legends, null]);

/** Index of the CURSOR layer in `layers` below - the last of them. */
const CURSOR_LAYER = 3;

/**
 * A digit key that is also one of the machine's cursor keys. Both legends move
 * the editor caret, and the CURSOR one presses SHIFT + the digit - the pair the
 * real keyboard sends - rather than the digit's own cell.
 */
const arrowDigit = (
  token: string,
  digit: string,
  arrow: string,
  action: CursorAction,
): KeyDef =>
  withLegend(
    key(token, [digit, act(arrow, action), null]),
    CURSOR_LAYER,
    cursorKey(arrow, action, ['Shift', token]),
  );

const numberRow = [
  key('Digit1', ['1', null, null]),
  key('Digit2', ['2', null, null]),
  key('Digit3', ['3', null, null]),
  key('Digit4', ['4', null, null]),
  arrowDigit('Digit5', '5', '←', 'left'),
  arrowDigit('Digit6', '6', '↓', 'down'),
  arrowDigit('Digit7', '7', '↑', 'up'),
  arrowDigit('Digit8', '8', '→', 'right'),
  key('Digit9', ['9', null, null]),
  key('Digit0', ['0', null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', null, 'NEW']),
  key('KeyW', ['W', null, 'LOAD']),
  key('KeyE', ['E', null, 'SAVE']),
  key('KeyR', ['R', null, 'RUN']),
  key('KeyT', ['T', null, 'CONTINUE']),
  key('KeyY', ['Y', null, 'REM']),
  key('KeyU', ['U', null, 'IF']),
  key('KeyI', ['I', null, 'INPUT']),
  key('KeyO', ['O', null, 'PRINT']),
  key('KeyP', ['P', null, null]),
];

const homeRow = centerRow([
  key('KeyA', ['A', null, 'LIST']),
  key('KeyS', ['S', null, 'STOP']),
  key('KeyD', ['D', null, 'DIM']),
  key('KeyF', ['F', null, 'FOR']),
  key('KeyG', ['G', null, 'GOTO']),
  key('KeyH', ['H', null, 'POKE']),
  key('KeyJ', ['J', null, 'RANDOMISE']),
  key('KeyK', ['K', null, 'LET']),
  key('KeyL', ['L', null, null]),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 6,
  emits: ['Shift', 'Digit0'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null, null],
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    key('KeyZ', ['Z', null, null]),
    key('KeyX', ['X', null, 'CLEAR']),
    key('KeyC', ['C', null, 'CLS']),
    key('KeyV', ['V', null, 'GOSUB']),
    key('KeyB', ['B', null, 'RETURN']),
    key('KeyN', ['N', null, 'NEXT']),
    key('KeyM', ['M', null, null]),
  ],
  backspaceKey,
);

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'KeyY'],
  labels: [{ text: '"' }, null, null, null],
};

const enterKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([], spaceKey, [quoteKey, enterKey]),
];

/**
 * How the ZX80 reaches each canonical SYM symbol: everything is SHIFT + a
 * key, except the full stop, whose own key keeps its matrix cell even though
 * the keycap left the board.
 */
const ZX80_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'KeyK'] },
  '-': { emits: ['Shift', 'KeyJ'] },
  '=': { emits: ['Shift', 'KeyL'] },
  '/': { emits: ['Shift', 'KeyV'] },
  '*': { emits: ['Shift', 'KeyP'] },
  '<': { emits: ['Shift', 'KeyN'] },
  '>': { emits: ['Shift', 'KeyM'] },
  '(': { emits: ['Shift', 'KeyI'] },
  ')': { emits: ['Shift', 'KeyO'] },
  $: { emits: ['Shift', 'KeyU'] },
  '"': { emits: ['Shift', 'KeyY'] },
  ':': { emits: ['Shift', 'KeyZ'] },
  ';': { emits: ['Shift', 'KeyX'] },
  ',': { emits: ['Shift', 'Period'] },
  '.': { emits: ['Period'] },
  '?': { emits: ['Shift', 'KeyC'] },
  '£': { emits: ['Shift', 'Space'] },
};

export const zx80KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'zx80',
    name: 'ZX80',
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
        id: 'cursor',
        name: 'CURSOR',
        position: 'br',
        activeWhen: [],
        modeOnly: true,
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'main' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // No graphics key layer: the mode shows the palette, whose cells insert
      // the characters directly.
      { id: 'graphic', name: 'GRAPHICS', layer: 'main', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: { sections: [{ entries: ZX80_GRAPHICS }] },
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
  ZX80_SYMBOLS,
);
