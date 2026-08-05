// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';

/**
 * Bundled example programs for the Altair - the canonical set every dialect
 * ships, in the canonical order, ported to Altair 8K BASIC.
 *
 * This machine forces the hardest "degrade gracefully" call in the project,
 * because it has no graphics of any kind: no PLOT, no SET, no block characters,
 * not even a cursor-addressable screen - only `PRINT` to a scrolling terminal.
 * Two consequences run through all five programs:
 *
 *  - **The visual samples plot into a grid and print it.** `circles` and
 *    `kaleido` fill a numeric array and then print it a character at a time,
 *    with the vertical axis halved because a terminal cell is 8x16 - twice as
 *    tall as it is wide - so a circle plotted 1:1 would come out as an ellipse.
 *    The grid is numeric rather than a string array on purpose: 8K BASIC
 *    allocates only 50 bytes of string space until a program says otherwise, and
 *    the character each cell prints is assigned from a literal (`C$="*"`), which
 *    points into the program text and costs no string space at all.
 *  - **There is no non-blocking key read**, so `breakout` and `maze` are driven
 *    by `INPUT`: one typed line is one frame. 8K BASIC has no `INKEY$`, and
 *    polling the 2SIO with `INP` does not help - BASIC checks the same port for
 *    CTRL-C between every statement and would eat the keystroke first. The ZX80
 *    and Atom drop `breakout` outright for want of a key read; here it survives
 *    as a turn-based game, which is what the machine can honestly offer.
 *
 * `kaleido` ships **without** a machine-code block: this dialect has no
 * established convention for carrying one (no `USR` block wiring yet), and the
 * TRS-80 sets the precedent for a set without one.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here, so a sample that
 * does not tokenize cleanly fails the build; `samples.test.ts` alongside checks
 * the set, the maze's solvability and the keyword-as-variable trap.
 */
export const altair8800Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
  { name: 'kaleido.bas', title: 'Kaleidoscope', text: kaleido },
];
