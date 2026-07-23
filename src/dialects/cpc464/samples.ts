import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import breakout from './samples/breakout.bas?raw';
import maze from './samples/maze.bas?raw';
import kaleido from './samples/kaleido.bas?raw';

/**
 * CPC 464 example programs in Locomotive BASIC 1.0; the first is the starter
 * shown for a fresh document. `circles`/`kaleido` exercise the Mode 0 graphics
 * statements (`ORIGIN`/`PLOT`/`DRAW`, per-`PLOT` ink), and `breakout`/`maze`
 * offer a keyboard/joystick menu, then read the cursor cluster through
 * `INKEY(n)` (so the on-screen controller drives them) or `JOY(0)`, with
 * `SOUND` for feedback. `kaleido` ships as the BASIC-only variant until Stage 5
 * lands block injection (the plan's `CALL &8000` machine-code version).
 */
export const cpc464Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'maze.bas', title: 'Maze', text: maze },
  { name: 'kaleido.bas', title: 'Kaleidoscope', text: kaleido },
];
