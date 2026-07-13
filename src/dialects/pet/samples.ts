import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';

/**
 * Commodore PET example programs, ported to the monochrome 40x25 machine (screen
 * RAM at 32768/$8000, no colour, no SID). The first is the starter for a fresh
 * document; `circles` degrades to PETSCII character plotting since the PET has
 * no bitmap.
 */
export const petSamples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
];
