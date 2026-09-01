// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';

/**
 * Bundled example programs for the GE-235 - the canonical set, ported to
 * Dartmouth BASIC as it stood in February 1965.
 *
 * This machine carries three of the five, and both omissions are properties of
 * the hardware rather than gaps:
 *
 *  - no `breakout`, because a teletype gives a program no non-blocking key
 *    read (the Altair, ZX80, Apple 1 and Atom drop it for the same reason),
 *    and no way to repaint a frame either;
 *  - no `kaleido`, because the dialect supports no machine code at all, so
 *    there is no block for the sample to carry (the TRS-80 ships none either).
 *
 * Four things the three that remain had to be written around, none of them a
 * choice:
 *
 *  - **There are no strings.** A value is a number, and the only text a
 *    program can produce is a literal inside `PRINT`. So a picture is built in
 *    a numeric array and printed a character at a time, and a map is `DATA`
 *    holding one number per cell.
 *  - **`INPUT` reads numbers.** It takes a comma-separated list of numeric
 *    variables and nothing else, so the maze is steered by `1 2 3 4` rather
 *    than by the set's usual `W A S D` - a typed letter is the run-time's
 *    retype fault, not a move.
 *  - **There is no `#` in the character set**, so the maze's walls are `*`.
 *    The 64-code BCD set has no `!` either, which is why the win line ends in
 *    a full stop.
 *  - **Nothing can be redrawn.** The output is a paper roll, so one move
 *    reprints the whole map, as the Altair's and the Apple 1's do.
 *
 * The maze map is 13 by 9, which is 117 `DATA` constants against a run-time
 * data region of 256 words at two words a number - 128 constants in all, so
 * the map is most of what a program of this era could carry as a table.
 *
 * `samples.test.ts` alongside runs each one on the interpreter and reads the
 * paper back, because tokenizing clean and working are different things.
 */
export const ge235Samples: SampleFile[] = standardSamples({
  hello,
  circles,
  maze,
});
