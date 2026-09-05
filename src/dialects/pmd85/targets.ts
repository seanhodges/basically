// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  buildTapeFile,
} from './audio/cassetteEncoder';
import { buildPmdImage, buildPtpImage } from './tape';
import { cassetteWavTarget, fileTarget } from '../targetHelpers';

/**
 * File exports for the PMD 85.
 *
 * The machine has one thing to write to and it is a cassette, so all three
 * targets are the same tape in different wrappers - the header block and body
 * block `SAVE` puts on tape, framed for whoever is going to read them back:
 *
 * - **`.ptp`** - a tape image with a `u16` length in front of every block. What
 *   the community emulators save and swap, and the one that stays readable when
 *   a tape holds several files.
 * - **`.pmd`** - the same two blocks with nothing between them. Older, simpler,
 *   one file per tape; still what a lot of archived software is filed as.
 * - **`.wav`** - the blocks modulated as the machine's own 1200 baud
 *   phase-encoded cassette signal, for playing into real hardware through a
 *   sound card. See `audio/cassetteEncoder.ts` for the derivation, which came
 *   off the Monitor's own tape routine rather than out of a specification.
 *
 * Import is the mirror: `binaryImports` takes `.ptp` and `.pmd` back, and
 * `audio.decodeSamples` recovers a program from a recording.
 *
 * No target carries memory blocks. BASIC-G's own `SAVE` writes the program area
 * and nothing else - the file number is the only handle it has, and a second
 * file would need a second `SAVE` at the keyboard - so an export that quietly
 * bundled machine code would not be a tape the machine could have written. The
 * Transfer dialog already says when a document's blocks would be dropped.
 */
export const pmd85BuildTargets: BuildTarget[] = [
  fileTarget(
    'pmd85-ptp',
    'Export .ptp tape image',
    'ptp',
    (source, { programName }) =>
      buildPtpImage([buildTapeFile(source, programName)]),
  ),
  fileTarget(
    'pmd85-pmd',
    'Export .pmd file',
    'pmd',
    (source, { programName }) =>
      buildPmdImage(buildTapeFile(source, programName)),
  ),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName, false),
  }),
];
