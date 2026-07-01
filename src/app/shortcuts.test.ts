// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import {
  SHORTCUTS,
  getShortcut,
  matchesShortcut,
  formatShortcut,
  formatAllShortcuts,
  type Combo,
} from './shortcuts';

/** Build a minimal KeyboardEvent-shaped object for the matcher. */
function ev(
  code: string,
  mods: Partial<Omit<Combo, 'code'>> = {},
): KeyboardEvent {
  return {
    code,
    ctrlKey: !!mods.mod,
    metaKey: false,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
  } as KeyboardEvent;
}

const serialize = (k: Combo) =>
  `${k.mod ? 'M' : ''}${k.alt ? 'A' : ''}${k.shift ? 'S' : ''}:${k.code}`;

describe('SHORTCUTS table', () => {
  it('has no duplicate chords', () => {
    const seen = new Map<string, string>();
    for (const s of SHORTCUTS) {
      for (const k of s.keys) {
        const key = serialize(k);
        const prev = seen.get(key);
        expect(
          prev,
          `chord ${key} used by both "${prev}" and "${s.id}"`,
        ).toBeUndefined();
        seen.set(key, s.id);
      }
    }
  });

  it('has unique ids', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('matchesShortcut', () => {
  it('matches the exact modifier combination', () => {
    const newDoc = getShortcut('file.new'); // Mod+Alt+N
    expect(matchesShortcut(ev('KeyN', { mod: true, alt: true }), newDoc)).toBe(
      true,
    );
    // Missing Alt, extra Shift, or wrong key all reject.
    expect(matchesShortcut(ev('KeyN', { mod: true }), newDoc)).toBe(false);
    expect(
      matchesShortcut(
        ev('KeyN', { mod: true, alt: true, shift: true }),
        newDoc,
      ),
    ).toBe(false);
    expect(matchesShortcut(ev('KeyM', { mod: true, alt: true }), newDoc)).toBe(
      false,
    );
  });

  it('treats Cmd (metaKey) as Mod too', () => {
    const save = getShortcut('file.save'); // Mod+S
    const cmdS = {
      code: 'KeyS',
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      altKey: false,
    } as KeyboardEvent;
    expect(matchesShortcut(cmdS, save)).toBe(true);
  });

  it('distinguishes Undo from Redo by Shift', () => {
    const undo = getShortcut('edit.undo'); // Mod+Z
    const redo = getShortcut('edit.redo'); // Mod+Shift+Z
    expect(matchesShortcut(ev('KeyZ', { mod: true }), undo)).toBe(true);
    expect(matchesShortcut(ev('KeyZ', { mod: true }), redo)).toBe(false);
    expect(matchesShortcut(ev('KeyZ', { mod: true, shift: true }), redo)).toBe(
      true,
    );
  });

  it('matches any of several chords (Run = F5 or Mod+Enter)', () => {
    const run = getShortcut('run.play');
    expect(matchesShortcut(ev('F5'), run)).toBe(true);
    expect(matchesShortcut(ev('Enter', { mod: true }), run)).toBe(true);
    expect(matchesShortcut(ev('Enter'), run)).toBe(false);
  });
});

describe('formatShortcut', () => {
  it('renders Windows/Linux labels', () => {
    expect(formatShortcut(getShortcut('file.new'), false)).toBe('Ctrl+Alt+N');
    expect(formatShortcut(getShortcut('view.settings'), false)).toBe('Ctrl+,');
    expect(formatShortcut(getShortcut('run.stop'), false)).toBe('Shift+F5');
    expect(formatShortcut(getShortcut('run.step'), false)).toBe('F10');
  });

  it('renders macOS symbol labels', () => {
    expect(formatShortcut(getShortcut('file.new'), true)).toBe('⌥⌘N');
    expect(formatShortcut(getShortcut('edit.outline'), true)).toBe('⇧⌘O');
    expect(formatShortcut(getShortcut('view.settings'), true)).toBe('⌘,');
  });

  it('lists all chords for a multi-chord shortcut', () => {
    expect(formatAllShortcuts(getShortcut('run.play'), false)).toBe(
      'F5 / Ctrl+Enter',
    );
  });
});
