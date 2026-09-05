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
export const APPLE2PLUS_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x0300,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x0303,
} as const;

/**
 * The canonical sample set in Applesoft. Not ports of the sibling's: floating
 * point, `HGR`/`HCOLOR=`/`HPLOT` and real string arrays make these different
 * programs on the same machine.
 *
 * Four machine facts shape them, and each was read off this ROM rather than
 * assumed:
 *
 *  - **Hi-res is what this machine is remembered for, and Applesoft is what
 *    reaches it.** `HGR` opens 280 by 160 with four text lines under it,
 *    `HCOLOR=` picks one of eight colours and `HPLOT x,y TO x2,y2` draws a
 *    line, so `circles` and `kaleido` both work there. The sibling's Integer
 *    BASIC has none of those words and can only `CALL` into hi-res, so its
 *    versions of those two are lo-res programs.
 *  - **`circles` draws in white, and has to.** Hi-res colour is a choice of
 *    *which* dot columns a byte may light: green and violet reach one half of
 *    them and orange and blue the other, so a coloured line is drawn at half
 *    density and a coloured ring comes out dashed - measurably so, a 31 degree
 *    hole in the innermost. Only white lights every column. The sibling keeps
 *    three coloured rings because its lo-res page has sixteen real ones; this
 *    machine trades the colour for a ring that is actually closed.
 *  - **`hello` does not draw at all, on either screen.** The text page has no
 *    colour - the generator holds 64 shapes and the top two bits of a byte
 *    pick a video mode - and neither graphics mode can carry full-screen text,
 *    since both are mixed displays with a four-line text window. So the
 *    cascade shows the display off by cycling `NORMAL`, `FLASH` and `INVERSE`
 *    rather than painting a picture it would have to wipe to print over.
 *    `FLASH` is Applesoft's own twice over: it sets INVFLG *and* the bit COUT
 *    ORs in first, which is what lets a space or a star flash. An AND cannot
 *    raise a bit, so the sibling has no uniform flash and cascades in two
 *    modes where this one uses three.
 *  - **Lo-res is still the right screen for `breakout`.** `SCRN(` reads a cell
 *    back, so the wall the ball is knocking down *is* the screen and the game
 *    needs no brick array. That is the one place this set and the sibling's
 *    agree about the display, and it is because the reason is the same.
 *  - **String arrays hold the maze.** `DIM M$(21)` and `MID$` are Applesoft's,
 *    so the map is read out of `DATA` into an array and a wall test is a
 *    substring - where the sibling, whose strings are 255 characters and whose
 *    interpreter has no string array at all, has to `PEEK` the text page and
 *    carry the screen's interleave in the program.
 *  - **`ASC` returns the plain code and the keyboard latch sets bit 7.** The
 *    two are compared with an explicit `+ 128`, unlike the sibling's, where
 *    `ASC` sets the bit itself and the three forms compare directly.
 *
 * `HOME` is Applesoft's own: the sibling reaches the same routine as
 * `CALL -936` because Integer BASIC has no statement for clearing the screen.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here, so a sample that
 * does not tokenize cleanly fails the build; `samples.test.ts` alongside runs
 * each one on the real ROM and reads back what it drew, because tokenizing
 * clean and working are different things.
 */
export const apple2plusSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: APPLE2PLUS_KALEIDO_BLOCK },
);
