import { describe, expect, it } from 'vitest';
import { trs80KeyboardLayout as layout } from './keyboardLayout';
import { trs80Charset } from './charset';
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

  it('labels are index-aligned with the layers', () => {
    for (const k of allKeys) {
      if (k.style === 'spacer') continue;
      expect(k.labels.length, k.id).toBe(layout.layers.length);
    }
  });

  it('offers ABC, CURSOR and GRAPHICS modes', () => {
    expect((layout.editorModes ?? []).map((m) => m.id)).toEqual([
      'abc',
      'cursor',
      'graphic',
    ]);
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

  it('offers a graphics palette whose characters encode to their codes', () => {
    const palette = layout.graphicsPalette;
    expect(palette).toBeDefined();
    const entries = palette!.sections.flatMap((s) => s.entries);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      // The TRS-80 printed no graphics on its keys, so every cell is
      // labelled by character code instead.
      expect(entry.key, `0x${entry.code.toString(16)}`).toBeUndefined();
      expect(
        [...trs80Charset.toMachine(entry.char)],
        `0x${entry.code.toString(16)}`,
      ).toEqual([entry.code]);
    }
    // Codes appear once each, so no character is offered twice.
    expect(new Set(entries.map((e) => e.code)).size).toBe(entries.length);
  });

  it('reaches the palette from an editor mode', () => {
    const mode = layout.editorModes!.find((m) => m.palette === 'graphics');
    expect(mode).toBeDefined();
  });
});
