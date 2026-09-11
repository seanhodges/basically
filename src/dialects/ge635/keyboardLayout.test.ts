// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { ge635KeyboardLayout } from './keyboardLayout';
import {
  dartmouthKeyTokens,
  dartmouthTypeableChars,
  tokenToChar,
} from '../../emulator/dartmouth/keyboard';
import { plainChar } from './charset';
import { GE635_PROFILE } from './profile';
import { resolveEditorAction } from '../../keyboard/editorActions';
import { GRID_COLUMNS, KEY_SPAN } from '../../keyboard/templateRows';
import type { KeyDef } from '../../keyboard/layoutSchema';

const layout = ge635KeyboardLayout;
const charset = GE635_PROFILE.charset;
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

describe('ge635 keyboard layout', () => {
  it('emits a token for every key the teletype adapter can translate', () => {
    // The layout and `src/emulator/dartmouth/keyboard.ts` are two halves of one
    // vocabulary: a key emitting a token the adapter does not know queues
    // nothing at all, and the failure is silent.
    const known = new Set(dartmouthKeyTokens());
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
    // …and the other direction: a token the adapter translates but no key
    // emits is a character the on-screen keyboard cannot produce. The SYM
    // legends' own tokens count, since they bypass `emits`.
    const emitted = new Set(driving.flatMap(allTokens));
    for (const token of dartmouthKeyTokens()) {
      expect(emitted.has(token), `no key emits "${token}"`).toBe(true);
    }
  });

  it('offers base, SHIFT and the two SYM pages - nothing else', () => {
    expect(layout.layers.map((l) => l.id)).toEqual([
      'base',
      'shift',
      'symbols',
      'symbols2',
    ]);
    // ABC and SYM only. This machine has no cursor cluster at all, which
    // `keyboard/layoutGeometry.test.ts` records by name.
    expect(layout.editorModes?.map((m) => m.id)).toEqual(['abc', 'sym']);
    // No CTRL: nothing in this run-time reads a control code, so a CTRL
    // keycap would press nothing.
    expect(layout.modifiers.map((m) => m.id)).toEqual(['shift']);
  });

  it('declares no graphics palette, so it stays out of paletteMachines', () => {
    // The 128-code set is ASCII, which has no block shapes. Adding a palette
    // here would also have to add the id to e2e/paletteMachines.ts, which
    // src/dialects/graphicsPalette.test.ts pins to the registry.
    expect(layout.graphicsPalette).toBeUndefined();
  });

  it('types the character its SYM cells actually send', () => {
    // The crosscheck that matters: SHIFT is a bit-4 flip, so SHIFT-K is `[`,
    // SHIFT-N is `↑` and SHIFT-7 is `'`. A legend copied from a modern
    // keyboard would insert one character and send another.
    let checked = 0;
    for (const layerId of ['symbols', 'symbols2']) {
      const idx = layout.layers.findIndex((l) => l.id === layerId);
      for (const key of layout.rows.flat()) {
        const label = key.labels[idx];
        if (!label?.emits?.length || !label.editor) continue;
        if (!('insert' in label.editor)) continue;
        const token = label.emits.find((t) => t !== 'Shift')!;
        expect(
          tokenToChar(charset, token, label.emits.includes('Shift')),
          `SYM ${label.text} via ${label.emits.join('+')}`,
        ).toBe(label.editor.insert);
        checked++;
      }
    }
    // Every canonical slot but `£`, which is not an ASCII character.
    expect(checked).toBe(27);
  });

  it('carries the two arrows the ASR-33 prints at 94 and 95', () => {
    // `↑` is the exponent operator and sits in the canonical `^` slot; `←`
    // sits in the `_` slot. Both positions are where a reader looks, and
    // neither `^` nor `_` exists on this machine to put there instead.
    const labels = layout.rows.flat().flatMap((k) => k.labels);
    const up = labels.find((l) => l?.text === '↑');
    expect(up?.editor).toEqual({ insert: '↑' });
    expect(up?.emits).toEqual(['Shift', 'KeyN']);
    const back = labels.find((l) => l?.text === '←');
    expect(back?.editor).toEqual({ insert: '←' });
    expect(back?.emits).toEqual(['Shift', 'KeyO']);
  });

  it('reaches every character the Teletype could print', () => {
    // This is where the machine parts company with its sibling: the GE-235's
    // six-bit set leaves `! # % & ' @` and the back arrow unreachable, and
    // here the codes are ASCII, so the keyboard covers 32 through 95 with
    // nothing left over for a host keyboard to supply.
    const typeable = new Set(dartmouthTypeableChars(charset));
    let printable = 0;
    for (let code = 0; code < 128; code++) {
      const ch = plainChar(code);
      if (ch === undefined) continue;
      printable++;
      expect(typeable.has(ch), `no key types "${ch}" (${code})`).toBe(true);
    }
    expect(printable, 'codes 32 through 95').toBe(64);

    // …and the keyboard offers all of them, rather than stopping at what the
    // adapter can translate.
    const offered = new Set<string>();
    for (const key of driving) {
      for (const layer of layout.layers) {
        const insert = insertOn(key, layer.id);
        if (insert !== null) offered.add(insert);
      }
    }
    for (const ch of typeable) {
      expect(offered.has(ch), `no keycap or SYM cell offers "${ch}"`).toBe(
        true,
      );
    }
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

  it('stays on the template grid', () => {
    expect(layout.gridColumns).toBe(GRID_COLUMNS);
    for (const row of layout.rows) {
      expect(row.reduce((n, k) => n + k.spanX, 0)).toBe(GRID_COLUMNS);
    }
    for (const key of layout.functionKeys ?? []) {
      expect(key.spanX).toBe(KEY_SPAN);
    }
  });
});
