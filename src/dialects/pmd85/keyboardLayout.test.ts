// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pmd85KeyboardLayout } from './keyboardLayout';
import { splitRomImage } from './romImage';
import { Pmd85Machine } from './emulator/pmd85Machine';
import { DISPLAYED_BYTES_PER_LINE, VIDEO_RAM_STRIDE } from './emulator/display';
import {
  PMD85_KEY_TOKENS,
  Pmd85Keyboard,
  tokenForHostCode,
} from './emulator/keyboard';
import { resolveEditorAction } from '../../keyboard/editorActions';
import { KEY_SPAN, ROW_KEYS } from '../../keyboard/templateRows';
import type { KeyDef } from '../../keyboard/layoutSchema';

const layout = pmd85KeyboardLayout;
const keys = [...layout.rows.flat(), ...(layout.functionKeys ?? [])];
/** Every key that drives the matrix; template spacers emit nothing. */
const driving = keys.filter((k) => k.emits.length > 0);
/** A key's own tokens plus any its legends press in place of them. */
const allTokens = (key: KeyDef): string[] => [
  ...key.emits,
  ...key.labels.flatMap((l) => l?.emits ?? []),
];

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85.rom')),
);

/**
 * The Monitor's key-code table, at 0x82D0 - the one place the machine itself
 * says what is printed on a keycap.
 *
 * Ten lines of sixteen bytes. The first byte is the port B pattern the line
 * answers: bit 5 is SHIFT and bits 0-4 the matrix row's five keys, all active
 * low, so exactly one of bits 0-4 is clear and bit 5 says whether SHIFT was
 * held. The fifteen bytes after it are the character codes for the fifteen
 * matrix columns, in column order. The Monitor scans the ten lines for the one
 * matching what it read, which is why they are in no particular order here and
 * why this parses them by their mask rather than by position.
 */
const KEY_TABLE = 0x02d0; // ROM offset of 0x82D0
const TABLE_LINES = 10;
const LINE_BYTES = 16;
const SHIFT_BIT = 0x20;
/** Selectable matrix rows: the fifteen key columns plus the modifier row. */
const MATRIX_ROWS = 16;

/** [row bit, shifted] -> the fifteen column codes. */
const codeTable = new Map<string, number[]>();
for (let line = 0; line < TABLE_LINES; line++) {
  const at = KEY_TABLE + line * LINE_BYTES;
  const mask = rom[at]!;
  const bit = [0, 1, 2, 3, 4].find((b) => (mask & (1 << b)) === 0);
  codeTable.set(`${bit}:${(mask & SHIFT_BIT) === 0}`, [
    ...rom.subarray(at + 1, at + LINE_BYTES),
  ]);
}

/** The character the Monitor sends for a matrix cell, or null where it sends none. */
function romChar(row: number, bit: number, shifted: boolean): string | null {
  const code = codeTable.get(`${bit}:${shifted}`)?.[row];
  if (code === undefined || code < 0x20 || code > 0x7e) return null;
  return String.fromCharCode(code);
}

/**
 * Where each token sits in the matrix, read back out of the emulator rather
 * than restated here: press the key on a bare {@link Pmd85Keyboard} and see
 * which row read has a bit pulled low. SHIFT and STOP are common to every row
 * and so answer nothing in bits 0-4, which is why they have no entry.
 */
const position = new Map<string, { row: number; bit: number }>();
{
  const keyboard = new Pmd85Keyboard();
  for (const token of PMD85_KEY_TOKENS) {
    keyboard.releaseAll();
    keyboard.setKey(token, true);
    for (let row = 0; row < MATRIX_ROWS; row++) {
      const read = keyboard.readRow(row);
      const bit = [0, 1, 2, 3, 4].find((b) => (read & (1 << b)) === 0);
      if (bit !== undefined) {
        position.set(token, { row, bit });
        break;
      }
    }
  }
}

/**
 * The `KeyboardEvent.code`s a full PC keyboard produces - the whole vocabulary
 * the host route has to work with. Listed here rather than derived, because the
 * question the test asks is exactly "which of these does a real browser send",
 * and only a person can answer that.
 */
const HOST_CODES: readonly string[] = [
  ...Array.from({ length: 26 }, (_, i) => `Key${String.fromCharCode(65 + i)}`),
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
  'Space',
  'Enter',
  'NumpadEnter',
  'Backspace',
  'Tab',
  'Escape',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'Minus',
  'Equal',
  'BracketLeft',
  'BracketRight',
  'Backslash',
  'Semicolon',
  'Quote',
  'Backquote',
  'Comma',
  'Period',
  'Slash',
];

