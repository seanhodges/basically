import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import breakout from './samples/breakout.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/**
 * The kaleidoscope routine's block layout (see samples/kaleido.asm). Placed at
 * $2E00 (well below every screen mode's RAM), so selecting a mode doesn't
 * clobber it. Shared by the BBC Micro and Master dialects.
 */
export const BBC_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x2e00,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x2e03,
} as const;

/** BBC Micro example programs, offered when creating a new project. */
export const bbcSamples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: BBC_KALEIDO_BLOCK },
);
