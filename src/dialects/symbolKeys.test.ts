// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects, getDialect } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  screenText,
} from './bootHarness';
import type { KeyboardLayout } from '../keyboard/layoutSchema';
import type { Dialect, MachineEmulator } from './types';
import { SYMBOL_LAYER_1, SYMBOL_LAYER_2 } from '../keyboard/templateRows';

/**
 * The SYM mode's symbol cells, proved against the real ROMs: each machine's
 * table claims a key combination for every symbol it maps, and the claims
 * are data nothing else cross-checks - a wrong shift pair would show the
 * canonical legend while typing a different character on the machine.
 * So every mapped cell is pressed on the booted machine and the character
 * it echoes is read back off the screen.
 *
 * Unlike the cursor-key battery, one machine per wiring family is not
 * enough here: the table under test is per-machine data, so every machine
 * with its own table boots. Variants that reuse a parent's layout
 * (vic20, cpc664, cpc6128, zxspectrum128, bbcmaster) are covered by the
 * parent.
 */

let restoreRomLoading: () => void;
beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});
afterAll(() => {
  restoreRomLoading();
});

/** Hold long enough for any of these machines' ROMs to scan the matrix. */
const HOLD_FRAMES = 5;

async function tap(machine: MachineEmulator, tokens: string[]): Promise<void> {
  for (const token of tokens) machine.setKey(token, true);
  await runFrames(machine, HOLD_FRAMES);
  for (const token of tokens) machine.setKey(token, false);
  await runFrames(machine, HOLD_FRAMES);
}

/** Every mapped SYM cell: what it shows, types, and presses. */
function symbolCells(
  layout: KeyboardLayout,
): { text: string; insert: string; tokens: string[] }[] {
  const cells: { text: string; insert: string; tokens: string[] }[] = [];
  for (const layerId of [SYMBOL_LAYER_1, SYMBOL_LAYER_2]) {
    const idx = layout.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) continue;
    for (const key of layout.rows.flat()) {
      const label = key.labels[idx];
      if (!label?.text || !label.emits?.length) continue;
      if (!label.editor || !('insert' in label.editor)) continue;
      cells.push({
        text: label.text,
        insert: label.editor.insert,
        tokens: label.emits,
      });
    }
  }
  return cells;
}

const count = (haystack: string, ch: string): number =>
  haystack.split(ch).length - 1;

/**
 * The forms a typed symbol may echo as. Bitmap machines are OCRed by char
 * code, so a machine glyph that differs from ASCII at its code point (the
 * Spectrum's ↑ at 0x5E, £ at 0x60) reads back as the ASCII character; text
 * charsets echo the charset's own form. Accept either.
 */
function echoForms(dialect: Dialect, insert: string): string[] {
  const forms = new Set([insert]);
  try {
    const codes = [...dialect.charset.toMachine(insert)];
    if (codes.length === 1 && codes[0]! >= 0x20 && codes[0]! <= 0x7e)
      forms.add(String.fromCharCode(codes[0]!));
  } catch {
    // No machine form; the insert text is the only candidate.
  }
  return [...forms];
}

/**
 * Machines with a bootable ROM in this checkout and their RAM fit, `null`
 * where the machine has no choice to make and ignores the size (the Apple I's
 * 4K is soldered on the board; the Altair's memory is whatever S-100 boards
 * the dialect commits to). The TRS-80's default backend interprets BASIC
 * without a key matrix, so its table is pinned by its own keyboardLayout test
 * instead.
 *
 * The Altair earns its place here despite having no key matrix at all: its
 * layout maps a token straight to a serial byte, so this is the only check that
 * follows one the whole way to a character on the terminal.
 */
const BOOTABLE: [string, 16 | 32 | 48 | 64 | null][] = [
  ['altair8800', null],
  ['zx80', 16],
  ['zx81', 16],
  ['zxspectrum', 48],
  ['atom', 32],
  ['bbcmicro', 32],
  ['cpc464', 64],
  ['commodore64', 64],
  ['pet', 32],
  ['pmd85', 64],
  ['apple1', null],
  ['apple2', null],
  ['atari800', null],
];

/** Machines whose tables are proved elsewhere, and by what. */
const EXCUSED: Record<string, string> = {
  trs80: 'no key matrix - the input adapter is exercised in its layout test',
  vic20: 'reuses the commodore64 layout',
  cpc664: 'reuses the cpc464 layout',
  cpc6128: 'reuses the cpc464 layout',
  zxspectrum128: 'reuses the zxspectrum layout',
  bbcmaster: 'reuses the bbcmicro layout',
  atari400: 'reuses the atari800 layout',
};

describe('every registered machine is covered', () => {
  it('boots here, or is excused by name', () => {
    const covered = new Set([
      ...BOOTABLE.map(([id]) => id),
      ...Object.keys(EXCUSED),
    ]);
    expect(
      dialects.map((d) => d.id).filter((id) => !covered.has(id)),
      'boot the machine in BOOTABLE, or excuse it in EXCUSED with where its ' +
        'table is proved instead',
    ).toEqual([]);
  });
});

describe('every SYM cell types its own character on the machine', () => {
  for (const [id, ramKb] of BOOTABLE) {
    const dialect = getDialect(id)!;
    const cells = symbolCells(dialect.keyboardLayout);

    it(`${id} echoes every mapped symbol`, async () => {
      expect(cells.length, `${id} maps no SYM cells`).toBeGreaterThan(10);
      const machine = await bootMachine(
        dialect,
        ramKb === null ? {} : { ramKb: ramKb as 16 | 32 | 64 },
      );
      await runFrames(machine, 300);

      for (const cell of cells) {
        const forms = echoForms(dialect, cell.insert);
        const tally = (screen: string) =>
          forms.reduce((n, f) => n + count(screen, f), 0);
        const before = tally(screenText(machine));
        await tap(machine, cell.tokens);
        await runFrames(machine, 10);
        expect(
          tally(screenText(machine)),
          `${id} '${cell.text}' via [${cell.tokens.join('+')}] typed ` +
            `nothing new; screen tail: ${JSON.stringify(
              screenText(machine).trimEnd().slice(-80),
            )}`,
        ).toBeGreaterThan(before);
      }
    }, 120000);
  }
});
