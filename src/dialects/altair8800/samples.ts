// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const ALTAIR8800_KALEIDO_BLOCK = {
  name: 'kaleido',
  /**
   * Not `memoryBlocks.defaultAddress` (0xB000), and the difference matters:
   * 8K BASIC's `POKE` converts its address through the signed 16-bit
   * conversion the rest of the interpreter uses, so anything at or above
   * 32768 has to be written as a negative number and 45056 is a hard
   * `?FC ERROR`. 0x7000 is high above the program and its variables, well
   * clear of the string pool at the top of memory, and small enough for a
   * sample to POKE in decimal without explaining two's complement first.
   */
  address: 0x7000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x7003,
} as const;

/**
 * Bundled example programs for the Altair - the canonical set every dialect
 * ships, in the canonical order, ported to Altair 8K BASIC.
 *
 * This machine forces the hardest "degrade gracefully" call in the project,
 * because it has no graphics of any kind: no PLOT, no SET, no block characters,
 * not even a cursor-addressable screen - only `PRINT` to a scrolling terminal.
 * Three consequences run through what is here, and one decides what is not:
 *
 *  - **`circles` plots into a grid and prints it**, with the vertical axis
 *    halved because a terminal cell is 8x16 - twice as tall as it is wide - so
 *    a circle plotted 1:1 would come out as an ellipse. The grid is numeric
 *    rather than a string array on purpose: 8K BASIC allocates only 50 bytes of
 *    string space until a program says otherwise.
 *  - **It also has to be quick about it, which is why only a quarter of each
 *    ring is integrated.** Nothing can appear until the last ring is plotted -
 *    a scrolling terminal cannot go back and fill a row in - so every step of
 *    the recurrence is a step the user spends looking at a blank screen, and
 *    this interpreter runs about 610 BASIC loop iterations a second. Mirroring
 *    a quarter turn into the other three cuts the wait to about five seconds
 *    for the same three closed rings; the whole picture lands in ten. The
 *    heading printed before the plotting starts is there for the same reason:
 *    on this machine there is otherwise no sign that `RUN` did anything.
 *  - **There is no non-blocking key read**, so `maze` is driven by `INPUT`: one
 *    typed line is one turn. 8K BASIC has no `INKEY$`, and polling the 2SIO
 *    with `INP` does not help - BASIC checks the same port for CTRL-C between
 *    every statement and would eat the keystroke first.
 *  - **There is no `breakout`.** The two facts above compound past the point
 *    where a paddle game is one: a real-time ball needs a key read this machine
 *    will not give a program, and with no cursor addressing every frame is a
 *    whole map reprinted that scrolls the previous one off the top. Turn-based
 *    is honest for `maze`, which is turn-based on every machine; for `breakout`
 *    it is a scoreboard with a typed control column, not a game anyone plays.
 *    The ZX80, the Atom and the Apple 1 drop the same sample, the first two for
 *    the key read alone.
 *
 * `kaleido` carries {@link ALTAIR8800_KALEIDO_BLOCK}, and reaches it the only
 * way this BASIC can: `USR(x)` calls one fixed vector and passes `x` as data,
 * so the program POKEs {@link import('./addresses').USR_VECTOR} (decimal 73 and
 * 74) at the routine's entry first. The routine prints its own picture through
 * the 88-2SIO rather than plotting one, since there is no screen memory to
 * plot into.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here, so a sample that
 * does not tokenize cleanly fails the build; `samples.test.ts` alongside runs
 * each one on the real image and reads back what it printed, because tokenizing
 * clean and working are different things.
 */
export const altair8800Samples: SampleFile[] = standardSamples(
  { hello, circles, maze, kaleido },
  { kaleidoBlock: ALTAIR8800_KALEIDO_BLOCK },
);
