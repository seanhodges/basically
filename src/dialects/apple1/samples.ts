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
export const APPLE1_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x0300,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x0303,
} as const;

/**
 * The canonical sample set, ported to Integer BASIC against the tightest budget
 * in the project. Four facts about the machine shape all of them, and each was
 * read off it rather than assumed:
 *
 *  - **The display takes one character per video field.** The shift register
 *    has to rotate once for a character to go in, so the machine writes sixty
 *    characters a second and BASIC waits on it. A whole screenful is sixteen
 *    seconds. Every program here is written to that budget, and `circles` and
 *    `kaleido` both print each cell as they decide it, so the next one is
 *    worked out inside a wait that was going to happen anyway.
 *  - **There is no cursor addressing.** Carriage return is the only code the
 *    display decodes, so nothing can be redrawn in place: `circles` plots into
 *    RAM and prints the grid once, and `maze` prints the whole map again after
 *    every move.
 *  - **Any keypress stops a running program.** The interpreter's own run loop
 *    takes the key and reports `STOPPED AT`, so a program cannot poll the
 *    keyboard at all - `INPUT` is the only read there is. That is why `maze` is
 *    a letter and a RETURN per move, and why there is **no `breakout`**: a
 *    real-time paddle needs a key read this machine will not give a program,
 *    and it would need to redraw a screen it cannot address either. The ZX80
 *    and the Atom drop the same sample for the first of those reasons alone.
 *  - **2048 bytes hold the program and its variables together**, and a name is
 *    one letter with at most one digit. Both are why the programs are short and
 *    why their working variables read as they do.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here, so a sample that
 * does not tokenize cleanly fails the build; `samples.test.ts` alongside runs
 * each one on the real ROM and reads back what it drew, because tokenizing
 * clean and working are different things.
 */
export const apple1Samples: SampleFile[] = standardSamples(
  { hello, circles, maze, kaleido },
  { kaleidoBlock: APPLE1_KALEIDO_BLOCK },
);
