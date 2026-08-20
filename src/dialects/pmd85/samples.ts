// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';
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
 * Three things about this machine shape all five, and none of them is a
 * limitation of the port:
 *
 *  - **Graphics are drawn.** `hello` and `circles` use the drawing set the "G"
 *    in BASIC-G stands for: `SCALE` fixes a coordinate window and `MOVE`/`PLOT`
 *    draw in it. There are no graphics characters to print instead.
 *  - **There is no cursor addressing**, so the two games write the frame buffer
 *    directly. A scanline is 64 bytes from the next and a byte is six pixels
 *    wide, which makes `POKE 'C000+64*L+C,63` one visible cell - and a paddle a
 *    single POKE, because consecutive addresses run across the screen.
 *  - **`INKEY` sees only the twelve function keys**, returning 0-11 or 255 for
 *    none. That is the machine's whole key-at-a-time read, so `breakout` and
 *    `maze` are driven by K0-K3 rather than by letters, and the on-screen
 *    controller is bound to those keys in `keyboardLayout.ts`.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here, so a sample that
 * does not tokenize cleanly fails the build; `samples.test.ts` alongside checks
 * the set, the maze's solvability, the keyword-as-variable trap and that the
 * kaleidoscope block assembles and really draws a mirror.
 */
export const pmd85Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
  {
    name: 'kaleido.bas',
    title: 'Kaleidoscope',
    text: kaleido,
    blocks: [PMD85_KALEIDO_BLOCK],
  },
];
