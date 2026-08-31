// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The keyboard is the sibling's, so this file pins the seam and not the matrix.
 *
 * `../apple2/keyboardLayout.test.ts` already checks the rows themselves against
 * the machine, glyph by glyph and layer by layer, and re-checking the same
 * arrays here would only assert that `===` works. What is this dialect's is the
 * identity it wears and the fact that the two cannot drift apart.
 */

import { describe, expect, it } from 'vitest';
import { apple2plusKeyboardLayout } from './keyboardLayout';
import { apple2KeyboardLayout } from '../apple2/keyboardLayout';
import { apple2KeyTokens } from '../../emulator/apple2/keyboard';
import { apple2plus } from './index';

const layout = apple2plusKeyboardLayout;

describe('apple2plus keyboard layout', () => {
  it('is the sibling’s keyboard, by identity rather than by copy', () => {
    // The II and the II Plus have the same keyboard: same keys, same encoder,
    // same 2513 behind it. A copy could drift; these arrays cannot.
    expect(layout.rows).toBe(apple2KeyboardLayout.rows);
    expect(layout.layers).toBe(apple2KeyboardLayout.layers);
    expect(layout.functionKeys).toBe(apple2KeyboardLayout.functionKeys);
    expect(layout.controller).toBe(apple2KeyboardLayout.controller);
  });

  it('wears this machine’s own identity', () => {
    // The layout is keyed by dialect id, so a layout still calling itself
    // `apple2` would hand the II Plus the II's stylesheet - and, once both are
    // registered, would collide.
    expect(layout.id).toBe(apple2plus.id);
    expect(layout.name).toBe(apple2plus.name);
    expect(layout.theme).toBe('vk-theme-apple2plus');
    expect(layout.theme).not.toBe(apple2KeyboardLayout.theme);
  });

  it('reaches every matrix key by keycap, and emits nothing the machine cannot take', () => {
    // Both directions of the one vocabulary the layout and
    // `emulator/apple2/keyboard.ts` share. A key emitting a token the adapter
    // does not know sends nothing at all, and the failure is silent.
    const keys = [...layout.rows.flat(), ...(layout.functionKeys ?? [])].filter(
      (k) => k.emits.length > 0,
    );
    const known = new Set(apple2KeyTokens());
    for (const key of keys)
      for (const token of key.emits)
        expect(known.has(token), `${key.id} emits unknown "${token}"`).toBe(
          true,
        );

    const emitted = new Set(
      keys.flatMap((k) => [
        ...k.emits,
        ...k.labels.flatMap((l) => l?.emits ?? []),
      ]),
    );
    for (const token of apple2KeyTokens())
      expect(emitted.has(token), `no key emits "${token}"`).toBe(true);
  });

  it('declares no graphics palette, so it stays out of paletteMachines', () => {
    // The 2513 holds 64 ASCII glyphs and no mosaics. This machine's colour is
    // COLOR=/HCOLOR= and the display pages, which are memory rather than
    // characters, so there is nothing for a palette to offer.
    expect(layout.graphicsPalette).toBeUndefined();
  });
});
