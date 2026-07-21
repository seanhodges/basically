import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import breakout from './samples/breakout.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x8000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x8003,
} as const;

/** ZX Spectrum example programs; the first is the starter for a fresh document. */
export const spectrumSamples: SampleFile[] = [
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
