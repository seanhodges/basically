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
import { resolveEmits } from '../keyboard/editorActions';
import type { Dialect, MachineEmulator } from './types';

/**
 * The on-screen keyboard's cursor keys, proved against the real ROMs.
 *
 * The tokens are read out of each dialect's own layout rather than restated
 * here, so this fails if a CURSOR legend is ever wired back to the character
 * its keycap carries - which is what it did before these legends carried tokens
 * of their own, and which no amount of layout-shape checking would catch.
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
 * The layout's CURSOR legend for `arrow`: the tokens it presses, and the
 * character printed on the same keycap's base layer - what it would type if the
 * legend were ever wired back to the key's own cell. That character is a letter
 * on a machine whose arrows overlay letter keys, and a digit on the Sinclairs,
 * whose cursor keys are their 5/6/7/8 keys.
 */
function cursorLegend(
  dialect: Dialect,
  arrow: string,
): { tokens: string[]; base: string } {
  const layout = dialect.keyboardLayout;
  const mode = layout.editorModes?.find((m) => m.id === 'cursor');
  expect(mode, `${dialect.id} has no CURSOR mode`).toBeDefined();
  const idx = layout.layers.findIndex((l) => l.id === mode!.layer);
  const base = layout.layers.findIndex((l) => l.activeWhen.length === 0);
  for (const key of layout.rows.flat()) {
    if (key.labels[idx]?.text === arrow) {
      return {
        tokens: resolveEmits(layout, key, mode!.layer),
        base: (key.labels[base]?.text ?? '').toUpperCase(),
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
  ['atari800', 16, 'A', 'B'],
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
 * that matters - a cursor keycap presses a cursor key, not the character
 * printed under it.
 */
const NO_STRAY: [string, 16 | 32 | 64][] = [
  ['bbcmicro', 32],
  ['zxspectrum', 48],
];

describe('a cursor key types nothing', () => {
  for (const [id, ramKb] of NO_STRAY) {
    it(`${id} types nothing when a cursor key is pressed`, async () => {
      const dialect = getDialect(id)!;
      const machine = await bootMachine(dialect, { ramKb });
      await runFrames(machine, 300);

      for (const arrow of ['↑', '←', '↓', '→']) {
        const { tokens, base } = cursorLegend(dialect, arrow);
        const before = count(screenText(machine), base);
        await tap(machine, tokens);
        await runFrames(machine, 20);
        // Counted, and only upwards: these keys legitimately redraw the screen
        // (the BBC's copy cursor, the Spectrum's edit line clearing a boot
        // message that carries a digit one of its cursor keycaps is printed
        // with), so text may disappear - but none of them may add the
        // character the keycap carries.
        expect(
          count(screenText(machine), base),
          `${id} ${arrow}`,
        ).toBeLessThanOrEqual(before);
      }
    }, 60000);
  }
});

/**
 * Which machines each booted representative stands for.
 *
 * Only one machine per emulator wiring family is booted here - the ROMs are
 * slow and the wiring is what is at risk, each machine's own legend cells being
 * pinned in its keyboardLayout test. But a machine covered by nobody looked
 * exactly like a machine covered by its family until this table said which, so
 * every registered dialect is now claimed by exactly one representative or
 * excused by name, and a sixteenth machine has to join a family or start one.
 */
const CLAIMED: Record<string, string[]> = {
  /** viciious. */
  commodore64: ['commodore64', 'vic20'],
  /** The shared cpu6502 core. */
  pet: ['pet', 'atom'],
  /** The CPC's own Z80 run loop. */
  cpc464: ['cpc464', 'cpc6128'],
  /** 8080 object code through the shared i8080 layer. */
  pmd85: ['pmd85'],
  /** jsbeeb. */
  bbcmicro: ['bbcmicro', 'bbcmaster'],
  /** The self-contained Z80 machines under src/dialects/<id>/. */
  zxspectrum: ['zxspectrum', 'zxspectrum128', 'zx80', 'zx81'],
  /** ANTIC's own bus over the shared cpu6502 core - a family of its own, the
   *  way pmd85 is despite reusing the i8080 core. */
  atari800: ['atari800', 'atari400'],
};

/** Machines neither battery can reach, and why. */
const NO_CURSOR_KEYS: Record<string, string> = {
  // A front panel and a teletype: the layout has no CURSOR mode to read a
  // legend from, and the 8K BASIC image does not ship, so there would be
  // nothing to boot and watch either.
  altair8800: 'no cursor keys on the machine, and no ROM in this checkout',
  // The default backend interprets BASIC statements rather than scanning a key
  // matrix, so a cursor keypress reaches no ROM here to be shown moving - the
  // same reason it records no memory activity (see memoryActivity.test.ts).
  trs80: 'the interpreter backend runs no key matrix',
  // An ASCII keyboard sends one character per key and the machine has no
  // cursor addressing to move to: the monitor and Integer BASIC both edit a
  // line by rubbing the last character out, so there is no arrow to press.
  apple1: 'no cursor keys on the machine, and nothing on screen to move',
};

describe('every registered machine is covered by a cursor-key claim', () => {
  it('claims each dialect exactly once, or excuses it by name', () => {
    const claimed = Object.values(CLAIMED).flat();
    expect(new Set(claimed).size, 'a machine is claimed twice').toBe(
      claimed.length,
    );
    const covered = new Set([...claimed, ...Object.keys(NO_CURSOR_KEYS)]);
    expect(
      dialects.map((d) => d.id).filter((id) => !covered.has(id)),
      'claim the machine in CLAIMED under the representative whose wiring it ' +
        'shares, or excuse it in NO_CURSOR_KEYS with a reason',
    ).toEqual([]);
  });

  it('claims and excuses only registered dialects', () => {
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of [
      ...Object.keys(CLAIMED),
      ...Object.values(CLAIMED).flat(),
      ...Object.keys(NO_CURSOR_KEYS),
    ]) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });

  // The claims are only worth anything while each representative is really
  // booted by one of the two batteries below.
  it('boots every representative it claims a family for', () => {
    const booted = new Set([
      ...MOVES.map(([id]) => id),
      ...NO_STRAY.map(([id]) => id),
    ]);
    expect(
      Object.keys(CLAIMED).filter((id) => !booted.has(id)),
      'a representative claims a family but is never booted here',
    ).toEqual([]);
  });
});
