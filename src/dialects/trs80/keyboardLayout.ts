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
import { TRS80_GRAPHICS } from './graphics';

/**
 * The TRS-80 keyboard on the standard virtual-keyboard template: number row,
 * ten-key QWERTY row, centred nine-key home row, the bottom letter row
 * flanked by SHIFT and the machine's own `←` key, and a bottom row of BREAK,
 * space, quote, and Enter at the far right.
 *
 * The TRS-80 is a plain QWERTY with SHIFT. Each key `emits` the
 * DOM-`code`-style token the interpreter's input adapter understands
 * (`interpreter/input.ts`), whose pair table also records the machine's
 * shift pairs (`,<` `.>` `;+` `:*` `-=` `/?`). The machine's symbols live in
 * the SYM mode at the template's canonical positions, each cell pressing
 * the machine's own key or SHIFT pair; the keycaps themselves carry no
 * symbol legends.
 *
 * A `cursor` layer (pinned by the CURSOR mode tab) overlays `↑ ← ↓ →` on
 * the W/A/S/D keys, moving the editor caret - the same concept as the CPC
 * 464 sibling. Every other key between the number row and the bottom row is
 * blank and inert in CURSOR mode.
 */

/**
 * A key: base legend plus the CURSOR arrow the four WASD keys carry. Label
 * tuple order matches `layers` below: [base, shift, cursor]; the shift
 * layer holds no legends (SHIFT only matters to the machine matrix here).
 */
const key = (
  token: string,
  main: string,
  shift: Legend = null,
  cursor: Legend = null,
): KeyDef => kitKey(token, [main, shift, cursor]);

const numberRow = [
  key('Digit1', '1'),
  key('Digit2', '2'),
  key('Digit3', '3'),
  key('Digit4', '4'),
  key('Digit5', '5'),
  key('Digit6', '6'),
  key('Digit7', '7'),
  key('Digit8', '8'),
  key('Digit9', '9'),
  key('Digit0', '0'),
];

const qwertyRow = [
  key('KeyQ', 'Q'),
  key('KeyW', 'W', null, cursorKey('↑', 'up', 'ArrowUp')),
  key('KeyE', 'E'),
  key('KeyR', 'R'),
  key('KeyT', 'T'),
  key('KeyY', 'Y'),
  key('KeyU', 'U'),
  key('KeyI', 'I'),
  key('KeyO', 'O'),
  key('KeyP', 'P'),
];

const homeRow = centerRow([
  key('KeyA', 'A', null, cursorKey('←', 'left', 'ArrowLeft')),
  key('KeyS', 'S', null, cursorKey('↓', 'down', 'ArrowDown')),
  key('KeyD', 'D', null, cursorKey('→', 'right', 'ArrowRight')),
  key('KeyF', 'F'),
  key('KeyG', 'G'),
  key('KeyH', 'H'),
  key('KeyJ', 'J'),
  key('KeyK', 'K'),
  key('KeyL', 'L'),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

/**
 * The Model I has no backspace and no delete key: `←` is its destructive
 * backspace, sending 0x08, which the screen driver reads as "backspace and
 * erase". So the keycap carries the machine's own legend, and the editor action
 * matches what the machine does with it - move back one and erase. CURSOR mode
 * reaches the same cell, and the other three arrows besides; this cap is here
 * for the reach.
 */
const leftArrowKey: KeyDef = {
  ...kitKey('Backspace', [act('←', 'backspace'), null, null], {
    emits: ['ArrowLeft'],
  }),
  spanX: 6,
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    key('KeyZ', 'Z'),
    key('KeyX', 'X'),
    key('KeyC', 'C'),
    key('KeyV', 'V'),
    key('KeyB', 'B'),
    key('KeyN', 'N'),
    key('KeyM', 'M'),
  ],
  leftArrowKey,
);

/** BREAK, in the bottom-left machine region; no editor insert. */
const breakKey = kitKey('Break', [{ text: 'BRK', editor: null }, null, null]);

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

// " is SHIFT-2.
const quoteKey = kitKey('Quote', ['"', null, null], {
  emits: ['Shift', 'Digit2'],
});

const enterKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([breakKey], spaceKey, [quoteKey, enterKey]),
];

/**
 * How the TRS-80 reaches each canonical SYM symbol: the input adapter's
 * pair table (`,<` `.>` `;+` `:*` `-=` `/?`), the dedicated `@` key, and
 * the shifted number row.
 */
const TRS80_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '-': { emits: ['Minus'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  '*': { emits: ['Shift', 'Colon'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '@': { emits: ['At'] },
  '#': { emits: ['Shift', 'Digit3'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '&': { emits: ['Shift', 'Digit6'] },
  '(': { emits: ['Shift', 'Digit8'] },
  ')': { emits: ['Shift', 'Digit9'] },
  "'": { emits: ['Shift', 'Digit7'] },
  '"': { emits: ['Shift', 'Digit2'] },
  ':': { emits: ['Colon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '?': { emits: ['Shift', 'Slash'] },
};

export const trs80KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'trs80',
    name: 'TRS-80',
    theme: 'vk-theme-trs80',
    gridColumns: 40,
    layers: [
      {
        id: 'base',
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
        id: 'cursor',
        name: 'CURSOR',
        position: 'br',
        activeWhen: [],
        modeOnly: true,
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'base' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // The TRS-80 prints no graphics on its keycaps, so this mode pins no
      // layer: the palette below carries the characters and labels each with
      // the code CHR$ takes, which is how the machine itself reached them.
      { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: { sections: [{ entries: TRS80_GRAPHICS }] },
    glyphs: {},
    options: { minHoldFrames: 1 },
    // WASD movement + Space/Enter fire (the convention the bundled TRS-80
    // games use).
    controller: {
      bindings: {
        up: 'KeyW',
        down: 'KeyS',
        left: 'KeyA',
        right: 'KeyD',
        fire1: 'Space',
        fire2: 'Enter',
      },
    },
  },
  TRS80_SYMBOLS,
);
