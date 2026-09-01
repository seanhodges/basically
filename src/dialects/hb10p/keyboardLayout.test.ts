// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hb10pKeyboardLayout as layout } from './keyboardLayout';
import { hb10pGraphics } from './graphics';
import { hb10pCharset } from './charset';
import { CODE_TO_TOKEN, MATRIX } from '../../emulator/msx/keyboard';
import { resolveEmits } from '../../keyboard/editorActions';
import { SYMBOL_LAYER_1, SYMBOL_LAYER_2 } from '../../keyboard/templateRows';
import type { KeyDef } from '../../keyboard/layoutSchema';

/**
 * The layout's claims about the machine, checked against the machine.
 *
 * Two of them are data nothing else crosschecks: which key combination reaches
 * a symbol, and which reaches a graphics character. Both are answered by the
 * BIOS's own key-decoding tables - six 48-byte tables from 0x0DA5, one per
 * modifier state, each indexed by (matrix row x 8 + bit) over rows 0-5 - so
 * every cell below is looked up in the ROM rather than in a layout diagram.
 * The geometry is not tested here: the registry batteries in
 * `src/keyboard/layoutGeometry.test.ts` own that for every machine at once.
 */

const ROM_PATH = join(__dirname, '../../../public/roms/msx/hb10p.rom');
const hasRom = existsSync(ROM_PATH);
const romSuite = hasRom ? describe : describe.skip;

/** The BIOS key tables, in the order the scanner selects them. */
const TABLE_BASE = 0x0da5;
const TABLE_SIZE = 48;
const TABLES = ['plain', 'shift', 'graph', 'graph-shift'] as const;
type TableName = (typeof TABLES)[number];

function keyTable(name: TableName): Uint8Array {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const at = TABLE_BASE + TABLES.indexOf(name) * TABLE_SIZE;
  return rom.subarray(at, at + TABLE_SIZE);
}

/** token -> the index the BIOS tables are read at, for the character rows. */
const INDEX_OF = new Map<string, number>();
for (const [row, cells] of MATRIX.entries()) {
  for (const [bit, token] of cells.entries()) {
    if (token) INDEX_OF.set(token, row * 8 + bit);
  }
}

/** The byte the BIOS decodes for a key combination, or null if it has none. */
function decode(tokens: readonly string[]): number | null {
  const shift = tokens.includes('Shift');
  const graph = tokens.includes('Graph');
  const key = tokens.find((t) => t !== 'Shift' && t !== 'Graph');
  const index = key === undefined ? undefined : INDEX_OF.get(key);
  if (index === undefined || index >= TABLE_SIZE) return null;
  const table = graph
    ? shift
      ? 'graph-shift'
      : 'graph'
    : shift
      ? 'shift'
      : 'plain';
  const code = keyTable(table)[index]!;
  return code === 0 ? null : code;
}

const everyKey = (): KeyDef[] => [
  ...layout.rows.flat(),
  ...(layout.functionKeys ?? []),
  ...(layout.controllerKeys ?? []),
];

describe('hb10p keyboard layout', () => {
  it('reaches every matrix token from a keycap or a host key', () => {
    // A cell the emulator can press that nothing can press is a key the
    // machine has and this IDE does not offer. The numeric keypad is the one
    // exception: the HB-10P has no keypad, and its rows read as all-released.
    const reachable = new Set<string>(Object.values(CODE_TO_TOKEN));
    for (const key of everyKey()) {
      for (const token of key.emits) reachable.add(token);
      for (const [i, layer] of layout.layers.entries()) {
        if (key.labels[i])
          for (const t of resolveEmits(layout, key, layer.id)) {
            reachable.add(t);
          }
      }
    }
    const missing = MATRIX.flat()
      .filter((t): t is string => t !== null && !t.startsWith('Num'))
      .filter((t) => !reachable.has(t));
    expect(missing, 'unreachable matrix cells').toEqual([]);
  });

  it('presses nothing but the matrix from the function key strip', () => {
    // F6-F10 are the same five cells with SHIFT held, which is how the machine
    // itself reaches them - there is no sixth function key in the matrix.
    const strip = layout.functionKeys!;
    expect(strip).toHaveLength(10);
    for (const [i, key] of strip.entries()) {
      const expected = i < 5 ? [`F${i + 1}`] : ['Shift', `F${i - 4}`];
      expect(key.emits, key.id).toEqual(expected);
      expect(key.labels[0]?.editor, key.id).toBeNull();
    }
  });

  it('offers the graphics palette entries the charset maps', () => {
    const palette = layout.graphicsPalette!.sections.flatMap((s) => s.entries);
    // The palette is grouped by modifier for display; the exported table is in
    // code order. Same cells either way, and neither may gain one of its own.
    const byCode = (a: { code: number }, b: { code: number }) =>
      a.code - b.code;
    expect([...palette].sort(byCode)).toEqual([...hb10pGraphics].sort(byCode));
    for (const entry of palette) {
      expect(entry.char, `0x${entry.code.toString(16)}`).toBe(
        hb10pCharset.glyph(entry.code),
      );
      // Every cell is a block graphic, and every block graphic is one byte the
      // charset round-trips: a palette cell that typed two bytes would be a
      // control-code pair rather than a character.
      expect(entry.code).toBeGreaterThanOrEqual(0xc0);
      expect(entry.code).toBeLessThanOrEqual(0xdf);
      expect([...hb10pCharset.toMachine(entry.char)], entry.char).toEqual([
        entry.code,
      ]);
    }
    expect(new Set(palette.map((e) => e.code)).size).toBe(palette.length);
  });
});

romSuite('hb10p keyboard combinations against the BIOS tables', () => {
  it('reaches each SYM symbol by the combination the ROM decodes to it', () => {
    let checked = 0;
    for (const layerId of [SYMBOL_LAYER_1, SYMBOL_LAYER_2]) {
      const idx = layout.layers.findIndex((l) => l.id === layerId);
      if (idx < 0) continue;
      for (const key of layout.rows.flat()) {
        const label = key.labels[idx];
        if (!label?.text || !label.emits?.length) continue;
        if (!label.editor || !('insert' in label.editor)) continue;
        const insert = label.editor.insert;
        expect(
          decode(label.emits),
          `${insert} via [${label.emits.join('+')}]`,
        ).toBe(hb10pCharset.toMachine(insert)[0]);
        checked++;
      }
    }
    expect(checked, 'the SYM pages map nothing').toBeGreaterThan(20);
  });

  it('reaches each graphics character by its printed GRAPH combination', () => {
    for (const entry of hb10pGraphics) {
      const tokens =
        entry.modifier === 'GRAPH+SHIFT'
          ? ['Graph', 'Shift', entry.key!]
          : ['Graph', entry.key!];
      expect(
        decode(tokens),
        `${entry.char} via ${entry.modifier}+${entry.key}`,
      ).toBe(entry.code);
    }
  });

  it('starts in the case its base legends are written in', () => {
    // powerOnCase says the unshifted letter keys type lower case, which is what
    // the BIOS's plain table holds for the letter cells; the case lock is what
    // flips it, and `caseKeys.test.ts` proves that on the booted machine once
    // the dialect is registered.
    expect(layout.powerOnCase).toBe('lower');
    expect(decode(['A'])).toBe('a'.charCodeAt(0));
    expect(decode(['Shift', 'A'])).toBe('A'.charCodeAt(0));
  });
});
