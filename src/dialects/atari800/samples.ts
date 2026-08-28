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

/**
 * The kaleidoscope routine's block layout (see samples/kaleido.asm). Page 6 is
 * the free 256 bytes both machines have between the OS's buffers and BASIC's
 * workspace, so one address serves the 16K 400 and the 48K 800 alike.
 */
export const ATARI_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x0600,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x0603,
} as const;

/**
 * The bundled example programs, shared by both Atari dialects.
 *
 * One set for the two machines, as the BBC pair does: they run the same
 * cartridge and differ only in fitted RAM, so the greeting names the family
 * rather than either model - `HELLO FROM THE ATARI`.
 *
 * Two things about these programs are the machine's rather than a choice. The
 * games offer the joystick beside the keyboard because the Atari's own game
 * interface is its port, and their keyboard half is W A S D, the set's answer
 * for a machine with no keyboard cluster of its own. And nothing prints in
 * column 39: the screen editor treats a character written there as the end of
 * a logical line and pushes the rest of the screen down a row, so the paddle
 * stops one column short of the right wall and the ball turns there.
 */
export const atariSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: ATARI_KALEIDO_BLOCK },
);
