import type { BuildTarget } from '../types';
import { tokenizeProgram } from './tokenizer';
import { buildCasImage } from './casfile';
import { samplesToWav } from '../../transfer/wav';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';

/**
 * Build the native `.cas` cassette image: the byte-level CSAVE block (leader,
 * 0xA5 sync, 0xD3 marker, filename, tokenized program). This is both the export
 * file and what an emulator's virtual cassette deck reads back.
 */
export function buildCas(source: string, programName: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  if (program.length <= 2) throw new Error('Program is empty');
  return buildCasImage(program, programName);
}

export const trs80BuildTargets: BuildTarget[] = [
  {
    id: 'trs80-cas',
    label: 'Export .cas',
    fileExtension: 'cas',
    build: (source, { programName }) =>
      Promise.resolve(
        new Blob([buildCas(source, programName) as BlobPart], {
          type: 'application/octet-stream',
        }),
      ),
  },
  {
    id: 'trs80-wav',
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
