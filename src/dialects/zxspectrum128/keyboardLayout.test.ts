import { describe, it, expect } from 'vitest';
import { spectrum128KeyboardLayout } from './keyboardLayout';
import { spectrum128Charset } from './charset';
import { resolveEditorAction } from '../../keyboard/editorActions';

// The 128 layout is reused from the 48K Spectrum (the matrix and key tokens are
// identical), so these guard that the reuse stays valid: labels stay aligned
// with the layers, every insert is valid charset text, and the matrix tokens
// the reused SpectrumKeyboard expects are present.
const layout = spectrum128KeyboardLayout;
const allKeys = layout.rows.flat();

const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'caps',
  'symbol',
];

describe('zxspectrum128 keyboard layout', () => {
  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      if (key.style === 'spacer') continue; // inert filler, no labels
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('every insert in every reachable mode is valid Spectrum charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => spectrum128Charset.toMachine(action.insert),
            `${key.id} on layer ${layerId}: ${JSON.stringify(action.insert)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('covers the physical + virtual key union with matrix tokens', () => {
    // The reused SpectrumKeyboard scans an 8x5 matrix; every key in the layout
    // (bar spacers) must carry a token it understands so the virtual keyboard
    // and the emulator agree.
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    for (const token of [
      'CapsShift',
      'SymShift',
      'Enter',
      'Space',
      'KeyL',
      'KeyP',
      'Digit6',
      'Digit7',
    ]) {
      expect(byId.has(token), token).toBe(true);
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'symbol')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'main')).toEqual({
      action: 'newline',
    });
  });
});
