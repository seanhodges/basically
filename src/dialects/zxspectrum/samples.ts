import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
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

/** ZX Spectrum example programs, offered when creating a new project. */
export const spectrumSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: KALEIDO_BLOCK },
);
