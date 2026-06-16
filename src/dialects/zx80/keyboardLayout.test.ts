import { describe, it, expect } from 'vitest';
import { zx80KeyboardLayout } from './keyboardLayout';
import { zx80Charset } from './charset';
import { resolveEditorAction } from '../../keyboard/editorActions';

const layout = zx80KeyboardLayout;
const allKeys = layout.rows.flat();

/** Every layer a key press can resolve against in the editor: each mode's
    layer, plus the shift layer (reachable via the modifier in ABC mode). */
const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'shift',
];

describe('zx80 keyboard layout structure', () => {
  it('every key has a label tuple aligned with layers', () => {
    const layerCount = layout.layers.length;
    for (const key of allKeys) {
      expect(key.labels, key.id).toHaveLength(layerCount);
    }
  });

  it('every modifier referenced by a key exists in layout.modifiers', () => {
    const ids = new Set(layout.modifiers.map((m) => m.id));
    for (const key of allKeys) {
      if (key.modifier) expect(ids, key.id).toContain(key.modifier);
    }
  });

  it('every glyph referenced in labels is registered', () => {
    for (const key of allKeys) {
      for (const label of key.labels) {
        if (label?.glyph) expect(layout.glyphs).toHaveProperty(label.glyph);
      }
    }
  });
});

describe('zx80 keyboard layout editor mapping', () => {
  it('every insert in every mode is valid ZX80 charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => zx80Charset.toMachine(action.insert),
            `${key.id} on layer ${layerId}: ${JSON.stringify(action.insert)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('keyword inserts end in a space', () => {
    const layerIdx = layout.layers.findIndex((l) => l.id === 'keyword');
    for (const key of allKeys) {
      if (!key.labels[layerIdx]) continue; // falls back to main — not a word
      const action = resolveEditorAction(layout, key, 'keyword');
      expect(action, `${key.id} on keyword layer`).not.toBeNull();
      if (action && 'insert' in action) {
        expect(action.insert.endsWith(' '), key.id).toBe(true);
      }
    }
  });

  it('every graphics-layer glyph has an explicit insert', () => {
    const graphicIdx = layout.layers.findIndex((l) => l.id === 'graphic');
    for (const key of allKeys) {
      const label = key.labels[graphicIdx];
      if (!label?.glyph) continue;
      const action = resolveEditorAction(layout, key, 'graphic');
      expect(action, key.id).not.toBeNull();
      expect(action && 'insert' in action, key.id).toBe(true);
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyO')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'graphic')).toEqual(
      { insert: '▘' },
    );
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'graphic')).toEqual({
      insert: '▒',
    });
    expect(resolveEditorAction(layout, byId.get('Digit2')!, 'shift')).toEqual({
      insert: 'AND ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'shift')).toEqual({
      insert: 'NOT ',
    });
    // '−' on the key legend is U+2212 — the editor must get an ASCII hyphen.
    expect(resolveEditorAction(layout, byId.get('KeyJ')!, 'shift')).toEqual({
      insert: '-',
    });
    expect(resolveEditorAction(layout, byId.get('KeyC')!, 'shift')).toEqual({
      insert: '?',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'shift')).toEqual({
      insert: '£',
    });
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'main')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'main')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit0')!, 'shift')).toEqual({
      action: 'backspace',
    });
    expect(resolveEditorAction(layout, byId.get('Digit5')!, 'shift')).toEqual({
      action: 'left',
    });
    // HOME is machine-only — it does nothing in the editor.
    expect(
      resolveEditorAction(layout, byId.get('Digit9')!, 'shift'),
    ).toBeNull();
    // Digits keep working in keyword mode via the base-layer fallback.
    expect(resolveEditorAction(layout, byId.get('Digit3')!, 'keyword')).toEqual(
      { insert: '3' },
    );
  });

  it('grey-block escapes round-trip through the charset', () => {
    const greys = ['\\||', "\\!'", '\\!.', "\\|'", '\\|.'];
    for (const esc of greys) {
      const codes = zx80Charset.toMachine(esc);
      expect(codes.length, esc).toBe(1);
      expect(zx80Charset.toUnicode(codes), esc).toBe(esc);
    }
  });
});
