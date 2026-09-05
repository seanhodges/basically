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

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const PMD85_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x7000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x7003,
} as const;

/**
 * Bundled BASIC-G programs - the canonical set every dialect here ships, in the
 * canonical order, ported to the PMD 85.
 *
 * Five things about this machine shape all five programs, and none of them is a
 * limitation of the port:
 *
 *  - **Graphics are drawn.** `hello` and `circles` use the drawing set the "G"
 *    in BASIC-G stands for: `SCALE` fixes a coordinate window and `MOVE`/`PLOT`
 *    draw in it. There are no graphics characters to print instead.
 *  - **`SCALE`'s window lands on 256x243 pixels**, not on a square. A window
 *    that is square in its own units therefore draws ovals, so `circles` and
 *    `hello` ask for 270 units across to 256 down and get round rings.
 *  - **There is no cursor addressing**, so both games write the frame buffer
 *    directly. A scanline is 64 bytes from the next and a byte is six pixels
 *    wide, which makes `POKE 'C000+64*L+C,63` one visible cell - and a paddle a
 *    single POKE, because consecutive addresses run across the screen. It is
 *    also how `maze` moves its marker without redrawing the map.
 *  - **`INKEY` sees only the twelve function keys**, returning 0-11 or 255 for
 *    none. That is the machine's whole key-at-a-time read, so `breakout` and
 *    `maze` are driven by K0-K3 rather than by letters. Which of those four
 *    means which direction is not free: the on-screen controller binds
 *    up/left/right/down to K0/K1/K2/K3 in `keyboardLayout.ts`, and a game that
 *    reads any other arrangement answers the pad's arrows with the wrong move.
 *  - **Two statements do not mean what their Microsoft spellings suggest.**
 *    `INPUT` takes no prompt string - `INPUT "SEED";S` is a hard Syntax err, so
 *    `kaleido` prints its prompts first. `PAUSE` counts in units of about a
 *    tenth of a second rather than milliseconds, so `PAUSE 255` is twenty-three
 *    seconds and the beat between `hello`'s two halves is `PAUSE 20`.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here, so a sample that
 * does not tokenize cleanly fails the build; `samples.test.ts` alongside runs
 * each one on the real ROM and checks what it draws, because tokenizing clean
 * and working are different things on this machine.
 */
export const pmd85Samples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: PMD85_KALEIDO_BLOCK },
);
