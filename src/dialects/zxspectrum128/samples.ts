import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
// The 128K BASIC and Z80 are identical to the 48K, so the Kaleidoscope reuses
// the 48K program text and its machine-code block verbatim (same $8000 block,
// same $5800 attribute file).
import kaleido from '../zxspectrum/samples/kaleido.bas?raw';
import { KALEIDO_BLOCK } from '../zxspectrum/samples';

/**
 * ZX Spectrum 128K example programs. The language is identical to the 48K, so
 * this set mirrors the shared canonical samples. Offered when creating a new
 * project.
 */
export const spectrum128Samples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: KALEIDO_BLOCK },
);
