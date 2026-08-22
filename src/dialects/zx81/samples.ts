import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import breakout from './samples/breakout.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';

/**
 * ZX81 example programs, offered when creating a new project.
 * Kaleidoscope carries its Z80 routine as a hidden machine-code REM (the `#BIN`
 * line 1 in kaleido.bas); BASIC POKEs the parameters and RAND USR 16517s it -
 * see samples/kaleido.asm for the readable source.
 */
export const zx81Samples: SampleFile[] = standardSamples({
  hello,
  circles,
  breakout,
  maze,
  kaleido,
});
