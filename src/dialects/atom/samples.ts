import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import maze from './samples/maze.bas?raw';
import files from './samples/files.bas?raw';
import kaleido from './samples/kaleido.bas?raw';
import kaleidoAsm from './samples/kaleido.asm?raw';

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const ATOM_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x3800,
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x3803,
} as const;

/**
 * Acorn Atom example programs, offered when creating a new project.
 * Like the ZX80, the Atom omits breakout: the real ROM has no non-blocking
 * keyboard read, so a real-time paddle game isn't practical. `files.bas`
 * demonstrates the virtual filesystem via FOUT/BPUT then FIN/BGET.
 */
export const atomSamples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Circles', text: circles },
  { name: 'maze.bas', title: 'Maze', text: maze },
  { name: 'files.bas', title: 'Data files', text: files },
  {
    name: 'kaleido.bas',
    title: 'Kaleidoscope',
    text: kaleido,
    blocks: [ATOM_KALEIDO_BLOCK],
  },
];
