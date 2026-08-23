import { describe, it, expect } from 'vitest';
import {
  isRepeatable,
  modePinnedLayerId,
  resolveEditorAction,
  resolveEmits,
} from './editorActions';
import type { KeyDef, KeyboardLayout } from './layoutSchema';

const layout: KeyboardLayout = {
  id: 'test',
  name: 'Test',
  theme: 'vk-theme-test',
  gridColumns: 4,
  layers: [
    {
      id: 'main',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shift',
      position: 'tr',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
    {
      id: 'keyword',
      position: 'bl',
      activeWhen: [],
      editorInsertStyle: 'word',
    },
    { id: 'graphic', position: 'br', activeWhen: [] },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows: [[]],
  glyphs: {},
};

const keyP: KeyDef = {
  id: 'KeyP',
  spanX: 1,
  emits: ['KeyP'],
  labels: [
    { text: 'P' },
    { text: '"' },
    { text: 'PRINT' },
    { glyph: 'someGlyph', editor: { insert: '▘' } },
  ],
};

const period: KeyDef = {
  id: 'Period',
  spanX: 1,
  emits: ['Period'],
  labels: [{ text: '.' }, { text: ',' }, null, null],
};

const enter: KeyDef = {
  id: 'Enter',
  spanX: 1,
  emits: ['Enter'],
  labels: [
    { text: 'NEW LINE', editor: { action: 'newline' } },
    { text: 'FUNCTION', editor: null },
    null,
    null,
  ],
};

const glyphOnly: KeyDef = {
  id: 'KeyG',
  spanX: 1,
  emits: ['KeyG'],
  labels: [{ text: 'G' }, null, null, { glyph: 'unmapped' }],
};

/** A letter whose top layer legend presses a different key on the machine. */
const cursorW: KeyDef = {
  id: 'KeyW',
  spanX: 1,
  emits: ['KeyW'],
  labels: [
    { text: 'W' },
    null,
    null,
    { text: '↑', editor: { action: 'up' }, emits: ['ArrowUp'] },
  ],
};

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 1,
  emits: ['Shift'],
  modifier: 'shift',
  labels: [{ text: 'SHIFT' }, null, null, null],
};

describe('resolveEditorAction', () => {
  it('derives char inserts from the layer style', () => {
    expect(resolveEditorAction(layout, keyP, 'main')).toEqual({ insert: 'P' });
    expect(resolveEditorAction(layout, keyP, 'shift')).toEqual({ insert: '"' });
  });

  it('derives word inserts with a trailing space', () => {
    expect(resolveEditorAction(layout, keyP, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
  });

  it('uses explicit overrides, including forced no-ops', () => {
    expect(resolveEditorAction(layout, enter, 'main')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, enter, 'shift')).toBeNull();
    expect(resolveEditorAction(layout, keyP, 'graphic')).toEqual({
      insert: '▘',
    });
  });

  it('requires explicit data for glyph labels (no derived default)', () => {
    expect(resolveEditorAction(layout, glyphOnly, 'graphic')).toEqual({
      insert: 'G', // falls through to the base layer
    });
  });

  it('falls back to the base layer when a mode layer has no label', () => {
    expect(resolveEditorAction(layout, period, 'keyword')).toEqual({
      insert: '.',
    });
    expect(resolveEditorAction(layout, enter, 'keyword')).toEqual({
      action: 'newline',
    });
  });

  it('never produces actions for modifier keys', () => {
    expect(resolveEditorAction(layout, shiftKey, 'main')).toBeNull();
    expect(resolveEditorAction(layout, shiftKey, 'keyword')).toBeNull();
  });

  it('falls back to the base layer for unknown layers', () => {
    expect(resolveEditorAction(layout, keyP, 'nope')).toEqual({ insert: 'P' });
  });
});

describe('isRepeatable', () => {
  it('repeats editing motions but not inserts or newline', () => {
    expect(isRepeatable({ action: 'backspace' })).toBe(true);
    expect(isRepeatable({ action: 'delete' })).toBe(true);
    expect(isRepeatable({ action: 'left' })).toBe(true);
    expect(isRepeatable({ action: 'newline' })).toBe(false);
    expect(isRepeatable({ insert: 'A' })).toBe(false);
  });
});

describe('resolveEmits', () => {
  it("takes the layer legend's tokens when it names any", () => {
    expect(resolveEmits(layout, cursorW, 'graphic')).toEqual(['ArrowUp']);
  });

  it("falls back to the key's own tokens on every other layer", () => {
    expect(resolveEmits(layout, cursorW, 'main')).toEqual(['KeyW']);
    expect(resolveEmits(layout, cursorW, 'shift')).toEqual(['KeyW']);
    // A legend with no tokens of its own does not clear the key's.
    expect(resolveEmits(layout, keyP, 'graphic')).toEqual(['KeyP']);
  });

  it('falls back for an unknown layer rather than emitting nothing', () => {
    expect(resolveEmits(layout, cursorW, 'nope')).toEqual(['KeyW']);
  });
});

describe('modePinnedLayerId', () => {
  const withSym: KeyboardLayout = {
    ...layout,
    layers: [
      ...layout.layers,
      { id: 'symbols', position: 'center', activeWhen: [], modeOnly: true },
      { id: 'symbols2', position: 'center', activeWhen: [], modeOnly: true },
    ],
  };
  const base = withSym.layers[0]!;
  const shifted = withSym.layers[1]!;
  const symMode = {
    id: 'sym',
    name: 'SYM',
    layer: 'symbols',
    shiftedLayer: 'symbols2',
  };
  const graphicMode = {
    id: 'g',
    name: 'G',
    layer: 'graphic',
    shiftedLayer: 'keyword',
  };

  it('pins nothing for the base mode or no mode', () => {
    expect(
      modePinnedLayerId(
        withSym,
        { id: 'abc', name: 'ABC', layer: 'main' },
        'main',
        base,
        false,
      ),
    ).toBeNull();
    expect(modePinnedLayerId(withSym, null, 'main', base, false)).toBeNull();
  });

  it('flips a modeOnly mode by its page toggle, ignoring real shift', () => {
    expect(modePinnedLayerId(withSym, symMode, 'main', base, false)).toBe(
      'symbols',
    );
    expect(modePinnedLayerId(withSym, symMode, 'main', shifted, false)).toBe(
      'symbols',
    );
    expect(modePinnedLayerId(withSym, symMode, 'main', base, true)).toBe(
      'symbols2',
    );
  });

  it('flips any other two-page mode by the engaged SHIFT modifier', () => {
    expect(modePinnedLayerId(withSym, graphicMode, 'main', base, true)).toBe(
      'graphic',
    );
    expect(
      modePinnedLayerId(withSym, graphicMode, 'main', shifted, false),
    ).toBe('keyword');
  });
});
