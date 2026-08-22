// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getDialect } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  screenText,
} from './bootHarness';
import { resolveEmits } from '../keyboard/editorActions';
import type { Dialect, MachineEmulator } from './types';

/**
 * The on-screen keyboard's cursor keys, proved against the real ROMs.
 *
 * The tokens are read out of each dialect's own layout rather than restated
 * here, so this fails if a CURSOR legend is ever wired back to the letter its
 * keycap carries - which is what it did before these legends carried tokens of
 * their own, and which no amount of layout-shape checking would catch.
 *
 * One machine per emulator wiring family: viciious (C64), cpu6502 (PET), the
 * CPC's own core, and the 8080 (PMD 85) all show the moved cursor in their
 * editors. The jsbeeb and self-contained-Z80 families cannot show it the same
 * way - see the second block - so their matrix cells are pinned in their own
 * keyboardLayout tests instead.
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

/**
 * The layout's CURSOR legend for `arrow`: the tokens it presses, and the letter
 * printed on the same keycap's base layer - what it would type if the legend
 * were ever wired back to the key's own cell.
 */
function cursorLegend(
  dialect: Dialect,
  arrow: string,
): { tokens: string[]; letter: string } {
  const layout = dialect.keyboardLayout;
  const mode = layout.editorModes?.find((m) => m.id === 'cursor');
  expect(mode, `${dialect.id} has no CURSOR mode`).toBeDefined();
  const idx = layout.layers.findIndex((l) => l.id === mode!.layer);
  const base = layout.layers.findIndex((l) => l.activeWhen.length === 0);
  for (const key of layout.rows.flat()) {
    if (key.labels[idx]?.text === arrow) {
      return {
        tokens: resolveEmits(layout, key, mode!.layer),
        letter: (key.labels[base]?.text ?? '').toUpperCase(),
      };
    }
  }
  throw new Error(`${dialect.id} has no ${arrow} cursor legend`);
}

const count = (haystack: string, ch: string): number =>
  haystack.toUpperCase().split(ch).length - 1;

/**
 * id, RAM, and the two letter keys used to type "AA" then "B" - the Commodore
 * and Amstrad matrices name their letter cells by the letter itself, the others
 * by DOM-style codes.
 */
const MOVES: [string, 16 | 32 | 64, string, string][] = [
  ['commodore64', 64, 'A', 'B'],
  ['pet', 32, 'A', 'B'],
  ['cpc464', 64, 'A', 'B'],
  ['pmd85', 64, 'KeyA', 'KeyB'],
];

describe("the on-screen cursor keys move the machine's own cursor", () => {
  for (const [id, ramKb, letterA, letterB] of MOVES) {
    it(`${id} takes the cursor back over what was typed`, async () => {
      const dialect = getDialect(id)!;
      const machine = await bootMachine(dialect, { ramKb });
      await runFrames(machine, 300);

      await tap(machine, [letterA]);
      await tap(machine, [letterA]);
      await tap(machine, cursorLegend(dialect, '←').tokens);
      await tap(machine, [letterB]);
      await runFrames(machine, 30);

      // The second A is gone: the cursor went back over it and B took its
      // place. Without the cursor key the line would read AAB.
      expect(screenText(machine).toUpperCase()).toContain('AB');
      expect(screenText(machine).toUpperCase()).not.toContain('AAB');
    }, 60000);
  }
});

/**
 * Machines whose editors do not show the move: the BBC's cursor keys start its
 * copy editor rather than moving the write cursor, and the Spectrum's open its
 * edit line, redrawing the boot screen. What both still prove is the regression
 * this change fixes - a cursor keycap presses a cursor key, not the letter
 * printed under it, which is exactly what these keys used to do.
 */
const NO_STRAY: [string, 16 | 32 | 64][] = [
  ['bbcmicro', 32],
  ['zxspectrum', 48],
];

describe('a cursor key types nothing', () => {
  for (const [id, ramKb] of NO_STRAY) {
    it(`${id} puts no letter on screen when a cursor key is pressed`, async () => {
      const dialect = getDialect(id)!;
      const machine = await bootMachine(dialect, { ramKb });
      await runFrames(machine, 300);

      for (const arrow of ['↑', '←', '↓', '→']) {
        const { tokens, letter } = cursorLegend(dialect, arrow);
        const before = count(screenText(machine), letter);
        await tap(machine, tokens);
        await runFrames(machine, 20);
        // Counted rather than compared whole: these keys legitimately redraw
        // the screen (the BBC's copy cursor, the Spectrum's edit line), but
        // neither may add the letter the keycap carries.
        expect(count(screenText(machine), letter), `${id} ${arrow}`).toBe(
          before,
        );
      }
    }, 60000);
  }
});