/**
 * The dialogue line, decoded through the Monitor's own character generator -
 * the only way to see what a keypress produced, since the character never
 * exists anywhere the host can read it directly.
 *
 * What the user types goes here rather than into the text grid: the Monitor
 * puts 28 rows of glyphs on a nine-scanline pitch from scanline 1, and then
 * keeps this one editing line below all of them, at the bottom of the frame.
 */
const DIALOGUE_TOP = 246;
const GLYPH_ROWS = 8;

function dialogueLine(video: Uint8Array): string {
  let line = '';
  for (let col = 0; col < DISPLAYED_BYTES_PER_LINE; col++) {
    const rows = Array.from(
      { length: GLYPH_ROWS },
      (_, i) => video[(DIALOGUE_TOP + i) * VIDEO_RAM_STRIDE + col]! & 0x3f,
    );
    line += font.get(rows.join(',')) ?? '?';
  }
  return line.trimEnd();
}

/** The Monitor's 6x8 font by pixel rows: 0x20-0x5F at 0x8600, 0x60-0x7F at 0x88C0. */
const font = new Map<string, string>();
for (let code = 0x20; code <= 0x7f; code++) {
  const base =
    (code < 0x60 ? 0x0600 - 0x20 * 8 : 0x08c0 - 0x60 * 8) + code * GLYPH_ROWS;
  font.set(
    Array.from({ length: GLYPH_ROWS }, (_, i) => rom[base + i]! & 0x3f).join(
      ',',
    ),
    String.fromCharCode(code),
  );
}

/** The editor text a key inserts on a layer, or null when it inserts nothing. */
function insertOn(key: KeyDef, layerId: string): string | null {
  const action = resolveEditorAction(layout, key, layerId);
  return action && 'insert' in action ? action.insert : null;
}

