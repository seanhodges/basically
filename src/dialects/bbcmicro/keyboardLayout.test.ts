import { describe, it, expect } from 'vitest';
import { bbcKeyboardLayout } from './keyboardLayout';
import { bbcCharset } from './charset';
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

  it('offers ABC, SYM, CURSOR and GRAPHICS modes plus the f0–f9 function keys', () => {
    expect((layout.editorModes ?? []).map((m) => m.id)).toEqual([
      'abc',
      'sym',
      'cursor',
      'graphic',
    ]);
    expect(functionKeys.map((k) => k.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `F${i}`),
    );
  });

  it('every graphics-palette character re-encodes to its declared code', () => {
    const sections = layout.graphicsPalette?.sections ?? [];
    expect(sections.length).toBe(4);
    for (const section of sections) {
      for (const entry of section.entries) {
        // A control cell inserts an escape rather than a character, but it is
        // held to the same round trip: the text it types is the byte it claims.
        expect(
          Array.from(bbcCharset.toMachine(entry.char)),
          `${entry.char} -> 0x${entry.code.toString(16)}`,
        ).toEqual([entry.code]);
        // No BBC keycap carries a graphic, so cells are labelled by code.
        expect(entry.key).toBeUndefined();
      }
    }
  });

  it('leads with the graphics colours and states why they are there', () => {
    // The palette's whole job on this machine: the mosaics below print as
    // letters until one of these appears earlier on the same screen line, so
    // they come first and the section says so.
    const sections = layout.graphicsPalette?.sections ?? [];
    expect(sections[0]!.entries.map((e) => e.code)).toEqual([
      0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
    ]);
    expect(sections[0]!.note).toMatch(/letters/i);
    expect(sections[3]!.entries.map((e) => e.code)).toEqual([
      0x99, 0x9a, 0x9e, 0x9f,
    ]);
  });

  it('draws the control codes as chips and the mosaics as characters', () => {
    const sections = layout.graphicsPalette?.sections ?? [];
    const isControl = (code: number): boolean => code < 0xa0;
    for (const section of sections) {
      for (const entry of section.entries) {
        const where = `0x${entry.code.toString(16)}`;
        if (isControl(entry.code)) {
          // Spelled out, `{GRAPHICS WHITE}` would be sixteen columns in a cell
          // sized for one character.
          expect(entry.chip, where).toBeDefined();
          expect(entry.chip!.title, where).not.toBe('');
        } else {
          expect(entry.chip, where).toBeUndefined();
        }
      }
    }
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
