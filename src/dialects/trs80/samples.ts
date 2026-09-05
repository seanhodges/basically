import type { SampleFile } from '../types';
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';

/**
 * TRS-80 example programs, ported to Level II BASIC (SET/RESET/POINT
 * block graphics, INKEY$, no colour/sound) and offered when creating a new
 * project.
 */
export const trs80Samples: SampleFile[] = standardSamples({
  hello,
  circles,
  breakout,
  maze,
});
