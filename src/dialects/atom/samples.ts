import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';

/**
 * Acorn Atom example programs; the first is the starter for a fresh document.
 * Like the ZX80, the Atom omits breakout: the real ROM has no non-blocking
 * keyboard read, so a real-time paddle game isn't practical.
 */
export const atomSamples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'maze.bas', title: 'Maze', text: maze },
];
