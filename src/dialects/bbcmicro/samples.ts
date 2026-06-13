import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import breakout from './samples/breakout.bas?raw';
import dodger from './samples/dodger.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';

/** BBC Micro example programs; the first is the starter for a fresh document. */
export const bbcSamples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'dodger.bas', title: 'Dodger', text: dodger },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'maze.bas', title: 'Maze', text: maze },
];
