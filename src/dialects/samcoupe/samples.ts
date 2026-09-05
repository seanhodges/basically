import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/**
 * The kaleidoscope routine's block layout (see samples/kaleido.asm).
 *
 * 0x7000 is in section B, the 16K of the Z80's window that HMPR does not move -
 * which is what lets the routine page the screen into sections C and D and keep
 * running. See `../memoryBlocks.ts`.
 */
export const SAMCOUPE_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x7000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x7003,
} as const;

/**
 * SAM Coupé example programs, offered when creating a new project.
 *
 * Two things the machine decides rather than the set:
 *
 * - **The controls are the keys 6, 7, 8 and 9, with 0 to fire.** The SAM wires
 *   its joystick port onto those matrix keys, so one set of tests serves the
 *   keyboard and the stick alike and there is no control menu to choose
 *   between them - which is why `breakout` gates on a key press and says so
 *   rather than offering a numbered menu.
 * - **`maze` and `circles` run in MODE 3, `hello` and `breakout` in MODE 4.**
 *   MODE 3 is the only mode with the 64 columns the shared 39-column map
 *   needs, and the only one whose pixels are square on the raster the IDE
 *   draws, so the rings come out round; MODE 4 is the sixteen-colour mode, and
 *   is what the two colour pieces want.
 */
export const samcoupeSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: SAMCOUPE_KALEIDO_BLOCK },
);
