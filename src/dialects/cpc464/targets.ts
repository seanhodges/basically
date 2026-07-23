import type { BuildTarget } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { buildBasFile } from './basfile';
import { buildCdt } from './cdt';
import { buildCassetteSamples, CASSETTE_SAMPLE_RATE } from './audio/cassette';
import { samplesToWav } from '../../transfer/wav';

/**
 * Tokenize `source` to the program image (line records + the `0x0000` end
 * marker), throwing on tokenizer errors so a broken program is reported rather
 * than silently exported.
 */
function programImage(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  // A bare 0x0000 end marker means the program has no lines.
  if (bytes.length <= 2) throw new Error('Program is empty');
  return bytes;
}

const octet = (bytes: Uint8Array) =>
  new Blob([bytes as BlobPart], { type: 'application/octet-stream' });

/**
 * Hardware-export targets: an AMSDOS-headered `.bas` (the on-disc tokenized
 * program), a `.cdt` tape image (the TZX-derived firmware tape) and a cassette
 * `.wav`. None carries memory blocks yet - the CPC gains its block editor in a
 * later stage - so all three export the BASIC program only.
 */
export const cpc464BuildTargets: BuildTarget[] = [
  {
    id: 'cpc464-bas',
    label: 'Export .bas (AMSDOS)',
    fileExtension: 'bas',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.bas`,
          blob: octet(buildBasFile(programImage(source), programName)),
        },
      ]),
  },
  {
    id: 'cpc464-cdt',
    label: 'Export .cdt tape',
    fileExtension: 'cdt',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.cdt`,
          blob: octet(buildCdt(programImage(source), programName)),
        },
      ]),
  },
  {
    id: 'cpc464-wav',
    label: 'Export cassette .wav',
    fileExtension: 'wav',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.wav`,
          blob: samplesToWav(
            buildCassetteSamples(source, programName),
            CASSETTE_SAMPLE_RATE,
          ),
        },
      ]),
  },
];
