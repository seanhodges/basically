import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';

/** ZX80 example programs; the first is the starter for a fresh document. */
export const zx80Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'maze.bas', title: 'Maze', text: maze },
];
