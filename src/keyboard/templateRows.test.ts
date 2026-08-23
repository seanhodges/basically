import { describe, it, expect } from 'vitest';
import type { KeyDef, KeyboardLayout } from './layoutSchema';
import {
  FLANK_SPAN,
  KEY_SPAN,
  SYMBOL_LAYER_1,
  SYMBOL_LAYER_2,
  SYMBOL_MODE_ID,
  SYMBOL_PAGE_1,
  SYMBOL_PAGE_2,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from './templateRows';

const key = (token: string, label: string): KeyDef => ({
  id: token,
  spanX: KEY_SPAN,
  emits: [token],
  labels: [{ text: label }],
});

const letters = (chars: string): KeyDef[] =>
  [...chars].map((c) => key(`Key${c}`, c));

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: FLANK_SPAN,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }],
};

const delKey: KeyDef = {
  id: 'Backspace',
  spanX: FLANK_SPAN,
  emits: ['Backspace'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }],
};

describe('flankedRow', () => {
  it('imposes the 6/4×7/6 spans whatever the inputs carried', () => {
    const row = flankedRow(
      { ...shiftKey, spanX: 4 },
      letters('ZXCVBNM').map((k) => ({ ...k, spanX: 5 })),
      { ...delKey, spanX: 4 },
    );
    expect(row.map((k) => k.spanX)).toEqual([6, 4, 4, 4, 4, 4, 4, 4, 6]);
    expect(row.reduce((n, k) => n + k.spanX, 0)).toBe(40);
  });

  it('rejects a row that is not seven letters', () => {
    expect(() => flankedRow(shiftKey, letters('ZXCVBN'), delKey)).toThrow(
      /7 letters/,
    );
  });
});

