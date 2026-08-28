// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { atasciiToText } from './atascii';

/**
 * The graphics characters the Atari printed on the front of its keycaps, each
 * typed by holding CTRL and the key it is drawn on.
 *
 * Twenty-six of them are the letter keys, and they run in ATASCII order:
 * CTRL+A is `$01` and CTRL+Z is `$1A`, so the set is the low end of the
 * character table with the four suits scattered through it. The other three sit
 * on punctuation keys - `,` for the heart at `$00`, `.` for the diamond at
 * `$60` and `;` for the spade at `$7B` - which is why the codes here are not
 * one run.
 *
 * Every pairing below was read off the booted OS ROM rather than off a chart:
 * the key was pressed with CTRL held and the byte it left in screen memory
 * decoded back through {@link ../../emulator/atari/atariMachine}. The
 * `graphics.test.ts` beside this file does the same, so a wrong pairing fails
 * rather than quietly printing the wrong character.
 *
 * `char` is the exact Unicode the charset gives that code (see `./atascii`),
 * which is what makes this one table serve both the palette that types a
 * character and the charset that turns it back into a byte.
 */

/** `[keycap, ATASCII code]`, in the order the palette shows them. */
const CTRL_KEYS: Array<[string, number]> = [
  [',', 0x00],
  ['A', 0x01],
  ['B', 0x02],
  ['C', 0x03],
  ['D', 0x04],
  ['E', 0x05],
  ['F', 0x06],
  ['G', 0x07],
  ['H', 0x08],
  ['I', 0x09],
  ['J', 0x0a],
  ['K', 0x0b],
  ['L', 0x0c],
  ['M', 0x0d],
  ['N', 0x0e],
  ['O', 0x0f],
  ['P', 0x10],
  ['Q', 0x11],
  ['R', 0x12],
  ['S', 0x13],
  ['T', 0x14],
  ['U', 0x15],
  ['V', 0x16],
  ['W', 0x17],
  ['X', 0x18],
  ['Y', 0x19],
  ['Z', 0x1a],
  ['.', 0x60],
  [';', 0x7b],
];

/**
 * The matrix key ids behind the three punctuation keycaps. The letters are
 * their own token, so only these need naming.
 */
export const GRAPHIC_KEY_IDS: Record<string, string> = {
  ',': 'Comma',
  '.': 'Period',
  ';': 'Semicolon',
};

/**
 * Every CTRL graphic, the single source the palette and the charset share. The
 * character comes from the charset's own table, so the palette cannot offer a
 * glyph the tokenizer would read back as a different byte.
 */
export const ATARI_GRAPHICS: GraphicEntry[] = CTRL_KEYS.map(([key, code]) => ({
  key,
  modifier: 'CTRL',
  char: atasciiToText(code),
  code,
}));
