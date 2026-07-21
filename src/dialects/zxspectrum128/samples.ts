import type { SampleFile } from '../types';
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
 * this set mirrors the shared canonical samples. The first is the starter for a
 * fresh document.
 */
export const spectrum128Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
  {
    name: 'kaleido.bas',
    title: 'Kaleidoscope',
    text: kaleido,
    blocks: [KALEIDO_BLOCK],
  },
];
