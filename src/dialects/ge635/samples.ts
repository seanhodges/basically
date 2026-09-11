// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';

/**
 * Bundled example programs for the GE-635, written in Dartmouth BASIC's fourth
 * edition.
 *
 * This machine carries three of the five, and both omissions are the same
 * hardware facts that cost the GE-235 the same two:
 *
 *  - no `breakout`, because a teletype gives a program no non-blocking key
 *    read - the fourth edition adds no more of one than the 1965 language had
 *    (the Altair, ZX80, Apple 1 and Atom drop it for the same reason), and no
 *    way to repaint a frame either;
 *  - no `kaleido`, because the dialect supports no machine code at all, so
 *    there is no block for the sample to carry (the TRS-80 ships none either).
 *
 * Where these read differently from the GE-235's, it is the language rather
 * than the hardware doing it - the terminal is the same Model 33 in front of
 * both machines:
 *
 *  - **The maze is steered by `W A S D`.** Its sibling has to ask for `1 2 3 4`
 *    because a 1965 `INPUT` reads numbers and a typed letter is a retype
 *    fault; section 2.7's strings mean `INPUT A$` takes a letter here, so the
 *    controls are the set's own.
 *  - **The maze's map is string `DATA`, one quoted row a line**, rather than
 *    one number a cell. `CHANGE` is the only way into a string (2.7), so a row
 *    becomes a vector of codes, the marker is written in as code 79, and the
 *    row goes back to being a string to print - which is also why a repaint is
 *    eleven `PRINT`s rather than 231 of them, and why the map can be 21 by 11
 *    where the sibling's is 13 by 9.
 *  - **The walls are `#` and the win line ends in `!`.** Neither character
 *    exists in the GE-235's 64-code BCD set; this machine's codes are ASCII
 *    (2.7), so the house glyphs need no substitute.
 *  - **`hello` indents with `TAB`** rather than printing single spaces in a
 *    loop, `TAB` being a fourth-edition addition (2.1). The line it lays the
 *    cascade across is 75 columns, three wider than its sibling's.
 *
 * What is unchanged is what the machine still cannot do: there is nothing to
 * redraw, so one move reprints the whole map, as the Altair's and the
 * Apple 1's do.
 *
 * `samples.test.ts` alongside runs each one on the interpreter and reads the
 * paper back, because tokenizing clean and working are different things.
 */
export const ge635Samples: SampleFile[] = standardSamples({
  hello,
  circles,
  maze,
});
