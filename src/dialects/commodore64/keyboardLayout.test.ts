import { describe, it, expect } from 'vitest';
import { c64KeyboardLayout } from './keyboardLayout';
import { resolveEditorAction } from '../../keyboard/editorActions';

const layout = c64KeyboardLayout;
const functionKeys = layout.functionKeys ?? [];
const allKeys = [...layout.rows.flat(), ...functionKeys];

describe('commodore64 keyboard layout', () => {
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

  it('offers ABC and GRAPHICS modes, the latter with a shifted layer', () => {
    expect(layout.editorModes?.map((m) => m.id)).toEqual(['abc', 'graphics']);
    const graphics = layout.editorModes?.find((m) => m.id === 'graphics');
    expect(graphics?.layer).toBe('gfxCommodore');
    expect(graphics?.shiftedLayer).toBe('gfxShift');
  });

  it('carries eight function keys f1..f8 in the top strip', () => {
    expect(functionKeys.map((k) => k.id)).toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'F6',
      'F7',
      'F8',
    ]);
    // The even keys are SHIFT of the odd matrix lines.
    const byId = new Map(functionKeys.map((k) => [k.id, k]));
    expect(byId.get('F1')!.emits).toEqual(['F1']);
    expect(byId.get('F2')!.emits).toEqual(['LeftShift', 'F1']);
    expect(byId.get('F8')!.emits).toEqual(['LeftShift', 'F7']);
  });

  it('puts both block-graphic sets on the letter keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('A')!, 'gfxCommodore')).toEqual(
      {
        insert: '┌',
      },
    );
    expect(resolveEditorAction(layout, byId.get('A')!, 'gfxShift')).toEqual({
      insert: '♠',
    });
    expect(resolveEditorAction(layout, byId.get('S')!, 'gfxShift')).toEqual({
      insert: '♥',
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
    for (const key of allKeys) {
      if (key.modifier) expect(modIds.has(key.modifier), key.id).toBe(true);
    }
  });

  it('puts the operators on the SHIFT layer as editor inserts', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('A')!, 'shift')).toEqual({
      insert: '+',
    });
    expect(resolveEditorAction(layout, byId.get('Num1')!, 'shift')).toEqual({
      insert: '!',
    });
  });

  it('spot checks the common bottom row', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('Return')!, 'base')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'base')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Quote')!, 'base')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('InstDel')!, 'base')).toEqual({
      action: 'backspace',
    });
  });
});
