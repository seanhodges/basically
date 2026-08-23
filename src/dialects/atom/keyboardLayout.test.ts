import { describe, it, expect } from 'vitest';
import { atomKeyboardLayout } from './keyboardLayout';
import { atomCharset } from './charset';
import { matrixForToken } from '../../emulator/atom/keyboard';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';
import type { KeyDef } from '../../keyboard/layoutSchema';

const layout = atomKeyboardLayout;
const functionKeys = layout.functionKeys ?? [];
const allKeys = [...layout.rows.flat(), ...functionKeys];
/** Filler cells (spacers) emit nothing and carry no modifier. */
const realKeys = allKeys.filter((k) => k.emits.length > 0 || k.modifier);

/** Every layer a key press can resolve against in the editor. */
const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'shifted',
];

/**
 * Every token a key can press: its own, plus any a layer's legend names in
 * place of them (the CURSOR arrows over WASD). A legend's tokens bypass
 * `emits`, so a check that walked `emits` alone would not see them.
 */
const tokensOf = (key: KeyDef): string[] => [
  ...key.emits,
  ...key.labels.flatMap((l) => l?.emits ?? []),
];

describe('atom keyboard layout', () => {
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

  it('offers ABC, SYM, CURSOR and GRAPHICS modes and no function keys', () => {
    expect((layout.editorModes ?? []).map((m) => m.id)).toEqual([
      'abc',
      'sym',
      'cursor',
      'graphic',
    ]);
    expect(functionKeys).toHaveLength(0);
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

  it('every emitted token maps to the Atom key matrix', () => {
    for (const key of realKeys) {
      for (const token of tokensOf(key)) {
        expect(matrixForToken(token), `${key.id} → ${token}`).toBeDefined();
      }
    }
  });

  it('every editor insert is valid Atom charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => atomCharset.toMachine(action.insert),
            `${key.id} on layer ${layerId}: ${JSON.stringify(action.insert)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('every graphics-palette character re-encodes to its declared code', () => {
    const sections = layout.graphicsPalette?.sections ?? [];
    expect(sections.length).toBe(1);
    const entries = sections.flatMap((s) => s.entries);
    // 0xA1–0xDF: the 64 Semigraphics-6 cells minus the blank, which has no
    // character of its own.
    expect(entries.length).toBe(63);
    for (const entry of entries) {
      expect(
        Array.from(atomCharset.toMachine(entry.char)),
        `${entry.char} -> 0x${entry.code.toString(16)}`,
      ).toEqual([entry.code]);
      // No Atom keycap carries a graphic, so cells are labelled by code.
      expect(entry.key).toBeUndefined();
    }
  });

  it('offers the punctuation at the canonical SYM positions', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    // Page 1: '[' and ']' on the O/P slots, '@' on A, '^' on G - the same
    // positions every machine uses.
    expect(resolveEditorAction(layout, byId.get('KeyO')!, 'symbols')).toEqual({
      insert: '[',
    });
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'symbols')).toEqual({
      insert: ']',
    });
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'symbols')).toEqual({
      insert: '@',
    });
    expect(resolveEditorAction(layout, byId.get('KeyG')!, 'symbols')).toEqual({
      insert: '^',
    });
    // Page 2 holds the rarities: backslash on E, question mark on M.
    expect(resolveEditorAction(layout, byId.get('KeyE')!, 'symbols2')).toEqual({
      insert: '\\',
    });
    expect(resolveEditorAction(layout, byId.get('KeyM')!, 'symbols2')).toEqual({
      insert: '?',
    });
    // On the machine, a SYM cell presses the Atom's own key for the symbol,
    // not the letter underneath.
    expect(resolveEmits(layout, byId.get('KeyO')!, 'symbols')).toEqual([
      'BracketLeft',
    ]);
    // A blanked cell (the Atom has no '~') presses and types nothing.
    expect(resolveEmits(layout, byId.get('KeyW')!, 'symbols2')).toEqual([]);
    expect(
      resolveEditorAction(layout, byId.get('KeyW')!, 'symbols2'),
    ).toBeNull();
    // Digits keep typing through the base-layer fallback in SYM mode.
    expect(resolveEditorAction(layout, byId.get('Digit0')!, 'symbols')).toEqual(
      { insert: '0' },
    );
  });

  it('reaches the Atom BASIC essentials through the SYM mode', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    // ! for byte work, # for hex, $ for the string area - each cell pressing
    // the shifted digit the machine reads for it.
    expect(resolveEditorAction(layout, byId.get('KeyW')!, 'symbols')).toEqual({
      insert: '!',
    });
    expect(resolveEmits(layout, byId.get('KeyW')!, 'symbols')).toEqual([
      'Shift',
      'Digit1',
    ]);
    expect(resolveEditorAction(layout, byId.get('KeyS')!, 'symbols')).toEqual({
      insert: '#',
    });
    expect(resolveEditorAction(layout, byId.get('KeyD')!, 'symbols')).toEqual({
      insert: '$',
    });
    // ? indirection lives on the SYM second page, pressing SHIFT+/ - the
    // combination the machine's own slash key sends.
    const question = byId.get('KeyM')!;
    expect(resolveEditorAction(layout, question, 'symbols2')).toEqual({
      insert: '?',
    });
    expect(resolveEmits(layout, question, 'symbols2')).toEqual([
      'Shift',
      'Slash',
    ]);
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
