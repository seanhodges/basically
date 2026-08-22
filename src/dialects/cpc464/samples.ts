import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const CPC464_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x8000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x8003,
} as const;

/**
 * CPC 464 example programs in Locomotive BASIC 1.0, offered when creating a
 * new project. `circles` exercises the Mode 0 graphics
 * statements (`ORIGIN`/`PLOT`/`DRAW`, per-`PLOT` ink), and `breakout`/`maze`
 * offer a keyboard/joystick menu, then read the cursor cluster through
 * `INKEY(n)` (so the on-screen controller drives them) or `JOY(0)`, with
 * `SOUND` for feedback. `kaleido` follows the cross-dialect pattern: BASIC
 * prompts for the parameters, POKEs them, and `CALL &8003`s the machine-code
 * routine (assembled from `samples/kaleido.asm` into a block at `&8000`) that
 * fills the Mode 0 screen with a four-way mirror.
 */
export const cpc464Samples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: CPC464_KALEIDO_BLOCK },
);
