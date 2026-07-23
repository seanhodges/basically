import type { SampleFile } from '../types';
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
 * CPC 464 example programs in Locomotive BASIC 1.0; the first is the starter
 * shown for a fresh document. `circles` exercises the Mode 0 graphics
 * statements (`ORIGIN`/`PLOT`/`DRAW`, per-`PLOT` ink), and `breakout`/`maze`
 * read the cursor keys through `INKEY(n)` so the on-screen controller (bound to
 * the cursor cluster) drives them. `kaleido` follows the cross-dialect pattern:
 * BASIC prompts for the parameters, POKEs them, and `CALL &8003`s the
 * machine-code routine (assembled from `samples/kaleido.asm` into a block at
 * `&8000`) that fills the Mode 0 screen with a four-way mirror.
 */
export const cpc464Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
  {
    name: 'kaleido.bas',
    title: 'Kaleidoscope',
    text: kaleido,
    blocks: [CPC464_KALEIDO_BLOCK],
  },
];
