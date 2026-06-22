import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import music from './samples/music.bas?raw';

/**
 * ZX Spectrum 128K example programs. The 48K-compatible set is shared with the
 * 48K dialect (the language is identical); `music.bas` is the 128-flavoured one,
 * showcasing PLAY on the AY chip plus BRIGHT/FLASH colour. The first is the
 * starter for a fresh document.
 */
export const spectrum128Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'music.bas', title: '128 music (PLAY)', text: music },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
];
