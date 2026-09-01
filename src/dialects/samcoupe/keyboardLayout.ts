import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type Legend,
  act,
  cursorKey,
  key as kitKey,
} from '../../keyboard/legendKit';
import {
  type SymbolTable,
  GRID_COLUMNS,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { SAMCOUPE_BLOCK_GRAPHICS, SAMCOUPE_UDG_GRAPHICS } from './graphics';

/**
 * The SAM Coupé keyboard on the standard virtual-keyboard template: number row,
 * ten-key QWERTY row, centred nine-key home row, the shift/delete-flanked
 * bottom letter row, and a bottom row of ESC, EDIT, space, quote and ENTER.
 * The ten programmable function keys - the strip is designed for exactly this -
 * sit in the top strip behind the mode/function toggle.
 *
 * Two character layers:
 *  - base:  the unshifted character; letters are lower case, which is what the
 *    machine types from a cold start
 *  - caps:  the capital, while SHIFT is held. CAPS LOCK is the same key locked
 *
 * The machine's punctuation is reached only through the SYM mode, at the
 * template's canonical positions, each cell pressing the SAM's own key or
 * chord. What the real keycaps carry on their shifted faces, none of which is a
 * SHIFT layer here, was read back off the booted ROM:
 *
 *   SHIFT + 1-0   ! @ # $ % & ' ( ) ~        SHIFT + - + =   / * _
 *   SHIFT + "     ©                          SYMBOL + 9 0    | ~
 *   SYMBOL + Q W R T F G H J K L Z   < > [ ] { } ↑ - + £ ?
 *   SYMBOL + , .  < >                        SHIFT+SYMBOL+INV  \
 *
 * The dedicated `- + = " ; : , .` keys type themselves unshifted, so the SYM
 * cells for those press the single key rather than a chord.
 *
 * SYMBOL and CONTROL are the machine's other two modifiers and carry no keycap
 * here. SYMBOL is pressed by the SYM cells that need it, and CONTROL selects
 * the keyword faces the editor's autocomplete already offers; both, and the TAB
 * key, still reach the matrix from a host keyboard.
 *
 * The block and user-defined graphics are a GRAPHICS tab showing the palette
 * rather than key legends: the SAM prints keywords on the faces its graphics
 * come out of (see `./graphics.ts`), so there is no keycap to label them with.
 *
 * The cursor cluster is four keys of its own, which no keycap on the template
 * carries, so the CURSOR mode overlays the arrows on W/A/S/D and presses the
 * real `ArrowUp`/… cells.
 */

/** The two character layers, index-aligned with `layout.layers` below. */
type Legends = [Legend, Legend];

/** A standard key: [base, caps] legends plus an optional CURSOR legend. */
const key = (token: string, legends: Legends, cursor: Legend = null): KeyDef =>
  kitKey(token, [...legends, cursor]);

/** A letter key: lower case unshifted, the capital under SHIFT. */
const letter = (token: string, ch: string, cursor: Legend = null): KeyDef =>
  key(token, [ch, ch.toUpperCase()], cursor);

const numberRow = [
  key('Digit1', ['1', null]),
  key('Digit2', ['2', null]),
  key('Digit3', ['3', null]),
  key('Digit4', ['4', null]),
  key('Digit5', ['5', null]),
  key('Digit6', ['6', null]),
  key('Digit7', ['7', null]),
  key('Digit8', ['8', null]),
  key('Digit9', ['9', null]),
  key('Digit0', ['0', null]),
];

const qwertyRow = [
  letter('KeyQ', 'q'),
  letter('KeyW', 'w', cursorKey('↑', 'up', 'ArrowUp')),
  letter('KeyE', 'e'),
  letter('KeyR', 'r'),
  letter('KeyT', 't'),
  letter('KeyY', 'y'),
  letter('KeyU', 'u'),
  letter('KeyI', 'i'),
  letter('KeyO', 'o'),
  letter('KeyP', 'p'),
];

const homeRow = centerRow([
  letter('KeyA', 'a', cursorKey('←', 'left', 'ArrowLeft')),
  letter('KeyS', 's', cursorKey('↓', 'down', 'ArrowDown')),
  letter('KeyD', 'd', cursorKey('→', 'right', 'ArrowRight')),
  letter('KeyF', 'f'),
  letter('KeyG', 'g'),
  letter('KeyH', 'h'),
  letter('KeyJ', 'j'),
  letter('KeyK', 'k'),
  letter('KeyL', 'l'),
]);

const shiftKey: KeyDef = {
  id: 'ShiftLeft',
  spanX: 6,
  emits: ['ShiftLeft'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

const deleteKey: KeyDef = {
  id: 'Delete',
  spanX: 6,
  emits: ['Delete'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null],
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    letter('KeyZ', 'z'),
    letter('KeyX', 'x'),
    letter('KeyC', 'c'),
    letter('KeyV', 'v'),
    letter('KeyB', 'b'),
    letter('KeyN', 'n'),
    letter('KeyM', 'm'),
  ],
  deleteKey,
);

/** ESC, which is how a program on this machine is stopped. */
const escKey: KeyDef = {
  id: 'Escape',
  spanX: 4,
  emits: ['Escape'],
  labels: [{ text: 'Esc', editor: null }, null, null],
};

/** EDIT: recalls the last line, or the line a report named, for editing. */
const editKey: KeyDef = {
  id: 'Edit',
  spanX: 4,
  emits: ['Edit'],
  labels: [{ text: 'Edit', editor: null }, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Quote'],
  labels: [{ text: '"' }, null, null],
};

const enterKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([escKey, editKey], spaceKey, [quoteKey, enterKey]),
];

/**
 * F1-F9 and F0, the ten programmable function keys. They press the matrix and
 * nothing else: what each does is whatever the running program made of it.
 */
const functionKeys: KeyDef[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
].map((n) => ({
  id: `F${n}`,
  spanX: 4,
  emits: [`F${n}`],
  style: 'fn',
  labels: [{ text: `f${n}`, editor: null }, null, null],
}));

/**
 * How the SAM reaches each canonical SYM symbol, every chord read back off the
 * booted v3.0 ROM by typing it and asking the machine for the character `CODE`
 * it produced.
 *
 * Three notes on the ones that are not simply "the key with SHIFT". `^` shows
 * and inserts the machine's own `↑` (0x5E), its exponent character, as the
 * Spectrum's cell does. `<` and `>` sit on the comma and full-stop keys under
 * SYMBOL, not under SHIFT, which gives those keys their own character. And `\`
 * is SHIFT + SYMBOL + INV - the one chord on this keyboard that needs three
 * keys, and the only way to the character at 0x5C.
 */
const SAMCOUPE_SYMBOLS: SymbolTable = {
  '+': { emits: ['Plus'] },
  '-': { emits: ['Minus'] },
  '=': { emits: ['Equal'] },
  '"': { emits: ['Quote'] },
  ';': { emits: ['Semicolon'] },
  ':': { emits: ['Colon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '*': { emits: ['ShiftLeft', 'Plus'] },
  '/': { emits: ['ShiftLeft', 'Minus'] },
  _: { emits: ['ShiftLeft', 'Equal'] },
  '!': { emits: ['ShiftLeft', 'Digit1'] },
  '@': { emits: ['ShiftLeft', 'Digit2'] },
  '#': { emits: ['ShiftLeft', 'Digit3'] },
  $: { emits: ['ShiftLeft', 'Digit4'] },
  '%': { emits: ['ShiftLeft', 'Digit5'] },
  '&': { emits: ['ShiftLeft', 'Digit6'] },
  "'": { emits: ['ShiftLeft', 'Digit7'] },
  '(': { emits: ['ShiftLeft', 'Digit8'] },
  ')': { emits: ['ShiftLeft', 'Digit9'] },
  '~': { emits: ['ShiftLeft', 'Digit0'] },
  '|': { emits: ['SymShift', 'Digit9'] },
  '<': { emits: ['SymShift', 'Comma'] },
  '>': { emits: ['SymShift', 'Period'] },
  '[': { emits: ['SymShift', 'KeyR'] },
  ']': { emits: ['SymShift', 'KeyT'] },
  '{': { emits: ['SymShift', 'KeyF'] },
  '}': { emits: ['SymShift', 'KeyG'] },
  '^': { emits: ['SymShift', 'KeyH'], insert: '↑', text: '↑' },
  '£': { emits: ['SymShift', 'KeyL'] },
  '?': { emits: ['SymShift', 'KeyZ'] },
  '\\': { emits: ['ShiftLeft', 'SymShift', 'Inv'] },
};

export const samcoupeKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'samcoupe',
    name: 'SAM Coupé',
    theme: 'vk-theme-samcoupe',
    gridColumns: GRID_COLUMNS,
    // Lower case unshifted from a cold start, so the letter keycaps are
    // authored in lower case.
    powerOnCase: 'lower',
    layers: [
      {
        id: 'base',
        position: 'center',
        activeWhen: [],
        editorInsertStyle: 'char',
      },
      {
        id: 'caps',
        name: 'CAPS',
        position: 'tl',
        activeWhen: ['shift'],
        editorInsertStyle: 'char',
      },
      {
        id: 'cursor',
        name: 'CURSOR',
        position: 'tr',
        activeWhen: [],
        modeOnly: true,
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'base' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // GRAPHICS pins no layer of its own: the palette carries the characters,
      // and SHIFT keeps its ordinary meaning while it is open.
      { id: 'graphics', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      // CAPS LOCK, latched by locking the SHIFT key. The SAM gives it a keycap
      // of its own, so that is the single key the lock taps - and the letters
      // change case in the ROM rather than by the shift cell staying down.
      {
        id: 'shift',
        emits: ['ShiftLeft'],
        sticky: true,
        lockable: true,
        caseLock: { emits: ['CapsLock'] },
      },
    ],
    rows,
    graphicsPalette: {
      sections: [
        {
          title: 'Block graphics – CHR$(128)–CHR$(143)',
          note: 'Typed at the machine as SYMBOL with 1–8, and CONTROL+SYMBOL with 1–8 for the complementary eight – but only inside a string, because outside one the same bytes are keyword tokens.',
          entries: SAMCOUPE_BLOCK_GRAPHICS,
        },
        {
          title: 'User-defined graphics – CHR$(144)–CHR$(168)',
          note: 'A to Y. Each draws whatever the program has poked into its eight bytes of UDG RAM, so the letter is all the cell can show.',
          entries: SAMCOUPE_UDG_GRAPHICS,
        },
      ],
    },
    functionKeys,
    glyphs: {},
    options: { minHoldFrames: 3 },
    // The SAM reads its joystick as keys 6, 7, 8, 9 and 0 on the matrix, which
    // is how SAM BASIC's own key functions see it - so the controller presses
    // exactly those.
    controller: {
      bindings: {
        up: 'Digit9',
        down: 'Digit8',
        left: 'Digit6',
        right: 'Digit7',
        fire1: 'Digit0',
        fire2: 'Space',
      },
    },
  },
  SAMCOUPE_SYMBOLS,
);
