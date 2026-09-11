// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import { cassetteWavTarget, fileTarget } from '../targetHelpers';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  buildTapeImage,
} from './audio/cassetteEncoder';

/**
 * File exports for the Sorcerer.
 *
 * The machine has one container and it is the tape: a stream of Exidy cassette
 * records, which is what both targets carry and what separates them is only how
 * the bytes travel. The `.tape` file is those records as bytes, the form an
 * emulator reads directly; the `.wav` is the same records modulated as the
 * cassette signal, for a real machine listening on its tape port.
 *
 * Both carry the document's memory blocks, because a tape holding a BASIC
 * program and a memory-range file beside it is not an invention - it is the
 * ordinary shape of a Sorcerer tape, and the loaders read past the records they
 * were not asked for by name. What neither does is generate an auto-loader:
 * loading a memory-range file is a Monitor command, so there is nothing a
 * BASIC program could be made to say (see `buildTapeRecords`).
 */
export const sorcererBuildTargets: BuildTarget[] = [
  fileTarget(
    'sorcerer-tape',
    'Export .tape cassette image',
    'tape',
    (source, { programName, blocks }) =>
      buildTapeImage(source, programName, blocks ?? []),
    { supportsBlocks: true },
  ),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName, blocks }) =>
      buildCassetteSamples(source, programName, false, { blocks }),
    supportsBlocks: true,
  }),
];
