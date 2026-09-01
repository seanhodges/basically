// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import { cassetteWavTarget, fileTarget } from '../targetHelpers';
import { buildBasFile, buildTokenizedProgram } from './basfile';
import { buildCasImage, buildTokenizedBlocks } from './casfile';
import { CASSETTE_SAMPLE_RATE, buildCassetteSamples } from './audio/cassette';

/**
 * File exports: the tokenized `.bas` file, the `.cas` tape image the community
 * emulators read, and the cassette signal as a `.wav` for playing into real
 * hardware.
 *
 * All three carry the program area and nothing else - `SAVE` and `CSAVE` both
 * write what lies between TXTTAB and VARTAB - so none of them can carry the
 * document's memory blocks, and the Transfer dialog says so before dropping
 * them.
 */

export const hb10pBuildTargets: BuildTarget[] = [
  fileTarget('hb10p-bas', 'Export tokenized .bas', 'bas', (source) =>
    buildBasFile(buildTokenizedProgram(source)),
  ),
  fileTarget('hb10p-cas', 'Export .cas cassette', 'cas', (source, opts) =>
    buildCasImage(
      buildTokenizedBlocks(buildTokenizedProgram(source), opts.programName),
    ),
  ),
  cassetteWavTarget({
    id: 'hb10p-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName),
  }),
];
