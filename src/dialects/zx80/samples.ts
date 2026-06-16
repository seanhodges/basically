import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import table from './samples/table.bas?raw';
import squares from './samples/squares.bas?raw';

/** ZX80 example programs; the first is the starter for a fresh document. */
export const zx80Samples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'table.bas', title: 'Times table', text: table },
  { name: 'squares.bas', title: 'Square numbers', text: squares },
];
