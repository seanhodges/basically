import { describe, it, expect } from 'vitest';
import { vic20KeyboardLayout } from './keyboardLayout';
import { c64KeyboardLayout } from '../commodore64/keyboardLayout';
import { resolveEditorAction } from '../../keyboard/editorActions';
import {
  vic20TokenToPositions,
  vic20DomCodeToTokens,
} from '../../emulator/vic20/keyboard';

const layout = vic20KeyboardLayout;
const functionKeys = layout.functionKeys ?? [];
const allKeys = [...layout.rows.flat(), ...functionKeys];

describe('vic20 keyboard layout', () => {
  it('re-identifies and re-themes the shared C64 layout', () => {
    expect(layout.id).toBe('vic20');
    expect(layout.name).toBe('Commodore VIC-20');
    expect(layout.theme).toBe('vk-theme-vic20');
    // The key set / modes / graphics are the C64's - only the identity differs.
    expect(layout.rows).toBe(c64KeyboardLayout.rows);
    expect(layout.functionKeys).toBe(c64KeyboardLayout.functionKeys);
    expect(layout.editorModes).toBe(c64KeyboardLayout.editorModes);
  });

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

  it('offers ABC, SYM and GRAPHICS modes with the two block-graphic sets', () => {
    expect(layout.editorModes?.map((m) => m.id)).toEqual([
      'abc',
      'sym',
      'graphics',
    ]);
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    // Both C=/SHIFT block graphics ride the letter keys, as on the C64.
    expect(resolveEditorAction(layout, byId.get('A')!, 'gfxCommodore')).toEqual(
      {
        insert: '┌',
      },
    );
    expect(resolveEditorAction(layout, byId.get('A')!, 'gfxShift')).toEqual({
      insert: '♠',
    });
    // The six graphics symbols (+ - £ @ * ↑) sit on the number row's SYM layer.
    expect(resolveEditorAction(layout, byId.get('Num1')!, 'sym')).toEqual({
      insert: '+',
    });
    expect(resolveEditorAction(layout, byId.get('Num6')!, 'sym')).toEqual({
      insert: '↑',
    });
  });

  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      if (key.style === 'spacer') continue; // inert filler, no labels
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const key of allKeys) {
      if (key.modifier) expect(modIds.has(key.modifier), key.id).toBe(true);
    }
  });

  it('every emitted token resolves to a VIC-20 key-matrix position', () => {
    // Every non-modifier key must drive real matrix lines so pressing it on the
    // running machine (or the game controller) reaches Vic20Machine.setKey.
    for (const key of allKeys) {
      if (key.style === 'spacer') continue;
      for (const token of key.emits) {
        expect(
          vic20TokenToPositions(token).length,
          `${key.id} emits ${token}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('controller bindings reference real keys in this layout', () => {
    const ids = new Set(allKeys.map((k) => k.id));
    for (const id of Object.values(layout.controller?.bindings ?? {})) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('physical DOM codes fold into the same matrix vocabulary', () => {
    // The physical-keyboard path (DOM code → token) and the on-screen layout
    // (key → emitted token) share one matrix, so a representative physical key
    // resolves to a real position too.
    for (const code of ['KeyA', 'Digit1', 'Enter', 'Space', 'ShiftLeft']) {
      const tokens = vic20DomCodeToTokens(code);
      expect(tokens.length, code).toBeGreaterThan(0);
      for (const token of tokens) {
        expect(vic20TokenToPositions(token).length, token).toBeGreaterThan(0);
      }
    }
  });
});
