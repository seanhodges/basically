// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleBlockDef, SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/**
 * Bundled MSX BASIC programs - the canonical set every dialect here ships, in
 * the canonical order, ported to this machine.
 *
 * What the machine forced, and nothing else. The controls are the cursor
 * cluster and the space bar, because that is exactly what MSX BASIC's own
 * STICK(0) and STRIG(0) read, and the same two statements read the joystick
 * port with the argument changed from 0 to 1 - so `breakout` and `maze` offer
 * the choice as a menu rather than picking one. `maze` and `kaleido` run in
 * SCREEN 0, which is the only text screen wide enough for the shared
 * 39-column map, and `hello` and `circles` in SCREEN 2, where MSX BASIC's
 * PRINT does not work at all: `hello` reaches the graphics screen through the
 * `GRP:` device instead, which is how the machine itself puts coloured text on
 * a picture. Every sample opens with KEY OFF where it uses the whole screen,
 * the bottom row being the function-key strip until it does.
 */
export const HB10P_KALEIDO_BLOCK: SampleBlockDef = {
  name: 'kaleido',
  address: 0xe000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0xe003,
};

export const hb10pSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: HB10P_KALEIDO_BLOCK },
);
