// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { altair8800KeyboardLayout } from './keyboardLayout';
import { altair8800KeyTokens, tokenToByte } from './emulator/keyboard';
import { resolveEditorAction } from '../../keyboard/editorActions';
import {
  GRID_COLUMNS,
  KEY_SPAN,
  functionStrip,
} from '../../keyboard/templateRows';
import { altair8800Charset } from './charset';
import type { KeyDef } from '../../keyboard/layoutSchema';

const layout = altair8800KeyboardLayout;
const keys = [...layout.rows.flat(), ...(layout.functionKeys ?? [])];
/** Every key that actually drives the machine (spacers emit nothing). */
const driving = keys.filter((k) => k.emits.length > 0);

/** The editor text a key inserts on a layer, or null when it inserts nothing. */
function insertOn(key: KeyDef, layerId: string): string | null {
  const action = resolveEditorAction(layout, key, layerId);
  return action && 'insert' in action ? action.insert : null;
}

describe('altair8800 keyboard layout', () => {
  it('emits a token for every key the serial adapter can translate', () => {
    // The layout and `emulator/keyboard.ts` are two halves of one vocabulary: a
    // key emitting a token the adapter does not know sends nothing at all, and
    // the failure is silent.
    const known = new Set(altair8800KeyTokens());
    for (const key of driving) {
      for (const token of key.emits) {
        expect(
          known.has(token),
          `${key.id} emits unknown token "${token}"`,
        ).toBe(true);
      }
    }
  });

  it('offers a key for every token the machine understands', () => {
    // …and the other direction: a token the adapter translates but no key emits
    // is a character the on-screen keyboard cannot produce.
    const emitted = new Set(driving.flatMap((k) => k.emits));
    for (const token of altair8800KeyTokens()) {
      expect(emitted.has(token), `no key emits "${token}"`).toBe(true);
    }
  });

  it('offers only base and SHIFT layers - no keyword or graphics layer', () => {
    expect(layout.layers.map((l) => l.id)).toEqual(['base', 'shift']);
    expect(layout.editorModes).toBeUndefined();
  });

  it('declares no graphics palette, so it stays out of paletteMachines', () => {
    // The machine has no block graphics at all - see charset.ts. Adding a
    // palette here would also have to add the id to e2e/paletteMachines.ts,
    // which src/dialects/graphicsPalette.test.ts pins to the registry.
    expect(layout.graphicsPalette).toBeUndefined();
  });

  it('types the same character it sends, on both layers', () => {
    // The crosscheck that matters: the ASR-33's SHIFT is a bit-4 flip, so
    // SHIFT-K is `[`, SHIFT-P is `@` and SHIFT-0 is a space. A legend copied
    // from a modern keyboard would insert one character into the editor while
    // the machine received another.
    for (const key of driving) {
      if (key.modifier) continue;
      for (const [layerId, mods] of [
        ['base', {}],
        ['shift', { shift: true }],
      ] as const) {
        const insert = insertOn(key, layerId);
        if (insert === null || insert.length !== 1) continue; // ↵ and ⌫ act
        const byte = tokenToByte(key.emits[0]!, mods);
        expect(
          byte,
          `${key.id} on ${layerId} inserts "${insert}" but sends nothing`,
        ).not.toBeNull();
        expect(String.fromCharCode(byte!), `${key.id} on ${layerId}`).toBe(
          insert,
        );
      }
    }
  });

  it('produces CTRL-C (0x03) for breaking a running program', () => {
    expect(layout.modifiers.map((m) => m.id)).toContain('ctrl');
    expect(tokenToByte('KeyC', { ctrl: true })).toBe(0x03);
  });

  it('types only upper case, as the ASR-33 did', () => {
    for (const key of driving) {
      for (const layer of layout.layers) {
        const insert = insertOn(key, layer.id);
        if (insert === null) continue;
        expect(insert, `${key.id} on ${layer.id}`).toBe(insert.toUpperCase());
      }
    }
  });

  it('stays on the template’s grid, strip included', () => {
    // A keycap here is the size of a Spectrum's. The teletype's three function
    // keys are the fewest of any machine, and the strip they sit on is the key
    // rows' own grid, so they are keycaps centred over the board rather than
    // three keys stretched across its width.
    expect(layout.gridColumns).toBe(GRID_COLUMNS);
    for (const row of layout.rows) {
      expect(row.reduce((n, k) => n + k.spanX, 0)).toBe(GRID_COLUMNS);
    }
    const strip = layout.functionKeys ?? [];
    for (const key of strip) expect(key.spanX).toBe(KEY_SPAN);
    const lines = functionStrip(strip);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.reduce((n, k) => n + k.spanX, 0)).toBe(GRID_COLUMNS);
  });

  it('reaches the whole 64-character set the teletype had', () => {
    // The ASR-33 is a 64-character machine: 0x20-0x5F, with no lower case and
    // no backtick or braces. Every one of those codes must be typeable, and
    // nothing outside them should be.
    const typed = new Set<number>();
    for (const key of driving) {
      for (const layer of layout.layers) {
        const insert = insertOn(key, layer.id);
        if (insert === null) continue;
        for (const byte of altair8800Charset.toMachine(insert)) typed.add(byte);
      }
    }
    expect([...typed].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 0x60 - 0x20 }, (_, i) => 0x20 + i),
    );
  });
});