describe('pmd85 keyboard layout', () => {
  it('offers the three cursor keys the machine has, and no fourth', () => {
    // The Monitor's key-code table gives the cell below |<- no code in either
    // shift state, so there is no down key to put on S.
    const cursorIdx = layout.layers.findIndex((l) => l.id === 'cursor');
    const legends = new Map<string, KeyDef>();
    for (const key of layout.rows.flat()) {
      const text = key.labels[cursorIdx]?.text;
      if (text) legends.set(text, key);
    }
    expect([...legends.keys()].sort()).toEqual(['←', '↑', '→']);
    expect(legends.get('←')!.labels[cursorIdx]!.emits).toEqual(['ArrowLeft']);
    expect(legends.get('↑')!.labels[cursorIdx]!.emits).toEqual(['ArrowUp']);
    expect(legends.get('→')!.labels[cursorIdx]!.emits).toEqual(['ArrowRight']);
  });

  it('labels DEL as the delete key it presses, not as a backspace', () => {
    // The machine has no backspace at all - the Monitor sends 0x08 from `←`,
    // which is CURSOR mode's left arrow - so this cap must not borrow a `⌫`.
    const del = layout.rows.flat().find((k) => k.id === 'Del')!;
    expect(del.emits).toEqual(['Del']);
    expect(del.labels[0]?.text).toBe('DEL');
    expect(resolveEditorAction(layout, del, 'base')).toEqual({
      action: 'delete',
    });
  });

  it('emits only tokens the emulator setKey accepts', () => {
    // The layout and `emulator/keyboard.ts` are two halves of one vocabulary: a
    // key emitting a token the matrix does not know presses nothing at all, and
    // the failure is silent.
    const known = new Set(PMD85_KEY_TOKENS);
    for (const key of driving) {
      // Including the CURSOR legends' own tokens, which bypass `emits`.
      for (const token of allTokens(key)) {
        expect(known.has(token), `${key.id} emits unknown "${token}"`).toBe(
          true,
        );
      }
    }
  });

  it('reaches every matrix key from the keyboard or the host', () => {
    // The union the layout is allowed to rely on. The machine's keyboard is
    // fifteen columns wide and the template's bands are ten, so the editing
    // block, STOP and the symbols BASIC-G has no use for are typed on the host
    // instead of taking a keycap. A token reachable by neither route is a key
    // of the real machine this IDE cannot press at all.
    const emitted = new Set(driving.flatMap(allTokens));
    const fromHost = new Set(
      HOST_CODES.map((code) => tokenForHostCode(code)).filter(
        (t): t is string => t !== null,
      ),
    );
    for (const token of PMD85_KEY_TOKENS) {
      expect(
        emitted.has(token) || fromHost.has(token),
        `no key and no host code reaches "${token}"`,
      ).toBe(true);
    }
  });

  it('keeps the twelve function keys and WRK on the strip, and nothing else', () => {
    // K0-K11 have to be here and nowhere else: nothing on a host keyboard
    // produces them, so the strip is their only route in. WRK selects their
    // second bank and belongs with them; C-D and CLR are editing keys, and
    // every key they were added to the strip cost a share of its width.
    const strip = (layout.functionKeys ?? []).map((k) => k.id);
    expect(strip).toEqual([
      ...Array.from({ length: 12 }, (_, i) => `K${i}`),
      'WRK',
    ]);
  });

  it('stays on the template’s grid, in width and in keys to a row', () => {
    // The whole point of the shared template: a PMD 85 keycap is the same size
    // as a Spectrum's. This machine's own keyboard is fifteen columns wide, so
    // the temptation to widen the grid for it is real and was once given in to.
    expect(layout.gridColumns).toBe(40);
    for (const row of layout.rows.slice(0, 4)) {
      expect(row.filter((k) => k.emits.length > 0)).toHaveLength(10);
    }
    // …and so is the strip: a K key is a keycap like any other. More function
    // keys than a board is wide is the one thing this machine has that the
    // template has no room for, and they are the reason the strip scrolls -
    // it is the only registered machine that puts that path on screen.
    const strip = layout.functionKeys ?? [];
    for (const key of strip) expect(key.spanX).toBe(KEY_SPAN);
    expect(strip.length).toBeGreaterThan(ROW_KEYS);
  });

  it('gives STOP no keycap', () => {
    // It stops a running program, which is what the toolbar's stop control is
    // for, and it sat under the space bar at the width of a SHIFT.
    const ids = new Set(keys.map((k) => k.id));
    expect(ids.has('Stop')).toBe(false);
    expect(tokenForHostCode('ControlLeft')).toBe('Stop');
  });

  it('prints the legend the Monitor actually sends', () => {
    // The crosscheck that matters. Every printing legend is compared with the
    // Monitor's own code table, so the QWERTZ swap, the SHIFT-gives-lower-case
    // inversion and the machine's own symbol pairings are all pinned to the
    // ROM rather than to whoever typed this file.
    let checked = 0;
    for (const key of driving) {
      if (key.modifier) continue;
      const at = position.get(key.emits[0]!);
      if (!at) continue;
      for (const [layerId, shifted] of [
        ['base', false],
        ['shift', true],
      ] as const) {
        const insert = insertOn(key, layerId);
        if (insert === null) continue;
        const expected = romChar(at.row, at.bit, shifted);
        expect(insert, `${key.id} on ${layerId}`).toBe(expected);
        checked++;
      }
    }
    // Both layers of every printing key: four full bands of ten, the three
    // symbol keys the bands could not keep, and the space bar.
    expect(checked).toBe(2 * (10 * 4 + 3 + 1));
  });

  it('is QWERTZ, and types capitals unshifted', () => {
    // The two facts a reader is most likely to take for a typo. Stated
    // separately from the sweep above so a regression names itself.
    const legend = (id: string, layer: number): string | undefined =>
      driving.find((k) => k.id === id)?.labels[layer]?.text;
    expect(legend('KeyY', 0)).toBe('Z');
    expect(legend('KeyZ', 0)).toBe('Y');
    expect(legend('KeyQ', 0)).toBe('Q');
    expect(legend('KeyQ', 1)).toBe('q');
  });

  it('offers base, SHIFT and CURSOR layers, and no graphics palette', () => {
    // The machine has no block graphics at all - see charset.ts - so it must
    // stay out of e2e/paletteMachines.ts, which graphicsPalette.test.ts pins to
    // the dialects that declare a palette.
    expect(layout.layers.map((l) => l.id)).toEqual(['base', 'shift', 'cursor']);
    expect(layout.editorModes?.map((m) => m.id)).toEqual(['abc', 'cursor']);
    expect(layout.graphicsPalette).toBeUndefined();
  });

  it('types onto a running machine within its own hold time', () => {
    // The layout's `minHoldFrames` is a claim about the Monitor's scan rate, so
    // it is proved against the Monitor: three keys tapped for exactly that many
    // frames each have to reach the screen. A hold too short for the scan drops
    // characters silently, which reads as a broken matrix.
    const hold = layout.options?.minHoldFrames ?? 1;
    const pmd = new Pmd85Machine(splitRomImage(rom));
    pmd.bootToReady();
    for (const token of ['KeyP', 'KeyR', 'KeyI']) {
      pmd.setKey(token, true);
      for (let frame = 0; frame < hold; frame++) pmd.runFrame();
      pmd.setKey(token, false);
      for (let frame = 0; frame < hold; frame++) pmd.runFrame();
    }
    for (let frame = 0; frame < 10; frame++) pmd.runFrame();
    expect(dialogueLine(pmd.mem.videoRam)).toBe('PRI');
  });

  it('fills its grid exactly on every row', () => {
    for (const [i, row] of layout.rows.entries()) {
      const span = row.reduce((n, k) => n + k.spanX, 0);
      expect(span, `row ${i}`).toBe(layout.gridColumns);
    }
  });
});
