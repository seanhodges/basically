import { describe, expect, it } from 'vitest';
import { trs80KeyboardLayout as layout } from './keyboardLayout';
import { resolveEditorAction } from '../../keyboard/editorActions';
import { Trs80Input } from './interpreter/input';

const allKeys = [...layout.rows.flat(), ...(layout.functionKeys ?? [])];

describe('trs80 keyboard layout', () => {
  it('uses the standard 40-column, 5-row template', () => {
    expect(layout.gridColumns).toBe(40);
    expect(layout.rows).toHaveLength(5);
  });

  it('every row spans exactly the grid width', () => {
    layout.rows.forEach((row, i) => {
      const total = row.reduce((n, k) => n + k.spanX, 0);
      expect(total, `row ${i}`).toBe(40);
    });
  });

  it('labels are index-aligned with the two layers', () => {
    for (const k of allKeys) {
      if (k.style === 'spacer') continue;
      expect(k.labels.length, k.id).toBe(layout.layers.length);
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const k of allKeys) {
      if (k.modifier) expect(modIds.has(k.modifier), k.id).toBe(true);
    }
  });

  it('spot checks the bottom-row editor actions', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'base')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'base')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Backspace')!, 'base')).toEqual(
      {
        action: 'backspace',
      },
    );
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'shift')).toEqual({
      insert: '+',
    });
  });

  it('emits tokens the interpreter input adapter actually types', () => {
    // The virtual keyboard drives setKey/setToken; verify the union round-trips.
    const input = new Trs80Input();
    input.setToken('KeyA', true);
    expect(input.inkey()).toBe('A');

    // SHIFT + Digit2 yields the quote (matching the Quote key's emits).
    input.setToken('Shift', true);
    input.setToken('Digit2', true);
    expect(input.inkey()).toBe('"');

    input.setToken('Space', true);
    expect(input.inkey()).toBe(' ');
  });
});
