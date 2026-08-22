import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';

/**
 * ZX80 example programs, offered when creating a new project.
 * Kaleidoscope carries its Z80 routine as a hidden machine-code REM (the `#BIN`
 * line 1 in kaleido.bas); BASIC POKEs the parameters and USR(16430)s it - see
 * samples/kaleido.asm for the readable source.
 */
export const zx80Samples: SampleFile[] = standardSamples({
  hello,
  circles,
  maze,
  kaleido,
});
