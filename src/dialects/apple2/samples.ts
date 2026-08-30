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
export const APPLE2_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x0300,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x0303,
} as const;

/**
 * The canonical sample set in Integer BASIC.
 *
 * **All five, `breakout` included.** The Apple I drops it because any keypress
 * stops a running Integer BASIC program there; here a key sets a flag and
 * nothing more, so `PEEK(-16384)` reads the latch without waiting and
 * `POKE -16368,0` clears the strobe. That pair is the loop every real Apple II
 * game was built on and it is what `breakout` and `maze` both poll.
 *
 * Four machine facts shape the rest, and each was read off the machine rather
 * than assumed:
 *
 *  - **Lo-res is the display worth showing.** `GR` gives a 40 by 40 grid of
 *    sixteen colours with four lines of text under it, `COLOR=`/`PLOT`/`HLIN`
 *    draw into it and `SCRN(` reads a cell back - so `breakout` needs no brick
 *    array, the wall it is knocking down *is* the screen. Hi-res is out of
 *    reach: Integer BASIC has no `HGR`, only `CALL`.
 *  - **A lo-res cell is 7 dots wide and 4 tall.** `circles` scales its columns
 *    by 1792 rather than 1024 for that reason; a ring drawn on square cells
 *    would come out half as wide as it is tall.
 *  - **A string holds 255 characters.** The shared 21 by 39 maze map is 819, so
 *    `maze` prints it once and then treats the screen as the map, `PEEK`ing the
 *    text page to test a wall. The interleave that makes row `r` start at
 *    `1024+128*(R MOD 8)+40*(R/8)` is in the program, because it has to be.
 *  - **`ASC` returns the character with bit 7 set**, which is exactly the form
 *    the keyboard latch and the text page both hold, so `IF K=ASC("W")` needs
 *    no arithmetic between the three.
 *
 * `CALL -936` is the monitor's HOME. It appears wherever a program needs the
 * screen cleared, because Integer BASIC has no statement for it: `GR` clears
 * the graphics half and `TEXT` clears nothing at all.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here, so a sample that
 * does not tokenize cleanly fails the build; `samples.test.ts` alongside runs
 * each one on the real ROM and reads back what it drew, because tokenizing
 * clean and working are different things.
 */
export const apple2Samples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: APPLE2_KALEIDO_BLOCK },
);
