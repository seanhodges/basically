import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import colors from './samples/colors.bas?raw';
import maze from './samples/maze.bas?raw';
import guess from './samples/guess.bas?raw';

/** Commodore 64 example programs; the first is the starter for a fresh document. */
export const c64Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'colors.bas', title: 'Colour cycle', text: colors },
  { name: 'maze.bas', title: 'Maze (10 PRINT)', text: maze },
  { name: 'guess.bas', title: 'Guess the number', text: guess },
];
