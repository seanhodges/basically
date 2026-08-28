// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { atari800 } from './index';
import { atariKeyboardLayout } from './keyboardLayout';
import { ATARI_GRAPHICS, GRAPHIC_KEY_IDS } from './graphics';
import { atariCharset } from './charset';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  runUntil,
  screenText,
} from '../bootHarness';
import {
  ATARI_KEY_CODES,
  BREAK_TOKEN,
  CONSOLE_TOKENS,
  CTRL_TOKENS,
  SHIFT_TOKENS,
  cursorKey,
} from '../../emulator/atari/keyboard';
import { SYMBOL_LAYER_1, SYMBOL_LAYER_2 } from '../../keyboard/templateRows';
import type { MachineEmulator } from '../types';
import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The Atari keyboard, checked against the machine it drives.
 *
 * The layout rests on claims nothing else can see: that every token a keycap
 * emits is one POKEY's scan can produce, and that each SHIFT pair and CTRL
 * graphic really types the character the cap shows. A wrong pair looks right on
 * screen and types something else on the machine, so the second half of this
 * file presses each of them on the booted OS ROM and reads the echo back.
 *
 * The registry-wide batteries that do this for the shipped machines
 * (`src/dialects/symbolKeys.test.ts`, `caseKeys.test.ts`, `cursorKeys.test.ts`,
 * `src/keyboard/layoutGeometry.test.ts`) walk the registry, and these machines
 * are not in it yet - so the rules they impose are restated here against the
 * layout directly.
 */

/** Every token any keycap, legend, modifier or strip key can press. */
function emittedTokens(layout: KeyboardLayout): Set<string> {
  const tokens = new Set<string>();
  const keys = [
    ...layout.rows.flat(),
    ...(layout.functionKeys ?? []),
    ...(layout.controllerKeys ?? []),
  ];
  for (const key of keys) {
    for (const token of key.emits) tokens.add(token);
    for (const label of key.labels) {
      for (const token of label?.emits ?? []) tokens.add(token);
    }
  }
  for (const modifier of layout.modifiers) {
    for (const token of modifier.emits) tokens.add(token);
  }
  return tokens;
}

describe('the layout only presses keys the machine has', () => {
  it('emits nothing POKEY cannot report', () => {
    const known = new Set<string>([
      ...Object.keys(ATARI_KEY_CODES),
      ...SHIFT_TOKENS,
      ...CTRL_TOKENS,
      ...CONSOLE_TOKENS,
      BREAK_TOKEN,
      'CursorUp',
      'CursorDown',
      'CursorLeft',
      'CursorRight',
    ]);
    const unknown = [...emittedTokens(atariKeyboardLayout)].filter(
      (token) => !known.has(token),
    );
    expect(unknown, 'keycaps press keys this machine does not have').toEqual(
      [],
    );
  });

  it('reaches every matrix key, or says which it leaves off', () => {
    // HELP is in the matrix because the XL machines put a key on it; the 400
    // and the 800 never had one, so no keycap here presses it.
    const OFF_BOARD = new Set(['Help']);
    const pressed = emittedTokens(atariKeyboardLayout);
    // A cursor keycap presses the cursor token, which is CTRL over one of four
    // punctuation keys - so those four count as reached.
    for (const token of [...pressed]) {
      const punctuation = cursorKey(token);
      if (punctuation) pressed.add(punctuation);
    }
    const missing = Object.keys(ATARI_KEY_CODES).filter(
      (token) => !pressed.has(token) && !OFF_BOARD.has(token),
    );
    expect(missing).toEqual([]);
  });
});

describe('the graphics palette and the charset agree', () => {
  it('gives every CTRL graphic the character its code decodes to', () => {
    for (const entry of ATARI_GRAPHICS) {
      const where = `0x${entry.code.toString(16).padStart(2, '0')}`;
      expect([...atariCharset.toMachine(entry.char)], where).toEqual([
        entry.code,
      ]);
      expect(entry.modifier, where).toBe('CTRL');
    }
  });

  it('offers the whole CTRL set, once each', () => {
    const codes = ATARI_GRAPHICS.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    // $01-$1A on the letter keys, and the three suits that sit outside that run.
    expect(codes).toEqual([
      0x00,
      ...Array.from({ length: 26 }, (_, i) => i + 1),
      0x60,
      0x7b,
    ]);
  });
});

let restoreRomLoading: () => void;
beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});
afterAll(() => {
  restoreRomLoading();
});

/** Hold long enough for the OS's vertical-blank scan to see the key. */
const HOLD_FRAMES = 6;

async function tap(
  machine: MachineEmulator,
  tokens: readonly string[],
): Promise<void> {
  for (const token of tokens) machine.setKey(token, true);
  await runFrames(machine, HOLD_FRAMES);
  for (const token of tokens) machine.setKey(token, false);
  await runFrames(machine, HOLD_FRAMES);
}

