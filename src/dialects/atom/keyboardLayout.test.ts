import { describe, it, expect } from 'vitest';
import { atomKeyboardLayout } from './keyboardLayout';
import { atomCharset } from './charset';
import { matrixForToken } from '../../emulator/atom/keyboard';
import { resolveEditorAction } from '../../keyboard/editorActions';

const layout = atomKeyboardLayout;
const functionKeys = layout.functionKeys ?? [];
const allKeys = [...layout.rows.flat(), ...functionKeys];
/** Filler cells (spacers) emit nothing and carry no modifier. */
const realKeys = allKeys.filter((k) => k.emits.length > 0 || k.modifier);

/** Every layer a key press can resolve against in the editor. */
const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'shifted',
];

describe('atom keyboard layout', () => {
  it('uses the standard 40-column template', () => {
    expect(layout.gridColumns).toBe(40);
    expect(layout.rows).toHaveLength(5);
  });

  it('every row spans exactly the grid width', () => {
    layout.rows.forEach((row, i) => {
      const total = row.reduce((n, k) => n + k.spanX, 0);
      expect(total, `row ${i}`).toBe(layout.gridColumns);
    });
  });

  it('offers ABC and SYM modes and no function keys', () => {
    expect((layout.editorModes ?? []).map((m) => m.id)).toEqual(['abc', 'sym']);
    expect(functionKeys).toHaveLength(0);
  });

  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      if (key.style === 'spacer') continue; // inert filler, no labels
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('uses inert spacers (no emits, no modifier) for alignment', () => {
    for (const k of allKeys) {
      if (k.style === 'spacer') {
        expect(k.emits, k.id).toHaveLength(0);
        expect(k.modifier, k.id).toBeUndefined();
      }
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const key of realKeys) {
      if (key.modifier) expect(modIds.has(key.modifier), key.id).toBe(true);
    }
  });

  it('every emitted token maps to the Atom key matrix', () => {
    for (const key of realKeys) {
      for (const token of key.emits) {
        expect(matrixForToken(token), `${key.id} → ${token}`).toBeDefined();
      }
    }
  });

  it('every editor insert is valid Atom charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => atomCharset.toMachine(action.insert),
            `${key.id} on layer ${layerId}: ${JSON.stringify(action.insert)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('surfaces the punctuation overflow as SYM-mode editor inserts', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'sym')).toEqual({
      insert: '[',
    });
    expect(resolveEditorAction(layout, byId.get('Digit4')!, 'sym')).toEqual({
      insert: '@',
    });
    expect(resolveEditorAction(layout, byId.get('Digit5')!, 'sym')).toEqual({
      insert: '^',
    });
    // Digits with no SYM legend keep typing through the base-layer fallback.
    expect(resolveEditorAction(layout, byId.get('Digit0')!, 'sym')).toEqual({
      insert: '0',
    });
  });

  it('reaches the Atom BASIC essentials through SHIFT', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    // ! for byte work, " for strings, # for hex, $ for the string area.
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'shifted')).toEqual(
      { insert: '!' },
    );
    expect(resolveEditorAction(layout, byId.get('Digit2')!, 'shifted')).toEqual(
      { insert: '"' },
    );
    expect(resolveEditorAction(layout, byId.get('Digit3')!, 'shifted')).toEqual(
      { insert: '#' },
    );
    expect(resolveEditorAction(layout, byId.get('Digit4')!, 'shifted')).toEqual(
      { insert: '$' },
    );
    // ? indirection sits on SHIFT+/.
    expect(resolveEditorAction(layout, byId.get('Slash')!, 'shifted')).toEqual({
      insert: '?',
    });
  });

  it('spot checks the common bottom row', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'base')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'base')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Quote')!, 'base')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('Delete')!, 'base')).toEqual({
      action: 'backspace',
    });
  });
});
