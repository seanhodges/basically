import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';

/**
 * CPC 464 example programs; the first is the starter for a fresh document.
 * Stage 3 ports the canonical set (hello, circles, breakout, maze, kaleido —
 * kaleido with a Z80 memory block + CALL &8000); only the placeholder
 * starter ships until then.
 */
export const cpc464Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
];
