import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const PET_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x7000,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x7003,
} as const;

/**
 * Commodore PET example programs, ported to the monochrome 40x25 machine (screen
 * RAM at 32768/$8000, no colour, no SID) and offered when creating a new
 * project. `circles` degrades to PETSCII character plotting since the PET has
 * no bitmap.
 */
export const petSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: PET_KALEIDO_BLOCK },
);
