import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import breakout from './samples/breakout.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';

/** ZX Spectrum example programs; the first is the starter for a fresh document. */
export const spectrumSamples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'maze.bas', title: 'Maze', text: maze },
];
