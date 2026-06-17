import type { BuildTarget } from '../types';
import { tokenizeProgram } from './tokenizer';

/**
 * Build the loadable .prg image: the 2-byte load address ($0801) followed by
 * the tokenized program. This is the same image the emulator injects and the
 * import/export file format.
 */
export function buildPrg(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  // A bare 0x0000 end link means the program is empty.
  if (program.length <= 2) {
    throw new Error('Program is empty');
  }
  return Uint8Array.from([0x01, 0x08, ...program]);
}

export const c64BuildTargets: BuildTarget[] = [
  {
    id: 'c64-prg',
    label: 'Export .prg',
    fileExtension: 'prg',
    build: (source) =>
      Promise.resolve(
        new Blob([buildPrg(source) as BlobPart], {
          type: 'application/octet-stream',
        }),
      ),
  },
];
