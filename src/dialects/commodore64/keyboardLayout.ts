import type {
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow } from '../../keyboard/templateRows';

/**
 * The Commodore 64 keyboard on the standard virtual-keyboard template.
 *
 * The C64 has no extra text-entry modes, so the top strip carries its function
 * keys (f1/f3/f5/f7). It has more symbol keys than a uniform ten-key grid holds,
 * so — trading authenticity for a clean, thumb-sized layout — the operators
 * (`+ - * / = : ; @ £`) ride the SHIFT layer as editor inserts alongside the
 * authentic shifted-digit symbols. RUN/STOP, RESTORE, CTRL and the cursor keys
 * are dropped. Each key `emits` a VIC-II button name (see c64Machine.ts).
 */

/** A key: base label, optional shifted label, one matrix token. */
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
    labels: [{ text: '↵', editor: { action: 'newline' } }, null],
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
  labels: [{ text: '⇧' }, null],
};

const commodoreKey: KeyDef = {
  id: 'Commodore',
  spanX: 5,
  emits: ['Commodore'],
  modifier: 'commodore',
  labels: [{ text: 'C=', editor: null }, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: 'SPACE', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['LeftShift', 'Num2'],
  labels: [{ text: '"' }, null],
};

const backspaceKey: KeyDef = {
  id: 'InstDel',
  spanX: 4,
  emits: ['InstDel'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null],
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey, commodoreKey], spaceKey, [quoteKey, backspaceKey]),
];

const functionKeys: KeyDef[] = [
  key('F1', 'F1', 'f1'),
  key('F3', 'F3', 'f3'),
  key('F5', 'F5', 'f5'),
  key('F7', 'F7', 'f7'),
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
  ],
  modifiers: [
    { id: 'shift', emits: ['LeftShift'], sticky: true, lockable: true },
    { id: 'commodore', emits: ['Commodore'], sticky: true, lockable: true },
  ],
  rows,
  functionKeys,
  glyphs: {},
};
