import type { BuildTarget } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { samplesToWav } from '../../transfer/wav';
import { CASSETTE_SAMPLE_RATE, buildCassetteSamples } from './audio/cassette';

/**
 * Build the loadable .prg image: the 2-byte load address ($1001, the
 * unexpanded VIC-20 base) followed by the tokenized program. This is the same
 * image the emulator injects and the import/export file format — identical in
 * shape to the C64's, only the address differs.
 */
export function buildPrg(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  // A bare 0x0000 end link means the program is empty.
  if (program.length <= 2) {
    throw new Error('Program is empty');
  }
  return Uint8Array.from([0x01, 0x10, ...program]);
}

export const vic20BuildTargets: BuildTarget[] = [
  {
    id: 'vic20-prg',
    label: 'Export .prg',
    fileExtension: 'prg',
    build: (source) =>
      Promise.resolve(
        new Blob([buildPrg(source) as BlobPart], {
          type: 'application/octet-stream',
        }),
      ),
  },
  {
    id: 'vic20-wav',
    label: 'Export cassette .wav',
    fileExtension: 'wav',
    build: (source, { programName }) =>
      Promise.resolve(
        samplesToWav(
          buildCassetteSamples(source, programName),
          CASSETTE_SAMPLE_RATE,
        ),
      ),
  },
];
