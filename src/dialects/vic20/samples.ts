import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';

/**
 * Commodore VIC-20 example programs, re-laid-out for the unexpanded machine's
 * 22×23 colour screen (screen RAM at 7680/$1E00, colour RAM at 38400/$9600,
 * border+background via POKE 36879). They stay well inside the 3583 free BASIC
 * bytes. The first is the starter for a fresh document; `circles` plots PETSCII
 * characters since the VIC-20 has no bitmap mode from BASIC.
 */
export const vic20Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
];
