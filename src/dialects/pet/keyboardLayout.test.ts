import { describe, it, expect } from 'vitest';
import { petKeyboardLayout } from './keyboardLayout';
import { resolveEditorAction } from '../../keyboard/editorActions';
import { petTokenToPositions } from '../../emulator/pet/keyboard';

const layout = petKeyboardLayout;
const allKeys = layout.rows.flat();

describe('pet keyboard layout', () => {
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

  it('offers ABC and GRAPHICS modes and has no Commodore key', () => {
    expect(layout.editorModes?.map((m) => m.id)).toEqual(['abc', 'graphics']);
    const graphics = layout.editorModes?.find((m) => m.id === 'graphics');
    expect(graphics?.layer).toBe('gfxShift');
    // The graphics keyboard has no Commodore key or modifier - only SHIFT.
    expect(layout.modifiers.map((m) => m.id)).toEqual(['shift']);
    expect(allKeys.some((k) => k.id === 'Commodore')).toBe(false);
  });

  it('puts the single block-graphic set on the letter keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('A')!, 'gfxShift')).toEqual({
      insert: '♠',
    });
    expect(resolveEditorAction(layout, byId.get('S')!, 'gfxShift')).toEqual({
      insert: '♥',
    });
    expect(resolveEditorAction(layout, byId.get('Z')!, 'gfxShift')).toEqual({
      insert: '♦',
    });
  });

  it('puts operators and punctuation on the SHIFT layer as editor inserts', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('A')!, 'shift')).toEqual({
      insert: '+',
    });
    expect(resolveEditorAction(layout, byId.get('G')!, 'shift')).toEqual({
      insert: '=',
    });
    expect(resolveEditorAction(layout, byId.get('Num1')!, 'shift')).toEqual({
      insert: '!',
    });
    expect(resolveEditorAction(layout, byId.get('Slash')!, 'shift')).toEqual({
      insert: '?',
    });
  });

  it('keeps the number keys emitting their own digit matrix token', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(byId.get('Num1')!.emits).toEqual(['Num1']);
    expect(byId.get('Num0')!.emits).toEqual(['Num0']);
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

  it('every emitted token resolves to a PET key-matrix position', () => {
    // Every non-modifier key must drive real matrix lines so pressing it on the
    // running machine (or the game controller) reaches petMachine.setKey.
    for (const key of allKeys) {
      if (key.style === 'spacer') continue;
      for (const token of key.emits) {
        expect(
          petTokenToPositions(token).length,
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
});
