import { describe, it, expect } from 'vitest';
import { c64KeyboardLayout } from './keyboardLayout';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';
import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { C64_COMMODORE_GRAPHICS, C64_SHIFT_GRAPHICS } from './graphics';

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

  it('offers ABC, SYM, CURSOR and GRAPHICS modes, the last showing the palette', () => {
    expect(layout.editorModes?.map((m) => m.id)).toEqual([
      'abc',
      'sym',
      'cursor',
      'graphics',
    ]);
    const sym = layout.editorModes?.find((m) => m.id === 'sym');
    expect(sym?.layer).toBe('symbols');
    // Every C64 symbol fits on page 1, so there is no page 2 or toggle.
    expect(sym?.shiftedLayer).toBeUndefined();
    const graphics = layout.editorModes?.find((m) => m.id === 'graphics');
    expect(graphics?.palette).toBe('graphics');
    // The graphics sets are the palette's, not a pinned key layer's.
    expect(graphics?.shiftedLayer).toBeUndefined();
    expect(layout.layers.map((l) => l.id)).toEqual([
      'base',
      'shift',
      'cursor',
      'symbols',
    ]);
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

  it('puts both block-graphic sets in the palette, keyed and labelled', () => {
    const sections = layout.graphicsPalette!.sections;
    expect(sections.map((s) => s.title)).toEqual([
      'C= graphics',
      'SHIFT graphics',
    ]);
    expect(sections[0]!.entries).toEqual(C64_COMMODORE_GRAPHICS);
    expect(sections[1]!.entries).toEqual(C64_SHIFT_GRAPHICS);
    const find = (section: number, key: string) =>
      sections[section]!.entries.find((e) => e.key === key);
    expect(find(0, 'A')?.char).toBe('┌');
    expect(find(1, 'A')?.char).toBe('♠');
    expect(find(1, 'S')?.char).toBe('♥');
    // Every entry says which key and modifier produces it on the real machine.
    for (const section of sections)
      for (const entry of section.entries) {
        expect(entry.key, String(entry.code)).toBeTruthy();
        expect(entry.modifier, entry.key).toBeTruthy();
      }
  });

  it('presses the dedicated symbol keys from the canonical SYM positions', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    // '+' leads the Q row and presses the C64's own + key; £ sits on the Y
    // slot and ↑ on page 1's ^ slot (the machine's ↑).
    expect(resolveEditorAction(layout, byId.get('Q')!, 'symbols')).toEqual({
      insert: '+',
    });
    expect(resolveEmits(layout, byId.get('Q')!, 'symbols')).toEqual(['Plus']);
    expect(resolveEditorAction(layout, byId.get('Y')!, 'symbols')).toEqual({
      insert: '£',
    });
    expect(resolveEmits(layout, byId.get('Y')!, 'symbols')).toEqual(['Pound']);
    expect(resolveEditorAction(layout, byId.get('G')!, 'symbols')).toEqual({
      insert: '↑',
    });
    expect(resolveEmits(layout, byId.get('G')!, 'symbols')).toEqual([
      'UpArrow',
    ]);
  });

  it("carries those six keys' graphics in the palette, under their keycaps", () => {
    const [cmd, shifted] = layout.graphicsPalette!.sections;
    const find = (entries: GraphicEntry[] | undefined, key: string) =>
      entries?.find((e) => e.key === key);
    expect(find(cmd?.entries, '+')?.char).toBe('▒');
    expect(find(shifted?.entries, '+')?.char).toBe('┼');
    expect(find(shifted?.entries, '*')?.char).toBe('─');
    // ↑ has no C= graphic, only SHIFT π.
    expect(find(shifted?.entries, '↑')?.char).toBe('π');
    expect(find(cmd?.entries, '↑')).toBeUndefined();
  });

  it('keeps the number keys emitting their own digit matrix token', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(byId.get('Num1')!.emits).toEqual(['Num1']);
    expect(byId.get('Num6')!.emits).toEqual(['Num6']);
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

  it('keeps SHIFT out of the editor: symbols are the SYM mode alone', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    // SHIFT+digit still types ! on the machine matrix, but the editor path
    // goes through the SYM cells; the keycap carries no shifted legend.
    expect(resolveEditorAction(layout, byId.get('Num1')!, 'shift')).toEqual({
      insert: '1',
    });
    expect(resolveEditorAction(layout, byId.get('W')!, 'symbols')).toEqual({
      insert: '!',
    });
    // SHIFT over a letter is a block graphic on the real machine, offered by
    // the palette; the key carries no invented shifted legend.
    expect(resolveEditorAction(layout, byId.get('A')!, 'shift')).toEqual({
      insert: 'A',
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
