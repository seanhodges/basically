import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type Legend,
  act,
  cursorKey,
  key as kitKey,
} from '../../keyboard/legendKit';
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import {
  BBC_LOW_MOSAICS,
  BBC_HIGH_MOSAICS,
  BBC_GRAPHICS_COLOURS,
  BBC_GRAPHICS_STYLES,
} from './graphics';

/**
 * The BBC Micro Model B keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the
 * shift/delete-flanked bottom letter row, and a bottom row of Escape, space,
 * quote, and Enter at the far right.
 *
 * Two character layers:
 *  - base:     the unshifted character
 *  - shifted:  the shifted symbol (top-left), active while SHIFT is held
 *
 * A letter key carries the capital on both, because SHIFT gives upper case on
 * this machine whichever way CAPS LOCK is set; the keycap follows the lock
 * instead, and shows the case it will type.
 *
 * The machine's punctuation lives in the SYM mode at the template's
 * canonical positions, each cell pressing the BBC's own key or SHIFT pair -
 * the dedicated keys keep their matrix cells even though their keycaps left
 * the board, and the jsbeeb constant names (MINUS, HAT_TILDE,
 * PIPE_BACKSLASH, UNDERSCORE_POUND, SEMICOLON_PLUS, COLON_STAR…) record the
 * shift pairs. The f0–f9 function keys live in the top strip behind the
 * mode/function toggle.
 *
 * A `cursor` layer (pinned by the CURSOR mode tab, top-right on the keycap)
 * overlays `↑ ← ↓ →` on the W/A/S/D keys, moving the editor caret - the
 * same concept as the CPC 464 sibling. Every other key above the bottom row
 * is blank and inert in CURSOR mode.
 */

/** The two character layers, index-aligned with `layout.layers` below. */
type Legends = [Legend, Legend];

/**
 * A standard key: [base, shifted] legends plus an optional CURSOR-layer
 * legend (the ↑←↓→ overlay on the WASD keys), one matrix token.
 */
const key = (token: string, legends: Legends, cursor: Legend = null): KeyDef =>
  kitKey(token, [...legends, cursor]);

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
  key('KeyQ', ['Q', 'Q']),
  key('KeyW', ['W', 'W'], cursorKey('↑', 'up', 'ArrowUp')),
  key('KeyE', ['E', 'E']),
  key('KeyR', ['R', 'R']),
  key('KeyT', ['T', 'T']),
  key('KeyY', ['Y', 'Y']),
  key('KeyU', ['U', 'U']),
  key('KeyI', ['I', 'I']),
  key('KeyO', ['O', 'O']),
  key('KeyP', ['P', 'P']),
];

const homeRow = centerRow([
  key('KeyA', ['A', 'A'], cursorKey('←', 'left', 'ArrowLeft')),
  key('KeyS', ['S', 'S'], cursorKey('↓', 'down', 'ArrowDown')),
  key('KeyD', ['D', 'D'], cursorKey('→', 'right', 'ArrowRight')),
  key('KeyF', ['F', 'F']),
  key('KeyG', ['G', 'G']),
  key('KeyH', ['H', 'H']),
  key('KeyJ', ['J', 'J']),
  key('KeyK', ['K', 'K']),
  key('KeyL', ['L', 'L']),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
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
    key('KeyZ', ['Z', 'Z']),
    key('KeyX', ['X', 'X']),
    key('KeyC', ['C', 'C']),
    key('KeyV', ['V', 'V']),
    key('KeyB', ['B', 'B']),
    key('KeyN', ['N', 'N']),
    key('KeyM', ['M', 'M']),
  ],
  deleteKey,
);

/**
 * CAPS LOCK, beside Escape in the bottom-left machine region.
 *
 * The BBC's only route to lower case, and the reason this keycap is here: the
 * machine powers up caps-locked and its SHIFT gives upper case in either lock
 * state (`src/dialects/caseKeys.test.ts`), so nothing on the board reaches
 * lower case without it. A tap, not a held modifier - the lock lives in the
 * ROM.
 */
