// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type Legend,
  act,
  cursorKey,
  key as kitKey,
} from '../../keyboard/legendKit';
import {
  FLANK_SPAN,
  GRID_COLUMNS,
  KEY_SPAN,
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import {
  SORCERER_BLOCK_GRAPHICS,
  SORCERER_LINE_GRAPHICS,
  SORCERER_RULE_GRAPHICS,
} from './graphics';

/**
 * The Exidy Sorcerer's keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the bottom letter
 * row flanked by SHIFT and the machine's own cursor-left key, and a bottom row
 * of CTRL, GRAPHIC, space, quote and RETURN.
 *
 * The machine's own bands are the template's, which is why the symbol keys are
 * the only thing that has to move. The real board's rows are
 * `1234567890:-^`, `QWERTYUIOP[]`, `ASDFGHJKL;@\_` and `ZXCVBNM,./`, with the
 * keypad to their right; the punctuation keys at the end of each row live in
 * the SYM mode here, at the template's canonical positions, each cell pressing
 * the Sorcerer's own key or SHIFT pair. Those pairs are the ASCII typewriter
 * ones, read off the booted Monitor rather than off a photograph:
 * `1!` `2"` `3#` `4$` `5%` `6&` `7'` `8(` `9)` `0 0` `:*` `-=` `^~` `@\`` `` [{ ``
 * `]}` `;+` `\|` `,<` `.>` `/?`, and SHIFT+`_` is `_` again. SHIFT+0 is `0`:
 * this keyboard has no zero-shifted symbol at all.
 *
 * Three of the machine's habits shape what is here:
 *
 *  - **Lower case is the unshifted alphabet.** The Sorcerer had lower case as
 *    standard in 1978, so the base legends are the small letters and SHIFT is
 *    the capital - while the interpreter's reserved words are upper case only,
 *    which is why `run` is a syntax error and locking the shift key is how a
 *    line of BASIC gets typed. The machine's own SHIFT LOCK is a mechanically
 *    latching key rather than a keypress the ROM reads, and the host's CAPS
 *    LOCK reaches it.
 *  - **There is no destructive delete anywhere on the board.** BASIC reads a
 *    line back off the screen when RETURN is pressed, so taking a character
 *    back means moving the cursor over it and typing something else. The
 *    delete flank is that gesture: the editor backspaces, and the machine gets
 *    its own cursor-left.
 *  - **The graphics are on the front faces of the keycaps**, reached with
 *    GRAPHIC and a key; SHIFT + GRAPHIC types the user-definable band above
 *    them, which has no shape until a program pokes one in. GRAPHIC is a
 *    modifier here for that reason, and the GRAPHICS mode shows the palette in
 *    `./graphics.ts` - the same table, so a cell and a keycap cannot disagree.
 *
 * Key tokens are exactly the matrix tokens the emulator's `setKey` decodes
 * (`src/emulator/sorcerer/keyboard.ts`), so the virtual keyboard and the
 * physical `keyEvent` map share one vocabulary.
 */

/** A key: base legend, its SHIFT capital, and the CURSOR arrow four keys carry. */
const key = (
  token: string,
  main: string,
  shift: Legend = null,
  cursor: Legend = null,
): KeyDef => kitKey(token, [main, shift, cursor]);

/** A letter key: the small letter, its capital, and an optional arrow. */
const letter = (ch: string, cursor: Legend = null): KeyDef =>
  key(`Key${ch}`, ch.toLowerCase(), ch, cursor);

const numberRow = [...'1234567890'].map((d) => key(`Digit${d}`, d));

/**
 * The cursor diamond, which is the Monitor's rather than a convention borrowed
 * from elsewhere: CTRL + W, A, S and Z move the cursor up, left, right and
 * down, and CTRL + Q takes it home. Nothing else on this keyboard moves it -
 * the numeric keypad's 4 and 8 type `4` and `8`.
 */
const qwertyRow = [
  letter('Q'),
  letter('W', cursorKey('↑', 'up', ['Control', 'KeyW'])),
  letter('E'),
  letter('R'),
  letter('T'),
  letter('Y'),
  letter('U'),
  letter('I'),
  letter('O'),
  letter('P'),
];

const homeRow = centerRow([
  letter('A', cursorKey('←', 'left', ['Control', 'KeyA'])),
  letter('S', cursorKey('→', 'right', ['Control', 'KeyS'])),
  letter('D'),
  letter('F'),
  letter('G'),
  letter('H'),
  letter('J'),
  letter('K'),
  letter('L'),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: FLANK_SPAN,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

/**
 * The delete flank: the editor's backspace, and on the machine the cursor-left
 * the Monitor answers CTRL+A with.
 *
 * The two are not the same gesture and the machine is the reason. No Sorcerer
 * key erases a character: the Monitor's cursor moves over what is on the screen
 * and BASIC reads the line back from there when RETURN is pressed, so typing
 * over the character - or a space - is how the machine takes one back. The
 * keycap is that move, and in the editor, where there is a line buffer rather
 * than a screen, it is the backspace that means the same thing.
 */
const deleteKey: KeyDef = {
  ...kitKey('Backspace', [act('⌫', 'backspace'), null, null], {
    emits: ['Control', 'KeyA'],
  }),
  spanX: FLANK_SPAN,
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    letter('Z', cursorKey('↓', 'down', ['Control', 'KeyZ'])),
    letter('X'),
    letter('C'),
    letter('V'),
    letter('B'),
    letter('N'),
    letter('M'),
  ],
  deleteKey,
);

/** CTRL, which is what the cursor moves and the interpreter's break are on. */
const controlKey: KeyDef = {
  id: 'Control',
  spanX: KEY_SPAN,
  emits: ['Control'],
  // `ctrl`, the id every other machine with this key uses: the shared key
  // vocabulary offers a modifier under its own id, so `control` here would
  // answer to CONTROL where the rest of the machines answer to CTRL.
  modifier: 'ctrl',
  labels: [{ text: 'CTRL', editor: null }, null, null],
};

/** GRAPHIC: held with a key, it types that key's front-face graphic. */
const graphicKey: KeyDef = {
  id: 'Graphic',
  spanX: FLANK_SPAN,
  emits: ['Graphic'],
  modifier: 'graphic',
  labels: [{ text: 'GRA', editor: null }, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

/** `"` is SHIFT+2 on this keyboard, as on every ASCII typewriter board. */
const quoteKey = kitKey('Quote', ['"', null, null], {
  emits: ['Shift', 'Digit2'],
});

const returnKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], {
  spanX: FLANK_SPAN,
});

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([controlKey, graphicKey], spaceKey, [quoteKey, returnKey]),
];

/**
 * How the Sorcerer reaches each canonical SYM symbol: its own punctuation keys
 * and the ASCII shift pairs above. `£` is the one page-1 symbol this machine
 * has no key and no character for, so that cell is blank here; everything on
 * page 2 it has.
 */
const SORCERER_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '?': { emits: ['Shift', 'Slash'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['BracketLeft'] },
  ']': { emits: ['BracketRight'] },
  '@': { emits: ['At'] },
  '#': { emits: ['Shift', 'Digit3'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['Caret'] },
  '&': { emits: ['Shift', 'Digit6'] },
  '*': { emits: ['Shift', 'Colon'] },
  '(': { emits: ['Shift', 'Digit8'] },
  ')': { emits: ['Shift', 'Digit9'] },
  '-': { emits: ['Minus'] },
  "'": { emits: ['Shift', 'Digit7'] },
  '"': { emits: ['Shift', 'Digit2'] },
  ':': { emits: ['Colon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '`': { emits: ['Shift', 'At'] },
  '~': { emits: ['Shift', 'Caret'] },
  '\\': { emits: ['Backslash'] },
  '|': { emits: ['Shift', 'Backslash'] },
  '{': { emits: ['Shift', 'BracketLeft'] },
  '}': { emits: ['Shift', 'BracketRight'] },
  _: { emits: ['Underscore'] },
};

export const sorcererKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    theme: 'vk-theme-sorcerer',
    gridColumns: GRID_COLUMNS,
    // Lower case at power-on, which is why the base legends are small letters.
    powerOnCase: 'lower',
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
        position: 'tl',
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
      // GRAPHICS shows the palette rather than pinning a layer: the machine
      // prints its graphics on the front faces of the keycaps, which is a
      // marking the template has no slot for, and the palette says which key
      // each one is on instead.
      { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      // No `caseLock`: the machine's SHIFT LOCK is a mechanically latching key
      // the ROM reads as a held cell rather than a keypress it latches itself,
      // so locking the shift key here holds SHIFT down, which is the same
      // thing on this machine. The host's CAPS LOCK reaches the real key.
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
      { id: 'ctrl', emits: ['Control'], sticky: true, lockable: false },
      { id: 'graphic', emits: ['Graphic'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [
        { title: 'Lines and junctions', entries: SORCERER_LINE_GRAPHICS },
        {
          title: 'One-dot rules',
          note: 'A single lit row or column, at each position across the cell.',
          entries: SORCERER_RULE_GRAPHICS,
        },
        {
          title: 'Blocks, shades and shapes',
          entries: SORCERER_BLOCK_GRAPHICS,
        },
      ],
    },
    glyphs: {},
    // The Monitor walks the matrix a line at a time from its command loop, so a
    // key pressed and released between two walks is never seen at all.
    options: { minHoldFrames: 3 },
    // The machine's own four movement keys, which are the Monitor's cursor
    // diamond: W up, A left, S right, Z down. The bundled samples read exactly
    // these, so the on-screen pad drives them.
    controller: {
      bindings: {
        up: 'KeyW',
        down: 'KeyZ',
        left: 'KeyA',
        right: 'KeyS',
        fire1: 'Space',
        fire2: 'Enter',
      },
    },
  },
  SORCERER_SYMBOLS,
);
