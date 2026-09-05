// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2KeyboardLayout } from './keyboardLayout';
import { apple2KeyTokens, tokenToByte } from '../../emulator/apple2/keyboard';
import { resolveEditorAction } from '../../keyboard/editorActions';
import { GRID_COLUMNS, KEY_SPAN } from '../../keyboard/templateRows';
import { GLYPH_BASE, GLYPH_TOP, apple2Charset } from './charset';
import type { KeyDef } from '../../keyboard/layoutSchema';

const layout = apple2KeyboardLayout;
const keys = [...layout.rows.flat(), ...(layout.functionKeys ?? [])];
/** Every key that actually drives the machine (spacers emit nothing). */
const driving = keys.filter((k) => k.emits.length > 0);
/** A key's own tokens plus any its legends press in place of them. */
const allTokens = (key: KeyDef): string[] => [
  ...key.emits,
  ...key.labels.flatMap((l) => l?.emits ?? []),
];

/** The editor text a key inserts on a layer, or null when it inserts nothing. */
function insertOn(key: KeyDef, layerId: string): string | null {
  const action = resolveEditorAction(layout, key, layerId);
  return action && 'insert' in action ? action.insert : null;
}

describe('apple2 keyboard layout', () => {
  it('emits a token for every key the keyboard adapter can translate', () => {
    // The layout and `emulator/apple2/keyboard.ts` are two halves of one
    // vocabulary: a key emitting a token the adapter does not know sends
    // nothing at all, and the failure is silent.
    const known = new Set(apple2KeyTokens());
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
    // is a character the on-screen keyboard cannot produce. Including the SYM
    // legends' own tokens, which bypass `emits`.
    const emitted = new Set(driving.flatMap(allTokens));
    for (const token of apple2KeyTokens()) {
      expect(emitted.has(token), `no key emits "${token}"`).toBe(true);
    }
  });

  it('offers base, SHIFT and the SYM pages - no keyword or graphics layer', () => {
    expect(layout.layers.map((l) => l.id)).toEqual([
      'base',
      'shift',
      'symbols',
      'symbols2',
    ]);
    // ABC and SYM only: Integer BASIC has no abbreviation to put on a keyword
    // layer, and the two arrows sit on the grid rather than under a CURSOR mode.
    expect(layout.editorModes?.map((m) => m.id)).toEqual(['abc', 'sym']);
  });

  it('declares no graphics palette, so it stays out of paletteMachines', () => {
    // The 2513 holds 64 ASCII glyphs and no mosaics - see charset.ts. This
    // machine's colour is COLOR= and the lo-res page, which is memory rather
    // than characters. Adding a palette here would also have to add the id to
    // e2e/paletteMachines.ts, which src/dialects/graphicsPalette.test.ts pins
    // to the registry.
    expect(layout.graphicsPalette).toBeUndefined();
  });

  it('types the same character it sends, on both layers', () => {
    // The crosscheck that matters: a legend copied from a modern keyboard would
    // insert one character into the editor while the machine received another.
    // SHIFT-2 is `"` here, not `@`, and `@` is SHIFT-P - both of which the SYM
    // pages below reach, since a typing band carries the base character alone.
    let pairsChecked = 0;
    for (const key of driving) {
      if (key.modifier) continue;
      for (const [layerId, shifted] of [
        ['base', false],
        ['shift', true],
      ] as const) {
        // Only a key's own legend makes a claim; a layer with no label falls
        // back to the base insert, which is not one.
        const layerIdx = layout.layers.findIndex((l) => l.id === layerId);
        if (!key.labels[layerIdx]) continue;
        const insert = insertOn(key, layerId);
        if (insert === null || insert.length !== 1) continue; // ↵ ← → act
        // A synthesized combination (the quote key) carries its SHIFT in its
        // own tokens.
        const token = key.emits.find((t) => t !== 'Shift')!;
        const shift = shifted || key.emits.includes('Shift');
        const byte = tokenToByte(token, { shift });
        expect(
          byte,
          `${key.id} on ${layerId} inserts "${insert}" but sends nothing`,
        ).not.toBeNull();
        expect(String.fromCharCode(byte!), `${key.id} on ${layerId}`).toBe(
          insert,
        );
        pairsChecked++;
      }
    }
    // Thirty-eight printing keycaps, each claiming one character. Nothing on
    // the SHIFT layer: the shifted faces are reached through the SYM pages,
    // which are checked below.
    expect(pairsChecked).toBe(38);

    // The SYM cells make the same claim, so they are held to the same check:
    // the byte their combination sends is the character they insert.
    let symChecked = 0;
    for (const layerId of ['symbols', 'symbols2']) {
      const idx = layout.layers.findIndex((l) => l.id === layerId);
      for (const key of layout.rows.flat()) {
        const label = key.labels[idx];
        if (!label?.emits?.length || !label.editor) continue;
        if (!('insert' in label.editor)) continue;
        const token = label.emits.find((t) => t !== 'Shift')!;
        const byte = tokenToByte(token, {
          shift: label.emits.includes('Shift'),
        });
        expect(
          byte === null ? '' : String.fromCharCode(byte),
          `SYM ${label.text} via ${label.emits.join('+')}`,
        ).toBe(label.editor.insert);
        symChecked++;
      }
    }
    expect(symChecked).toBe(26);
  });

  it('produces CTRL-C (0x03) for breaking a running program', () => {
    expect(layout.modifiers.map((m) => m.id)).toContain('ctrl');
    expect(tokenToByte('KeyC', { ctrl: true })).toBe(0x03);
  });

  it('carries REPT as a lockable modifier, the one key meant to be held', () => {
    // Auto-repeat is not a character: held alongside another key it re-sends
    // that key's byte, so it has to be a modifier the user can lock down rather
    // than a keycap that sends something of its own.
    const rept = layout.modifiers.find((m) => m.id === 'rept');
    expect(rept).toEqual({
      id: 'rept',
      emits: ['Rept'],
      sticky: true,
      lockable: true,
    });
    expect(tokenToByte('Rept')).toBeNull();
  });

  it('makes the left arrow the delete flank, which is this machine’s rub-out', () => {
    // $08 is what the interpreter's line editor reads as "rub out the last
    // character"; there is no Backspace key on the board to name it after.
    const flank = layout.rows[3]!.at(-1)!;
    expect(flank.emits).toEqual(['ArrowLeft']);
    expect(tokenToByte('ArrowLeft')).toBe(0x08);
    expect(resolveEditorAction(layout, flank, 'base')).toEqual({
      action: 'backspace',
    });
  });

  it('puts RESET and ESC on the strip, typing nothing', () => {
    // RESET is wired to the CPU's reset line and never reaches the keyboard
    // latch, so it has no character at all; ESC has one the editor has no use
    // for. Neither may insert into the editor.
    const strip = layout.functionKeys ?? [];
    expect(strip.map((k) => k.id)).toEqual(['Reset', 'Escape']);
    expect(tokenToByte('Reset')).toBeNull();
    expect(tokenToByte('Escape')).toBe(0x1b);
    for (const key of strip) {
      for (const layer of layout.layers) {
        expect(insertOn(key, layer.id), `${key.id} on ${layer.id}`).toBeNull();
      }
    }
  });

  it('types only upper case, as the 2513 could draw', () => {
    for (const key of driving) {
      for (const layer of layout.layers) {
        const insert = insertOn(key, layer.id);
        if (insert === null) continue;
        expect(insert, `${key.id} on ${layer.id}`).toBe(insert.toUpperCase());
      }
    }
    expect(layout.powerOnCase).toBeUndefined();
  });

  it('stays on the template’s grid, strip included', () => {
    expect(layout.gridColumns).toBe(GRID_COLUMNS);
    for (const row of layout.rows) {
      expect(row.reduce((n, k) => n + k.spanX, 0)).toBe(GRID_COLUMNS);
    }
    const strip = layout.functionKeys ?? [];
    for (const key of strip) expect(key.spanX).toBe(KEY_SPAN);
    expect(strip.reduce((n, k) => n + k.spanX, 0)).toBeLessThan(GRID_COLUMNS);
  });

  it('binds the pad to keys that exist, W A S D having no rival here', () => {
    // The samples read these, so a binding naming a key the layout does not
    // carry would leave the on-screen pad pressing nothing.
    const ids = new Set(keys.map((k) => k.id));
    const bindings = layout.controller!.bindings;
    for (const [role, id] of Object.entries(bindings)) {
      expect(ids.has(id!), `${role} binds missing key ${id}`).toBe(true);
    }
    expect(bindings).toEqual({
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      fire1: 'Space',
      fire2: 'Enter',
    });
  });

  it('reaches every glyph the machine has but `_`, which no key sends', () => {
    // $A0-$DF is every code with a plain character. The encoder produces
    // $20-$5F and the caps stop one short of it: nothing on this board sends
    // $5F, where the Apple I's SHIFT-O did. A program still writes it with
    // POKE, which is why the charset keeps it.
    const typed = new Set<number>();
    for (const key of driving) {
      for (const layer of layout.layers) {
        const insert = insertOn(key, layer.id);
        if (insert === null) continue;
        for (const byte of apple2Charset.toMachine(insert)) typed.add(byte);
      }
    }
    const underscore = '_'.charCodeAt(0) + 0x80;
    expect(underscore).toBe(GLYPH_TOP);
    expect([...typed].sort((a, b) => a - b)).toEqual(
      Array.from({ length: GLYPH_TOP - GLYPH_BASE }, (_, i) => GLYPH_BASE + i),
    );
  });
});
