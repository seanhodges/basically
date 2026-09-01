// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { ge235KeyboardLayout } from './keyboardLayout';
import {
  ge235KeyTokens,
  ge235TypeableChars,
  tokenToChar,
} from './interpreter/keyboard';
import { plainChar } from './charset';
import { resolveEditorAction } from '../../keyboard/editorActions';
import { GRID_COLUMNS, KEY_SPAN } from '../../keyboard/templateRows';
import type { KeyDef } from '../../keyboard/layoutSchema';

const layout = ge235KeyboardLayout;
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

describe('ge235 keyboard layout', () => {
  it('emits a token for every key the teletype adapter can translate', () => {
    // The layout and `interpreter/keyboard.ts` are two halves of one
    // vocabulary: a key emitting a token the adapter does not know queues
    // nothing at all, and the failure is silent.
    const known = new Set(ge235KeyTokens());
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
    for (const token of ge235KeyTokens()) {
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
    // keycap would press nothing. The Altair keeps one because 8K BASIC
    // breaks a program on CTRL-C.
    expect(layout.modifiers.map((m) => m.id)).toEqual(['shift']);
  });

  it('declares no graphics palette, so it stays out of paletteMachines', () => {
    // There are no block shapes in the 64-code set - see charset.ts. Adding a
    // palette here would also have to add the id to e2e/paletteMachines.ts,
    // which src/dialects/graphicsPalette.test.ts pins to the registry.
    expect(layout.graphicsPalette).toBeUndefined();
  });

  it('types the character its SYM cells actually send', () => {
    // The crosscheck that matters: the ASR-33's SHIFT is a bit-4 flip, so
    // SHIFT-K is `[`, SHIFT-N is `↑` and SHIFT-4 is `$`. A legend copied from
    // a modern keyboard would insert one character and send another.
    let checked = 0;
    for (const layerId of ['symbols', 'symbols2']) {
      const idx = layout.layers.findIndex((l) => l.id === layerId);
      for (const key of layout.rows.flat()) {
        const label = key.labels[idx];
        if (!label?.emits?.length || !label.editor) continue;
        if (!('insert' in label.editor)) continue;
        const token = label.emits.find((t) => t !== 'Shift')!;
        expect(
          tokenToChar(token, label.emits.includes('Shift')),
          `SYM ${label.text} via ${label.emits.join('+')}`,
        ).toBe(label.editor.insert);
        checked++;
      }
    }
    expect(checked).toBe(20);
  });

  it('carries the up arrow this BASIC raises to a power with', () => {
    // `↑` is the one SYM cell that is an operator rather than punctuation, and
    // it sits in the canonical `^` slot because that is the position a reader
    // looks in - there is no `^` on this machine to put there instead.
    const arrow = layout.rows
      .flat()
      .flatMap((k) => k.labels)
      .find((l) => l?.text === '↑');
    expect(arrow?.editor).toEqual({ insert: '↑' });
    expect(arrow?.emits).toEqual(['Shift', 'KeyN']);
  });

  it('reaches every character the Teletype could print', () => {
    // The 64-code set has 57 printable characters, and every one of them is
    // typeable: the letters and digits on their keycaps, the rest through the
    // SYM pages. A character the machine can punch and the keyboard cannot
    // reach would have to be typed on a host keyboard instead.
    const typeable = new Set(ge235TypeableChars());
    for (let code = 0; code < 64; code++) {
      const ch = plainChar(code);
      if (ch === undefined) continue;
      expect(
        typeable.has(ch),
        `no key types "${ch}" (0o${code.toString(8)})`,
      ).toBe(true);
    }

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