const capsKey: KeyDef = {
  id: 'CapsLock',
  spanX: 6,
  emits: ['CapsLock'],
  caseLock: true,
  labels: [{ text: 'CAPS', editor: null }, null, null],
};

/** Escape, in the bottom-left machine region; no editor insert. */
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
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'Digit2'],
  labels: [{ text: '"' }, null, null],
};

const enterKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([escKey, capsKey], spaceKey, [quoteKey, enterKey]),
];

const functionKeys: KeyDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `F${i}`,
  spanX: 4,
  emits: [`F${i}`],
  style: 'fn',
  labels: [{ text: `f${i}`, editor: null }, null, null],
}));

/**
 * How the BBC reaches each canonical SYM symbol, every pair proved on the
 * OS 1.2 ROM: the dedicated keys carry `-=`, `^~`, `\|`, `[{`, `]}`, `;+`,
 * `:*`, `,<`, `.>`, `/?`; the pound key gives £ unshifted and # shifted;
 * and SHIFT+3 types `_` (not the # a modern keyboard puts there).
 */
const BBC_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '-': { emits: ['Minus'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  _: { emits: ['Shift', 'Digit3'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['BracketLeft'] },
  ']': { emits: ['BracketRight'] },
  '@': { emits: ['At'] },
  '#': { emits: ['Shift', 'Underscore'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['Caret'] },
  '&': { emits: ['Shift', 'Digit6'] },
  '*': { emits: ['Shift', 'Colon'] },
  '(': { emits: ['Shift', 'Digit8'] },
  ')': { emits: ['Shift', 'Digit9'] },
  "'": { emits: ['Shift', 'Digit7'] },
  '"': { emits: ['Shift', 'Digit2'] },
  ':': { emits: ['Colon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '~': { emits: ['Shift', 'Caret'] },
  '\\': { emits: ['Backslash'] },
  '|': { emits: ['Shift', 'Backslash'] },
  '{': { emits: ['Shift', 'BracketLeft'] },
  '}': { emits: ['Shift', 'BracketRight'] },
  '£': { emits: ['Underscore'] },
  '?': { emits: ['Shift', 'Slash'] },
};

export const bbcKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'bbcmicro',
    name: 'BBC Micro',
    theme: 'vk-theme-bbc',
    gridColumns: 40,
    // Caps-locked at power-on, so the base legends are the capitals - see
    // `capsKey` above.
    powerOnCase: 'upper',
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
      // The BBC prints no graphics on its keycaps, so this mode pins no layer:
      // the palette below carries the MODE 7 mosaics and labels each with the
      // code CHR$ takes, which is how the machine itself reached them.
      { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [
        {
          title: 'Graphics colour – CHR$(145)–CHR$(151)',
          note: 'MODE 7 prints the mosaics below as letters until one of these appears earlier on the same screen line.',
          entries: BBC_GRAPHICS_COLOURS,
        },
        { title: 'Mosaics – CHR$(161)–CHR$(191)', entries: BBC_LOW_MOSAICS },
        { title: 'Mosaics – CHR$(224)–CHR$(255)', entries: BBC_HIGH_MOSAICS },
        {
          title: 'Graphics style – CHR$(153), CHR$(154), CHR$(158), CHR$(159)',
          entries: BBC_GRAPHICS_STYLES,
        },
      ],
    },
    functionKeys,
    glyphs: {},
    options: { minHoldFrames: 4 },
    // BBC convention: Z/X = left/right, K/M = up/down; Space / Return as fire.
    controller: {
      bindings: {
        up: 'KeyK',
        down: 'KeyM',
        left: 'KeyZ',
        right: 'KeyX',
        fire1: 'Space',
        fire2: 'Enter',
      },
    },
  },
  BBC_SYMBOLS,
);