/**
 * The character `tokens` puts on the screen.
 *
 * The cursor is an inverse space, which reads back as a space, so the first
 * cell the screen changed in is the one the character landed in. Compared cell
 * by cell rather than by string index: two of the graphics are astral-plane
 * characters, and a UTF-16 index would split their surrogate pairs.
 */
async function echo(
  machine: MachineEmulator,
  tokens: readonly string[],
): Promise<string> {
  const before = [...screenText(machine)];
  await tap(machine, tokens);
  const after = [...screenText(machine)];
  let i = 0;
  while (i < before.length && before[i] === after[i]) i++;
  return after[i] ?? '';
}

/**
 * Clear the screen - SHIFT over the `<` keycap - so the next character lands on
 * a fresh screen and a fresh logical line. The editor refuses input past three
 * screen rows of one logical line, and a full screen scrolls, either of which
 * would make {@link echo} read the wrong cell.
 */
async function clearScreen(machine: MachineEmulator): Promise<void> {
  await tap(machine, ['Shift', 'Less']);
}

/** Every mapped SYM cell: what it types and what it presses. */
function symbolCells(
  layout: KeyboardLayout,
): { insert: string; tokens: string[] }[] {
  const cells: { insert: string; tokens: string[] }[] = [];
  for (const layerId of [SYMBOL_LAYER_1, SYMBOL_LAYER_2]) {
    const idx = layout.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) continue;
    for (const key of layout.rows.flat()) {
      const label = key.labels[idx];
      if (!label?.emits?.length) continue;
      if (!label.editor || !('insert' in label.editor)) continue;
      cells.push({ insert: label.editor.insert, tokens: label.emits });
    }
  }
  return cells;
}

describe('what the keycaps say, on the booted ROM', () => {
  it('types the characters it prints', async () => {
    const machine = await bootMachine(atari800);
    try {
      expect(
        await runUntil(machine, () => /Ready/i.test(screenText(machine))),
        'the machine never reached its prompt',
      ).toBe(true);
      await clearScreen(machine);

      // The SYM pages, each cell pressing its own key or SHIFT pair, then the
      // palette, each cell pressing CTRL and the key its graphic is printed on.
      const typed = [
        ...symbolCells(atariKeyboardLayout).map((cell) => ({
          tokens: cell.tokens,
          char: cell.insert,
        })),
        ...ATARI_GRAPHICS.map((entry) => ({
          tokens: ['Ctrl', GRAPHIC_KEY_IDS[entry.key!] ?? entry.key!],
          char: entry.char,
        })),
      ];
      for (const [i, cell] of typed.entries()) {
        // The editor takes three screen rows of one logical line and then
        // refuses, so the screen is cleared well inside that.
        if (i % 20 === 0) await clearScreen(machine);
        expect(
          await echo(machine, cell.tokens),
          `${cell.tokens.join('+')} should type ${cell.char}`,
        ).toBe(cell.char);
      }
      await clearScreen(machine);

      // The case lock: capitals at power-on, lower case behind CAPS, and back
      // with SHIFT+CAPS - the pair the keycap's shifted legend presses.
      expect(await echo(machine, ['A'])).toBe('A');
      await tap(machine, ['CapsLock']);
      expect(await echo(machine, ['B'])).toBe('b');
      expect(await echo(machine, ['Shift', 'C'])).toBe('C');
      await tap(machine, ['Shift', 'CapsLock']);
      expect(await echo(machine, ['D'])).toBe('D');
      await clearScreen(machine);

      // The CURSOR overlay: the four tokens the W/A/S/D legends press really
      // are the machine's cursor keys, not the letters underneath them. Each
      // move is proved by the cell the next character lands in - the cursor
      // itself is an inverse space, which reads back as a space like any other.
      const cell = (row: number, col: number): string =>
        [...(machine.readScreenText()?.lines[row] ?? '')][col] ?? '';
      // The screen editor keeps a two-column left margin, so a cleared screen
      // puts the cursor at column 2.
      await tap(machine, ['X']);
      expect(cell(0, 2)).toBe('X');
      await tap(machine, ['CursorRight']);
      await tap(machine, ['Y']);
      expect(cell(0, 3)).toBe(' ');
      expect(cell(0, 4)).toBe('Y');
      await tap(machine, ['CursorDown']);
      await tap(machine, ['Z']);
      expect(cell(1, 5)).toBe('Z');
      await tap(machine, ['CursorUp']);
      await tap(machine, ['W']);
      expect(cell(0, 6)).toBe('W');
      await tap(machine, ['CursorLeft']);
      await tap(machine, ['CursorLeft']);
      await tap(machine, ['V']);
      expect(cell(0, 5)).toBe('V');
    } finally {
      machine.dispose?.();
    }
  }, 120000);
});
