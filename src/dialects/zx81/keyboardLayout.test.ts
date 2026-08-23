import { describe, it, expect } from 'vitest';
import { zx81KeyboardLayout } from './keyboardLayout';
import { zx81Charset } from './charset';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';
import { ZX81_GRAPHICS } from './graphics';

const layout = zx81KeyboardLayout;
const allKeys = layout.rows.flat();

/** Every layer a key press can resolve against in the editor: each mode's
    layer, plus the shift layer (reachable via the modifier in ABC mode). */
const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'shift',
];

describe('zx81 keyboard layout editor mapping', () => {
  it('every insert in every mode is valid ZX81 charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => zx81Charset.toMachine(action.insert),
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
        if (!key.labels[layerIdx]) continue; // falls back to main - not a word
        const action = resolveEditorAction(layout, key, layerId);
        expect(action, `${key.id} on layer ${layerId}`).not.toBeNull();
        if (action && 'insert' in action) {
          expect(action.insert.endsWith(' '), `${key.id}/${layerId}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    expect(resolveEditorAction(layout, byId.get('KeyQ')!, 'function')).toEqual({
      insert: 'SIN ',
    });
    // '-' is a SYM cell now (the Z slot), inserting the ASCII hyphen.
    expect(resolveEditorAction(layout, byId.get('KeyZ')!, 'symbols')).toEqual({
      insert: '-',
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
      const codes = zx81Charset.toMachine(esc);
      expect(codes.length, esc).toBe(1);
      const canonical = zx81Charset.toUnicode(codes);
      expect(canonical, esc).not.toBe(esc);
      expect([...zx81Charset.toMachine(canonical)], esc).toEqual([...codes]);
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

describe('zx81 graphics palette', () => {
  const entries = (layout.graphicsPalette?.sections ?? []).flatMap(
    (s) => s.entries,
  );

  it('is what the GRAPHICS mode shows, in place of a graphics key layer', () => {
    const mode = layout.editorModes!.find((m) => m.id === 'graphic')!;
    expect(mode.palette).toBe('graphics');
    expect(layout.graphicsPalette?.sections).toHaveLength(1);
    expect(entries).toEqual(ZX81_GRAPHICS);
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
      expect([...zx81Charset.toMachine(entry.char)], entry.key).toEqual([
        entry.code,
      ]);
    }
  });
});
