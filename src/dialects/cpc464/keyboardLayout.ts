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
  CPC_LINE_GRAPHICS,
  CPC_MOSAIC_GRAPHICS,
  CPC_SHADE_GRAPHICS,
} from './graphics';

/**
 * The Amstrad CPC 464 keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the
 * shift/DEL-flanked bottom letter row, and a bottom row of space, quote,
 * and Return at the far right.
 *
 * Two character layers:
 *  - base:    the unshifted character
 *  - shifted: the shifted symbol (top-left), active while SHIFT is held
 *
 * Key tokens are exactly the matrix tokens the emulator's `setKey` decodes
 * (`src/emulator/cpc/keyboard.ts` — single letters `A`-`Z`, `Digit0`-`Digit9`,
 * `Return`, `Del`, `Shift`, `CursorUp`…, `F0`-`F9`), so the virtual
 * keyboard and the physical `keyEvent` map share one vocabulary. The
 * machine's punctuation lives in the SYM mode at the template's canonical
 * positions, each cell pressing the CPC's own key or SHIFT pair - the
 * dedicated `- ^ @ [ ] ; : / , . \` keys keep their matrix cells even
 * though their keycaps left the board.
 *
 * Rather than four dedicated cursor keys, the cursor cluster is a CURSOR mode
 * that overlays `↑ ← ↓ →` on the W/A/S/D keys (moving the editor caret); the
 * real `CursorUp`/… matrix cells stay reachable via the physical arrow keys
 * and the keyboard-joystick, which binds to them through `controllerKeys`.
 * The numeric-keypad function keys `f0`-`f9` live in the top strip. The 464's
 * coloured keycaps come from the `vk-theme-cpc464` block in
 * VirtualKeyboard.css; the CPC 6128 sibling (`../cpc6128/`) re-exports these
 * rows under its own theme.
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
  key('Q', ['Q', null]),
  key('W', ['W', null], cursorKey('↑', 'up', 'CursorUp')),
  key('E', ['E', null]),
  key('R', ['R', null]),
  key('T', ['T', null]),
  key('Y', ['Y', null]),
  key('U', ['U', null]),
  key('I', ['I', null]),
  key('O', ['O', null]),
  key('P', ['P', null]),
];

const homeRow = centerRow([
  key('A', ['A', null], cursorKey('←', 'left', 'CursorLeft')),
  key('S', ['S', null], cursorKey('↓', 'down', 'CursorDown')),
  key('D', ['D', null], cursorKey('→', 'right', 'CursorRight')),
  key('F', ['F', null]),
  key('G', ['G', null]),
  key('H', ['H', null]),
  key('J', ['J', null]),
  key('K', ['K', null]),
  key('L', ['L', null]),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

const delKey: KeyDef = {
  id: 'Del',
  spanX: 6,
  emits: ['Del'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null],
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    key('Z', ['Z', null]),
    key('X', ['X', null]),
    key('C', ['C', null]),
    key('V', ['V', null]),
    key('B', ['B', null]),
    key('N', ['N', null]),
    key('M', ['M', null]),
  ],
  delKey,
);

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

/** Double quote, typed as SHIFT+2 on the CPC matrix (as the BBC/Atom do). */
const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'Digit2'],
  labels: [{ text: '"' }, null, null],
};

const returnKey: KeyDef = kitKey('Return', [act('↵', 'newline')], {
  spanX: 6,
});

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([], spaceKey, [quoteKey, returnKey]),
];

// The numeric-keypad function keys f0–f9, in the top strip behind the toggle.
const functionKeys: KeyDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `F${i}`,
  spanX: 4,
  emits: [`F${i}`],
  style: 'fn',
  labels: [{ text: `f${i}`, editor: null }, null, null],
}));

// The cursor cluster is not a set of keycaps (it's the CURSOR overlay on WASD),
// but the keyboard-joystick still presses the real matrix cells, so the four
// keys live here as controller-only bindings the renderer never draws.
const cursorControllerKey = (token: string, glyph: string): KeyDef => ({
  id: token,
  spanX: 4,
  emits: [token],
  style: 'cursor',
  labels: [{ text: glyph }, null, null],
});

const controllerKeys: KeyDef[] = [
  cursorControllerKey('CursorUp', '↑'),
  cursorControllerKey('CursorDown', '↓'),
  cursorControllerKey('CursorLeft', '←'),
  cursorControllerKey('CursorRight', '→'),
];

/**
 * How the CPC reaches each canonical SYM symbol: the dedicated keys' shift
 * pairs as the CPC keyboard engraves them (`-=`, `^£`, `@|`, `[{`, `]}`,
 * `;+`, `:*`, `,<`, `.>`, `/?`, `` \` ``), plus the shifted number row.
 * The CPC displays 0x5E as `↑`; its charset accepts both, so the `^` cell
 * shows and inserts the machine's own form.
 */
const CPC_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '-': { emits: ['Minus'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  _: { emits: ['Shift', 'Digit0'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['BracketOpen'] },
  ']': { emits: ['BracketClose'] },
  '@': { emits: ['At'] },
  '#': { emits: ['Shift', 'Digit3'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['Caret'], insert: '↑', text: '↑' },
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
  '`': { emits: ['Shift', 'Backslash'] },
  '\\': { emits: ['Backslash'] },
  '|': { emits: ['Shift', 'At'] },
  '{': { emits: ['Shift', 'BracketOpen'] },
  '}': { emits: ['Shift', 'BracketClose'] },
  '£': { emits: ['Shift', 'Caret'] },
  '?': { emits: ['Shift', 'Slash'] },
};

export const cpc464KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
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
      // The CPC prints no graphics on its keycaps, so this mode pins no layer:
      // the palette below carries the characters and labels each with the code
      // CHR$ takes, which is how the machine itself reached them.
      { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [
        { title: 'Mosaics', entries: CPC_MOSAIC_GRAPHICS },
        { title: 'Lines', entries: CPC_LINE_GRAPHICS },
        { title: 'Shades and diagonals', entries: CPC_SHADE_GRAPHICS },
      ],
    },
    functionKeys,
    controllerKeys,
    glyphs: {},
    options: { minHoldFrames: 4 },
    // CPC keyboard-joystick: the cursor cluster steers, SPACE / ENTER fire.
    // The cursor keys are the non-rendered `controllerKeys` above (surfaced to
    // the typist as the CURSOR overlay on WASD); the real hardware joystick
    // (matrix line 9 via setJoystick, `native` mode) is a separate path.
    controller: {
      bindings: {
        up: 'CursorUp',
        down: 'CursorDown',
        left: 'CursorLeft',
        right: 'CursorRight',
        fire1: 'Space',
        fire2: 'Return',
      },
    },
  },
  CPC_SYMBOLS,
);
