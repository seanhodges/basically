import type { BuildTarget } from '../types';
import {
  buildAtomImage,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './audio/cassetteEncoder';
import { buildAtm } from './atm';
import { samplesToWav } from '../../transfer/wav';

/**
 * Atom build targets: a native `.atm` binary (the `#2900` program image wrapped
 * in the standard Atom emulator header) and a cassette `.wav`. The `.atm` is the
 * de-facto interchange format that other Atom emulators load directly; the bare
 * image alone is also importable, since {@link import('./atm').stripAtmHeader}
 * accepts either.
 */
export const atomBuildTargets: BuildTarget[] = [
  {
    id: 'atom-atm',
    label: 'Export .ATM binary',
    fileExtension: 'atm',
    build: (source, { programName }) =>
      Promise.resolve(
        new Blob([buildAtm(buildAtomImage(source), programName) as BlobPart], {
          type: 'application/octet-stream',
        }),
      ),
  },
  {
    id: 'wav',
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
