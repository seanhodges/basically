import type {
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow } from '../../keyboard/templateRows';
import { C64_COMMODORE_GRAPHICS, C64_SHIFT_GRAPHICS } from './graphics';

/**
 * The Commodore 64 keyboard on the standard virtual-keyboard template.
 *
 * Two top-strip modes let a single key carry an operator *and* its two block
 * graphics without clashing (the real machine prints both graphics on the key's
 * front face):
 *  - **ABC** — letters/digits; SHIFT gives the shifted symbols and the editor
 *    operators (`+ - * / = : ; @ £`, `! " # …`) that ride the SHIFT layer.
 *  - **GRAPHICS** — the C= block graphics unmodified, the SHIFT block graphics
 *    with SHIFT held (`shiftedLayer`).
 *
 * The four physical function keys yield eight values (f2/f4/f6/f8 are SHIFT of
 * the odd keys); all eight are shown as separate keys in the top strip, behind
 * the strip's mode/function toggle. RUN/STOP, RESTORE and the cursor keys are
 * dropped. Each key `emits` a VIC-II button name (see c64Machine.ts).
 */

const cmdGfx = new Map(C64_COMMODORE_GRAPHICS.map((g) => [g.key, g.char]));
const shiftGfx = new Map(C64_SHIFT_GRAPHICS.map((g) => [g.key, g.char]));

/** A block-graphic legend that inserts its own character, or null if none. */
const gfxLabel = (char: string | undefined): KeyLabel | null =>
  char === undefined ? null : { text: char, editor: { insert: char } };

/**
 * A key: base label, optional shifted label, the two block graphics looked up by
 * id, one matrix token. Label tuple order matches `layers` below:
 * [base, shift, gfxCommodore, gfxShift].
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
    gfxLabel(cmdGfx.get(id)),
    gfxLabel(shiftGfx.get(id)),
  ];
  return { id, spanX, emits: [emit], labels };
}

const letter = (l: string, shift?: string): KeyDef => key(l, l, l, shift);

/** A bottom-row / strip key with only a main label (no shift, no graphics). */
const plainLabels = (main: KeyLabel): (KeyLabel | null)[] => [
  main,
  null,
  null,
  null,
];

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
  key('Comma', 'Comma', ',', '<'),
  key('Period', 'Period', '.', '>'),
  key('Slash', 'Slash', '/', '?'),
];

const shiftKey: KeyDef = {
  id: 'LeftShift',
  spanX: 6,
  emits: ['LeftShift'],
  modifier: 'shift',
  style: 'shift',
  labels: plainLabels({ text: '⇧' }),
};

const commodoreKey: KeyDef = {
  id: 'Commodore',
  spanX: 5,
  emits: ['Commodore'],
  modifier: 'commodore',
  labels: plainLabels({ text: 'C=', editor: null }),
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: plainLabels({ text: 'SPACE', editor: { insert: ' ' } }),
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['LeftShift', 'Num2'],
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
  bottomRow([shiftKey, commodoreKey], spaceKey, [quoteKey, backspaceKey]),
];

// f1/f3/f5/f7 have their own matrix lines; f2/f4/f6/f8 are SHIFT of the odd keys.
const fnKey = (label: string, emits: string[]): KeyDef => ({
  id: `F${label.slice(1)}`,
  spanX: 4,
  emits,
  style: 'fn',
  labels: plainLabels({ text: label, editor: null }),
});

const functionKeys: KeyDef[] = [
  fnKey('f1', ['F1']),
  fnKey('f2', ['LeftShift', 'F1']),
  fnKey('f3', ['F3']),
  fnKey('f4', ['LeftShift', 'F3']),
  fnKey('f5', ['F5']),
  fnKey('f6', ['LeftShift', 'F5']),
  fnKey('f7', ['F7']),
  fnKey('f8', ['LeftShift', 'F7']),
];

export const c64KeyboardLayout: KeyboardLayout = {
  id: 'commodore64',
  name: 'Commodore 64',
  theme: 'vk-theme-commodore64',
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
    // The two graphic sets are pinned by the GRAPHICS mode (not a modifier), so
    // they stay always-rendered (activeWhen []) and carry their own inserts.
    { id: 'gfxCommodore', name: 'GRAPHICS', position: 'bl', activeWhen: [] },
    { id: 'gfxShift', name: 'GRAPHICS ⇧', position: 'br', activeWhen: [] },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'base' },
    {
      id: 'graphics',
      name: 'GRAPHICS',
      layer: 'gfxCommodore',
      shiftedLayer: 'gfxShift',
    },
  ],
  modifiers: [
    { id: 'shift', emits: ['LeftShift'], sticky: true, lockable: true },
    { id: 'commodore', emits: ['Commodore'], sticky: true, lockable: true },
  ],
  rows,
  functionKeys,
  glyphs: {},
  // WASD movement + Space fire (the convention the bundled C64 games use).
  controller: {
    fireButtons: 1,
    dpadMode: '4-way',
    bindings: {
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      fire1: 'Space',
    },
  },
};
