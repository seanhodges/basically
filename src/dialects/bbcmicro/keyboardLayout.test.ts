import { describe, it, expect } from 'vitest';
import { bbcKeyboardLayout } from './keyboardLayout';
import { matrixForToken } from '../../emulator/bbc/keyboard';
import { resolveEditorAction } from '../../keyboard/editorActions';

const layout = bbcKeyboardLayout;
const functionKeys = layout.functionKeys ?? [];
const allKeys = [...layout.rows.flat(), ...functionKeys];
/** Filler cells (spacers) emit nothing and carry no modifier. */
const realKeys = allKeys.filter((k) => k.emits.length > 0 || k.modifier);

describe('bbcmicro keyboard layout', () => {
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

  it('offers ABC, SYM and CURSOR modes plus the f0–f9 function keys', () => {
    expect((layout.editorModes ?? []).map((m) => m.id)).toEqual([
      'abc',
      'sym',
      'cursor',
    ]);
    expect(functionKeys.map((k) => k.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `F${i}`),
    );
  });

  it('overlays the arrow caret moves on W/A/S/D in CURSOR mode', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyW')!, 'cursor')).toEqual({
      action: 'up',
    });
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'cursor')).toEqual({
      action: 'left',
    });
    expect(resolveEditorAction(layout, byId.get('KeyS')!, 'cursor')).toEqual({
      action: 'down',
    });
    expect(resolveEditorAction(layout, byId.get('KeyD')!, 'cursor')).toEqual({
      action: 'right',
    });
    // A letter outside the WASD cluster keeps typing itself in CURSOR mode.
    expect(resolveEditorAction(layout, byId.get('KeyF')!, 'cursor')).toEqual({
      insert: 'F',
    });
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

  it('every emitted token maps to the BBC matrix', () => {
    for (const key of realKeys) {
      for (const token of key.emits) {
        expect(matrixForToken(token), `${key.id} → ${token}`).toBeDefined();
      }
    }
  });

  it('surfaces the punctuation overflow as SYM-mode editor inserts', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'sym')).toEqual({
      insert: '-',
    });
    expect(resolveEditorAction(layout, byId.get('Digit3')!, 'sym')).toEqual({
      insert: '+',
    });
    expect(resolveEditorAction(layout, byId.get('KeyY')!, 'sym')).toEqual({
      insert: ':',
    });
    // Letters with no SYM legend keep typing through the base-layer fallback.
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'sym')).toEqual({
      insert: 'A',
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
