import type {
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow } from '../../keyboard/templateRows';
import { C64_SHIFT_GRAPHICS } from '../commodore64/graphics';

/**
 * The Commodore PET graphics keyboard on the standard virtual-keyboard template.
 *
 * The PET graphics keyboard has a single block-graphics set - the one printed on
 * the *front* of every letter key and produced by holding SHIFT (there is no
 * Commodore key, so unlike the C64 there is no second, C=, set). It therefore
 * reuses the shared C64 SHIFT graphics (`../commodore64/graphics`,
 * `C64_SHIFT_GRAPHICS`) as the PET's shifted set.
 *
 * Two top-strip modes:
 *  - **ABC** - letters/digits; SHIFT surfaces the editor operators/punctuation
 *    (`+ - * / = : ; @ £`, `! " # $ % & ' ( )`, `< > ?`) that a BASIC program
 *    needs. As on the C64 layout these SHIFT legends are editor inserts: the
 *    live matrix still sees SHIFT+key (which on the real machine draws the
 *    block graphic), so they are typing conveniences, not hardware fidelity.
 *  - **GRAPHICS** - the block graphics as a palette rather than as key legends,
 *    each cell labelled with the SHIFT+key that draws it on the real machine.
 *
 * Every key `emits` a PET matrix token (see `../../emulator/pet/keyboard.ts`);
 * the punctuation keys use the PET's direct-key tokens (`,` `.` `/` `"`) rather
 * than shifted digits, since the graphics keyboard has dedicated keys for them.
 * RUN/STOP, the cursor keys and the numeric-pad duplicates are dropped from the
 * on-screen keyboard; the ten digit keys stand in for the pad.
 */

/**
 * A key: base label and optional shifted label. Label tuple order matches
 * `layers` below: [base, shift].
 */
function key(
  id: string,
  emit: string,
  base: string,
  shift?: string,
  spanX = 4,
): KeyDef {
  const labels: (KeyLabel | null)[] = [
    { text: base },
    shift ? { text: shift } : null,
  ];
  return { id, spanX, emits: [emit], labels };
}

const letter = (l: string, shift?: string): KeyDef => key(l, l, l, shift);

/** A bottom-row / strip key with only a main label (no shift). */
const plainLabels = (main: KeyLabel): (KeyLabel | null)[] => [main, null];

// Numeric row: the graphics keyboard's pad digits, with the PET's top-row
// punctuation offered as SHIFT editor inserts (! " # $ % & ' ( )).
const numberRow = [
  key('Num1', 'Num1', '1', '!'),
  key('Num2', 'Num2', '2', '"'),
  key('Num3', 'Num3', '3', '#'),
  key('Num4', 'Num4', '4', '$'),
  key('Num5', 'Num5', '5', '%'),
  key('Num6', 'Num6', '6', '&'),
  key('Num7', 'Num7', '7', "'"),
  key('Num8', 'Num8', '8', '('),
  key('Num9', 'Num9', '9', ')'),
  key('Num0', 'Num0', '0'),
];

const qwertyRow = [
  letter('Q'),
  letter('W'),
  letter('E'),
  letter('R'),
  letter('T'),
  letter('Y'),
  letter('U'),
  letter('I'),
  letter('O'),
  letter('P'),
];

// SHIFT legends on the home row expose the common operators as editor inserts.
const homeRow = [
  letter('A', '+'),
  letter('S', '-'),
  letter('D', '*'),
  letter('F', '/'),
  letter('G', '='),
  letter('H', ':'),
  letter('J', ';'),
  letter('K', '@'),
  letter('L', '£'),
  {
    id: 'Return',
    spanX: 4,
    emits: ['Return'],
    labels: plainLabels({ text: '↵', editor: { action: 'newline' } }),
  } satisfies KeyDef,
];

const zxcvRow = [
  letter('Z'),
  letter('X'),
  letter('C'),
  letter('V'),
  letter('B'),
  letter('N'),
  letter('M'),
  key('Comma', ',', ',', '<'),
  key('Period', '.', '.', '>'),
  key('Slash', '/', '/', '?'),
];

const shiftKey: KeyDef = {
  id: 'LeftShift',
  spanX: 6,
  emits: ['LeftShift'],
  modifier: 'shift',
  style: 'shift',
  labels: plainLabels({ text: '⇧' }),
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: plainLabels({ text: '␣', editor: { insert: ' ' } }),
} satisfies Omit<KeyDef, 'spanX'>;

// The PET graphics keyboard has a dedicated " key (matrix token '"').
const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['"'],
  labels: plainLabels({ text: '"' }),
};

const backspaceKey: KeyDef = {
  id: 'InstDel',
  spanX: 4,
  emits: ['InstDel'],
  labels: plainLabels({ text: '⌫', editor: { action: 'backspace' } }),
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey], spaceKey, [quoteKey, backspaceKey]),
];

export const petKeyboardLayout: KeyboardLayout = {
  id: 'pet',
  name: 'Commodore PET',
  theme: 'vk-theme-pet',
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
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'base' },
    // GRAPHICS shows the palette; it pins no layer, so SHIFT keeps its ordinary
    // meaning while the palette is open.
    { id: 'graphics', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
  ],
  modifiers: [
    { id: 'shift', emits: ['LeftShift'], sticky: true, lockable: true },
  ],
  rows,
  // One set only: the PET has no Commodore key, so the graphics printed on the
  // key fronts are reached with SHIFT.
  graphicsPalette: { sections: [{ entries: C64_SHIFT_GRAPHICS }] },
  glyphs: {},
  // WASD movement + Space/Return fire (the convention the bundled PET games use).
  controller: {
    bindings: {
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      fire1: 'Space',
      fire2: 'Return',
    },
  },
};
