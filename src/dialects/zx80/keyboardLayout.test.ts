import { describe, it, expect } from 'vitest';
import { zx80KeyboardLayout } from './keyboardLayout';
import { zx80Charset } from './charset';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';
import { ZX80_GRAPHICS } from './graphics';

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
      if (key.style === 'spacer') continue; // inert filler, no labels
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
      if (!key.labels[layerIdx]) continue; // falls back to main - not a word
      const action = resolveEditorAction(layout, key, 'keyword');
      expect(action, `${key.id} on keyword layer`).not.toBeNull();
      if (action && 'insert' in action) {
        expect(action.insert.endsWith(' '), key.id).toBe(true);
      }
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyO')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit2')!, 'shift')).toEqual({
      insert: 'AND ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'shift')).toEqual({
      insert: 'NOT ',
    });
    // '−' on the key legend is U+2212 - the editor must get an ASCII hyphen.
    expect(resolveEditorAction(layout, byId.get('KeyJ')!, 'shift')).toEqual({
      insert: '-',
    });
    expect(resolveEditorAction(layout, byId.get('KeyC')!, 'shift')).toEqual({
      insert: '?',
    });
    expect(resolveEditorAction(layout, byId.get('KeyY')!, 'shift')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('KeyU')!, 'shift')).toEqual({
      insert: '$',
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
    // The common bottom row carries a single quote and backspace key.
    expect(resolveEditorAction(layout, byId.get('Quote')!, 'main')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('Backspace')!, 'main')).toEqual(
      { action: 'backspace' },
    );
    // Digits keep working in keyword mode via the base-layer fallback.
    expect(resolveEditorAction(layout, byId.get('Digit3')!, 'keyword')).toEqual(
      { insert: '3' },
    );
  });

  it('grey-block escapes still encode, and render as their unicode form', () => {
    // The chequered graphics now have Symbols for Legacy Computing characters,
    // so the canonical rendering is the character rather than the escape. The
    // escape spellings stay readable - a program saved before the change must
    // still load - and both forms must reach the same byte.
    const greys = ['\\||', "\\!'", '\\!.', "\\|'", '\\|.'];
    for (const esc of greys) {
      const codes = zx80Charset.toMachine(esc);
      expect(codes.length, esc).toBe(1);
      const canonical = zx80Charset.toUnicode(codes);
      expect(canonical, esc).not.toBe(esc);
      expect([...zx80Charset.toMachine(canonical)], esc).toEqual([...codes]);
    }
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
      // The arrow the machine prints on the SHIFT layer and the CURSOR
      // overlay are the same key, and both move the caret.
      expect(resolveEditorAction(layout, key, 'shift'), id).toEqual({
        action,
      });
      expect(resolveEditorAction(layout, key, 'cursor'), id).toEqual({
        action,
      });
      // On the machine the CURSOR legend presses the pair the real keyboard
      // sends, not the digit on its own.
      expect(resolveEmits(layout, key, 'cursor'), id).toEqual(['Shift', id]);
    }
    // The letter keys carry no arrow: in CURSOR mode they type themselves.
    for (const [id, ch] of [
      ['KeyW', 'W'],
      ['KeyA', 'A'],
      ['KeyS', 'S'],
      ['KeyD', 'D'],
    ]) {
      expect(resolveEditorAction(layout, byId.get(id)!, 'cursor'), id).toEqual({
        insert: ch,
      });
    }
  });
});

describe('zx80 graphics palette', () => {
  const entries = (layout.graphicsPalette?.sections ?? []).flatMap(
    (s) => s.entries,
  );

  it('is what the GRAPHICS mode shows, in place of a graphics key layer', () => {
    const mode = layout.editorModes!.find((m) => m.id === 'graphic')!;
    expect(mode.palette).toBe('graphics');
    expect(layout.graphicsPalette?.sections).toHaveLength(1);
    expect(entries).toEqual(ZX80_GRAPHICS);
  });

  it('has no graphics key layer or glyph legend left over', () => {
    expect(layout.layers.map((l) => l.id)).not.toContain('graphic');
    expect(layout.glyphs).toEqual({});
    for (const key of allKeys)
      for (const label of key.labels)
        expect(label?.glyph, key.id).toBeUndefined();
  });

  it('labels every entry with the key that types it', () => {
    for (const entry of entries) {
      expect(entry.key, `0x${entry.code.toString(16)}`).toBeTruthy();
      expect([...zx80Charset.toMachine(entry.char)], entry.key).toEqual([
        entry.code,
      ]);
    }
  });
});
