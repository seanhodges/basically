import { describe, it, expect } from 'vitest';
import { spectrum128KeyboardLayout } from './keyboardLayout';
import { spectrum128Charset } from './charset';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';
import { spectrumKeyboardLayout } from '../zxspectrum/keyboardLayout';

// The 128 layout is reused from the 48K Spectrum (the matrix and key tokens are
// identical), so these guard that the reuse stays valid: labels stay aligned
// with the layers, every insert is valid charset text, and the matrix tokens
// the reused SpectrumKeyboard expects are present.
const layout = spectrum128KeyboardLayout;
const allKeys = layout.rows.flat();

const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'caps',
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
    // The reused SpectrumKeyboard scans an 8x5 matrix; every one of these
    // tokens must be pressable from the layout so the virtual keyboard and
    // the emulator agree. SymShift has no keycap of its own - the SYM cells
    // and the quote key press it inside their own combinations.
    const emitted = new Set(
      allKeys.flatMap((k) => [
        ...k.emits,
        ...k.labels.flatMap((l) => l?.emits ?? []),
      ]),
    );
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
      expect(emitted.has(token), token).toBe(true);
    }
  });

  it('drops the two user-defined graphics the 128 spends on keywords', () => {
    // \t and \u are 0xA3/0xA4, which on this machine are the SPECTRUM and PLAY
    // tokens (see ./keywords) - so those two keys type a keyword, not a
    // graphic, and the palette must not offer them.
    const udgs = layout.graphicsPalette!.sections.find(
      (s) => s.title === 'User-defined graphics',
    )!;
    expect(udgs.entries.map((e) => e.code)).toEqual(
      Array.from({ length: 0xa2 - 0x90 + 1 }, (_, i) => 0x90 + i),
    );
    expect(udgs.entries.at(-1)).toMatchObject({ key: 'S', code: 0xa2 });
    expect(udgs.entries.some((e) => e.char === '\\t')).toBe(false);
    expect(udgs.entries.some((e) => e.char === '\\u')).toBe(false);
    // The 48K keeps all twenty-one.
    expect(
      spectrumKeyboardLayout.graphicsPalette!.sections.find(
        (s) => s.title === 'User-defined graphics',
      )!.entries,
    ).toHaveLength(21);
  });

  it("keeps the cursor arrows on the 48K's 5/6/7/8 keycaps", () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('Digit5')!, 'cursor')).toEqual({
      action: 'left',
    });
    expect(resolveEmits(layout, byId.get('Digit5')!, 'cursor')).toEqual([
      'CapsShift',
      'Digit5',
    ]);
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    // '"' is the SYM cell on the C slot, as on the 48K parent.
    expect(resolveEditorAction(layout, byId.get('KeyC')!, 'symbols')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'main')).toEqual({
      action: 'newline',
    });
  });
});