describe('the canonical SYM pages', () => {
  it('fit the letter bands', () => {
    for (const page of [SYMBOL_PAGE_1, SYMBOL_PAGE_2]) {
      expect(page.map((r) => r.length)).toEqual([10, 9, 7]);
    }
  });

  it('never place one symbol twice', () => {
    const symbols = [...SYMBOL_PAGE_1, ...SYMBOL_PAGE_2]
      .flat()
      .filter((s) => s !== null);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});

/** A minimal but complete standard layout for welding tests. */
function testLayout(): KeyboardLayout {
  return {
    id: 'test',
    name: 'Test',
    theme: 'vk-theme-test',
    gridColumns: 40,
    layers: [
      {
        id: 'base',
        position: 'center',
        activeWhen: [],
        editorInsertStyle: 'char',
      },
    ],
    editorModes: [{ id: 'abc', name: 'ABC', layer: 'base' }],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows: [
      [...letters('1234567890')],
      [...letters('QWERTYUIOP')],
      centerRow(letters('ASDFGHJKL')),
      flankedRow(shiftKey, letters('ZXCVBNM'), delKey),
      bottomRow(
        [],
        { id: 'Space', emits: ['Space'], labels: [{ text: '␣' }] },
        [key('Quote', '"'), key('Enter', '↵')],
      ),
    ],
    glyphs: {},
  };
}

describe('withSymbolMode', () => {
  const table = {
    '+': { emits: ['Shift', 'KeySemicolon'] },
    ',': { emits: ['Comma'] },
    '^': { emits: ['Shift', 'KeyH'], insert: '↑', text: '↑' },
    '£': { emits: ['Shift', 'KeyX'] },
  };
  const layout = withSymbolMode(testLayout(), table);
  const layerIdx = (id: string) => layout.layers.findIndex((l) => l.id === id);
  const findKey = (id: string) => layout.rows.flat().find((k) => k.id === id)!;

  it('appends modeOnly layers and slots the mode after the first tab', () => {
    expect(layout.layers.map((l) => l.id)).toEqual([
      'base',
      SYMBOL_LAYER_1,
      SYMBOL_LAYER_2,
    ]);
    expect(layout.layers.slice(1).every((l) => l.modeOnly)).toBe(true);
    expect(layout.editorModes!.map((m) => m.id)).toEqual(['abc', 'sym']);
    expect(layout.editorModes![1]).toMatchObject({
      id: SYMBOL_MODE_ID,
      layer: SYMBOL_LAYER_1,
      shiftedLayer: SYMBOL_LAYER_2,
    });
  });

  it('welds a mapped symbol at its canonical position with its own combo', () => {
    // '+' is page 1, Q-row slot 0 → KeyQ; ',' is the flanked row's 6th letter → KeyN.
    expect(findKey('KeyQ').labels[layerIdx(SYMBOL_LAYER_1)]).toEqual({
      text: '+',
      editor: { insert: '+' },
      emits: ['Shift', 'KeySemicolon'],
    });
    expect(findKey('KeyN').labels[layerIdx(SYMBOL_LAYER_1)]).toEqual({
      text: ',',
      editor: { insert: ',' },
      emits: ['Comma'],
    });
  });

  it('shows the machine’s own character in a canonical slot', () => {
    // '^' is page 1, home-row slot 4 → KeyG on this board.
    expect(findKey('KeyG').labels[layerIdx(SYMBOL_LAYER_1)]).toEqual({
      text: '↑',
      editor: { insert: '↑' },
      emits: ['Shift', 'KeyH'],
    });
  });

  it('blanks unmapped and unassigned slots so they press nothing', () => {
    // '=' and '!' are unmapped by this machine.
    for (const id of ['KeyR', 'KeyW']) {
      expect(findKey(id).labels[layerIdx(SYMBOL_LAYER_1)]).toEqual({
        editor: null,
        emits: [],
      });
    }
    // Page 2's KeyI slot is assigned to nobody; it blanks the same way.
    expect(findKey('KeyI').labels[layerIdx(SYMBOL_LAYER_2)]).toEqual({
      editor: null,
      emits: [],
    });
  });

  it('leaves the delete flank, bottom row, and number row alone', () => {
    for (const id of ['Backspace', 'Space', 'Quote', 'Enter', 'Key1']) {
      const labels = findKey(id).labels;
      expect(labels[layerIdx(SYMBOL_LAYER_1)] ?? null).toBeNull();
    }
  });

  it('turns the shift flank into the page toggle', () => {
    const labels = findKey('Shift').labels;
    expect(labels[layerIdx(SYMBOL_LAYER_1)]).toEqual({
      text: '1/2',
      editor: null,
    });
    expect(labels[layerIdx(SYMBOL_LAYER_2)]).toEqual({
      text: '2/2',
      editor: null,
    });
  });

  it('omits page 2, its toggle, and the mode flip when nothing is mapped there', () => {
    const single = withSymbolMode(testLayout(), { ',': { emits: ['Comma'] } });
    expect(single.layers.map((l) => l.id)).toEqual(['base', SYMBOL_LAYER_1]);
    expect(single.editorModes![1]!.shiftedLayer).toBeUndefined();
    const shift = single.rows.flat().find((k) => k.id === 'Shift')!;
    expect(shift.labels[1]).toEqual({ editor: null, emits: [] });
  });

  it('rejects a symbol with no canonical position', () => {
    expect(() =>
      withSymbolMode(testLayout(), { '¶': { emits: ['KeyP'] } }),
    ).toThrow(/no canonical SYM position/);
  });

  it('blanks everything above the bottom row under a modeOnly overlay mode', () => {
    // A CURSOR-style overlay owns rows 0-3: a key it labels keeps the label,
    // every other key there - the number row and the flanks included - is
    // blanked inert, and only the bottom row is left alone.
    const base = testLayout();
    const cursorized: KeyboardLayout = {
      ...base,
      layers: [
        ...base.layers,
        { id: 'cursor', position: 'br', activeWhen: [], modeOnly: true },
      ],
      editorModes: [
        ...base.editorModes!,
        { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      ],
      rows: base.rows.map((row, i) =>
        i !== 1
          ? row
          : row.map((k) =>
              k.id !== 'KeyW'
                ? k
                : {
                    ...k,
                    labels: [
                      ...k.labels,
                      { text: '↑', editor: { action: 'up' }, emits: ['Up'] },
                    ],
                  },
            ),
      ),
    };
    const welded = withSymbolMode(cursorized, table);
    const idx = welded.layers.findIndex((l) => l.id === 'cursor');
    const at = (id: string) =>
      welded.rows.flat().find((k) => k.id === id)!.labels[idx];
    expect(at('KeyW')).toEqual({
      text: '↑',
      editor: { action: 'up' },
      emits: ['Up'],
    });
    for (const id of ['Key1', 'KeyQ', 'KeyA', 'KeyZ', 'Shift', 'Backspace']) {
      expect(at(id), id).toEqual({ editor: null, emits: [] });
    }
    for (const id of ['Space', 'Quote', 'Enter']) {
      expect(at(id) ?? null, id).toBeNull();
    }
  });
});
