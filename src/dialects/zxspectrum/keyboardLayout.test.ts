import { describe, it, expect } from 'vitest';
import { spectrumKeyboardLayout } from './keyboardLayout';
import { spectrumCharset } from './charset';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';

const layout = spectrumKeyboardLayout;
const allKeys = layout.rows.flat();

const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'caps',
];

describe('zxspectrum keyboard layout', () => {
  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      if (key.style === 'spacer') continue; // inert filler, no labels
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('every insert in every reachable mode is valid Spectrum charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => spectrumCharset.toMachine(action.insert),
            `${key.id} on layer ${layerId}: ${JSON.stringify(action.insert)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('keyword and function inserts end in a space', () => {
    for (const key of allKeys) {
      for (const layerId of ['keyword', 'function']) {
        const layerIdx = layout.layers.findIndex((l) => l.id === layerId);
        if (!key.labels[layerIdx]) continue;
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(action.insert.endsWith(' '), `${key.id}/${layerId}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const key of allKeys) {
      if (key.modifier) expect(modIds.has(key.modifier), key.id).toBe(true);
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    expect(resolveEditorAction(layout, byId.get('KeyG')!, 'keyword')).toEqual({
      insert: 'GO TO ',
    });
    // '"' is the SYM cell on the C slot, pressing SymShift+P for the machine.
    expect(resolveEditorAction(layout, byId.get('KeyC')!, 'symbols')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('KeyQ')!, 'function')).toEqual({
      insert: 'SIN ',
    });
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'main')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'main')).toEqual({
      insert: ' ',
    });
    // The common bottom row carries a single quote and backspace key.
    expect(resolveEditorAction(layout, byId.get('Quote')!, 'main')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('Backspace')!, 'main')).toEqual(
      { action: 'backspace' },
    );
    // Digits keep working in keyword mode via the base-layer fallback.
    expect(resolveEditorAction(layout, byId.get('Digit3')!, 'keyword')).toEqual(
      {
        insert: '3',
      },
    );
  });

  it('puts the cursor arrows on 5/6/7/8, where the machine prints them', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    const arrows: [string, 'left' | 'down' | 'up' | 'right'][] = [
      ['Digit5', 'left'],
      ['Digit6', 'down'],
      ['Digit7', 'up'],
      ['Digit8', 'right'],
    ];
    for (const [id, action] of arrows) {
      const key = byId.get(id)!;
      // The arrow the machine prints on the CAPS layer and the CURSOR
      // overlay are the same key, and both move the caret.
      expect(resolveEditorAction(layout, key, 'caps'), id).toEqual({
        action,
      });
      expect(resolveEditorAction(layout, key, 'cursor'), id).toEqual({
        action,
      });
      // On the machine the CURSOR legend presses the pair the real keyboard
      // sends, not the digit on its own.
      expect(resolveEmits(layout, key, 'cursor'), id).toEqual([
        'CapsShift',
        id,
      ]);
    }
    // The letter keys carry no arrow, so CURSOR mode blanks them: inert,
    // like an unmapped SYM cell, rather than typing their letters.
    for (const id of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      expect(
        resolveEditorAction(layout, byId.get(id)!, 'cursor'),
        id,
      ).toBeNull();
      expect(resolveEmits(layout, byId.get(id)!, 'cursor'), id).toEqual([]);
    }
  });
});
