// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';
import keysAsm from './samples/keys.asm?raw';

/**
 * The key-scanner the two games share (see samples/keys.asm), at the same
 * address the kaleidoscope uses - no sample carries both.
 */
export const SORCERER_KEYS_BLOCK = {
  name: 'keys',
  address: 0x7000,
  kind: 'code',
  asmSource: keysAsm,
  entry: 0x7001,
} as const;

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const SORCERER_KALEIDO_BLOCK = {
  name: 'kaleido',
  /**
   * `memoryBlocks.defaultAddress`, and it has to be somewhere like it: this
   * interpreter's `POKE` takes a signed 16-bit address, so a block at or above
   * 32768 could not be poked in decimal at all - the positive form is a hard
   * `?FC ERROR`. 0x7000 is far above the program and its variables and far
   * below the string pool at the top of memory.
   */
  address: 0x7000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x7003,
} as const;

/**
 * Bundled example programs for the Sorcerer - the canonical set every dialect
 * ships, in the canonical order, ported to Exidy Standard BASIC.
 *
 * Exidy Standard BASIC is a Microsoft 8K BASIC with nothing added for the
 * screen: no `CLS`, no `PLOT`, no `PRINT AT`, no `INKEY$`, and no sound at all.
 * What the machine does have is 64x30 character cells of screen RAM the video
 * hardware scans directly, a graphics set in the character generator, and four
 * I/O ports. Four consequences run through every program here:
 *
 *  - **Drawing is `POKE` into screen RAM at -3968.** That is 0xF080 written the
 *    only way this interpreter accepts an address above 32767: as a negative
 *    number. `circles`, `maze` and `breakout` all plot that way, and each move
 *    repaints only the cells that changed - a whole-screen repaint is around
 *    1900 `POKE`s, which is half a minute of this interpreter's time.
 *  - **Clearing the screen is `PRINT CHR$(12)`.** The Monitor's screen driver
 *    takes the ASCII control codes of the cursor keys it reads: 12 clears, and
 *    1, 19, 23 and 26 are the CTRL+A/S/W/Z moves.
 *  - **Reading a key without waiting takes twenty bytes of machine code.**
 *    There is no `INKEY$`, and the obvious replacement does not work: a
 *    program can select a keyboard line by writing its number to port 254 and
 *    read that line's five keys back from the same port, but between every two
 *    statements the interpreter asks the Monitor whether a break key is down,
 *    which selects line 1, then line 0, and leaves line 0 selected. Measured on
 *    the booted ROM, `OUT 254,3 : K=INP(254)` reads the line it asked for twice
 *    in two hundred tries. So the two games carry
 *    {@link SORCERER_KEYS_BLOCK} - a scan whose write and read are two
 *    instructions apart - and read the byte it leaves at 28672.
 *  - **The movement keys are W, A, S and Z, not W A S D.** They are the
 *    Monitor's own cursor diamond - CTRL with those four keys is how the
 *    machine moves its cursor - and the on-screen controller binds to them
 *    (`keyboardLayout.ts`), so the pad and the keyboard agree.
 *
 * `circles` plots into the character grid rather than into pixels, because
 * there are none: a cell is 8x8 dots, so a ring of radius R cells is 8R canvas
 * pixels across *and* down and comes out round. `breakout` and `maze` are the
 * full games rather than typed-input substitutes, which is what the scanner
 * buys; `hello` shows off the one thing this display has that a teletype does
 * not, which is a graphics set and 64 columns to lay it out in. What no sample
 * has is sound: the Sorcerer's only noisemaker is whatever a program drives
 * through the parallel port.
 *
 * `kaleido` is the exception to the scanner, because it carries a block of its
 * own at the same address. Its wait for "another picture" polls SHIFT instead,
 * with no `OUT` at all - line 0 is the one line a BASIC program can rely on
 * reading, for the reason above.
 *
 * `kaleido` carries {@link SORCERER_KALEIDO_BLOCK} and reaches it the way this
 * BASIC reaches any machine code: `USR(x)` calls one fixed vector, so the
 * program POKEs 260 and 261 - the address field of the JP at 259 in the
 * interpreter's control area - at the routine's entry first.
 */
export const sorcererSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: SORCERER_KALEIDO_BLOCK },
).map((sample) =>
  sample.name === 'maze.bas' || sample.name === 'breakout.bas'
    ? { ...sample, blocks: [SORCERER_KEYS_BLOCK] }
    : sample,
);
