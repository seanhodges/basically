// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget, Dialect } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { buildAtariImage } from './basfile';
import { buildCasImage } from './casfile';
import { listingToAtascii } from './listing';
import {
  CASSETTE_SAMPLE_RATE,
  ROBUST_TAPE_GAPS,
  TAPE_GAPS,
  encodeAtariTape,
} from './audio/cassetteEncoder';
import { decodeCassette } from './audio/cassetteDecoder';

/**
 * File exports, shared by both Atari dialects, and the cassette route behind
 * them.
 *
 * The machine writes two program files and the IDE offers both, because they
 * are not interchangeable: `SAVE` writes the tokenized image, which loads
 * instantly and is what an emulator's disk image wants, while `LIST` writes an
 * ATASCII listing, which is slower to read back but survives being edited on
 * another machine. The cassette forms carry the tokenized image, `.cas` for an
 * emulator's virtual recorder and `.wav` for a real one.
 *
 * No target carries the document's memory blocks. A block sits in page 6, which
 * neither `SAVE` nor `CSAVE` looks at - the machine's own save routines write
 * BASIC's program area and nothing else - so the Transfer dialog's warning that
 * blocks will be dropped is the honest answer here rather than a gap to fill.
 */

/**
 * The image an empty program builds: the pointer header, the name table's dummy
 * byte and the immediate-mode line. Anything this size holds no BASIC lines.
 */
const EMPTY_IMAGE_BYTES = buildAtariImage({ variables: [], lines: [] }).length;

/** The tokenized image `SAVE` writes: header, variable tables, statements. */
export function buildTokenizedImage(source: string): Uint8Array {
  const { image, errors } = tokenizeProgram(source);
  return buildImageOrThrow({ bytes: image, errors }, EMPTY_IMAGE_BYTES);
}

/**
 * The ATASCII listing `LIST` writes.
 *
 * The text comes from listing the tokenized image rather than from the editor,
 * so the file holds what the machine would have printed - the keywords spelled
 * in full, the spacing the parser put back - instead of however the program
 * happened to be typed.
 */
export function buildAtariListing(source: string): Uint8Array {
  return listingToAtascii(detokenizeProgram(buildTokenizedImage(source)));
}

/** Build the cassette audio for a program (used by the .wav target and play). */
export function buildCassetteSamples(
  source: string,
  robust = false,
): Float32Array {
  return encodeAtariTape(buildTokenizedImage(source), {
    sampleRate: CASSETTE_SAMPLE_RATE,
    ...(robust ? ROBUST_TAPE_GAPS : TAPE_GAPS),
  });
}

export const atariBuildTargets: BuildTarget[] = [
  fileTarget('atari-bas', 'Export tokenized .bas', 'bas', buildTokenizedImage),
  fileTarget('atari-lst', 'Export .lst listing', 'lst', buildAtariListing),
  fileTarget('atari-cas', 'Export .cas cassette', 'cas', (source, opts) =>
    buildCasImage(buildTokenizedImage(source), opts.programName, TAPE_GAPS),
  ),
  cassetteWavTarget({
    id: 'atari-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source) => buildCassetteSamples(source),
  }),
];

/**
 * The cassette route, shared by both machines: the 410 recorder plugs into
 * either one and the dialogue is the same on both, so the instructions name the
 * family rather than a model.
 */
export const atariCassetteAudio: NonNullable<Dialect['audio']> = {
  sampleRate: CASSETTE_SAMPLE_RATE,
  buildSamples: (source, _programName, robust) =>
    buildCassetteSamples(source, robust),
  loadInstructions:
    'On the Atari type CLOAD and press RETURN - the machine beeps once - then start playback and press RETURN again. When READY comes back, type RUN.',
  saveInstructions:
    'On the Atari type CSAVE and press RETURN - the machine beeps twice - then press RECORD and PLAY on the recorder and press RETURN; the program plays out as a 600-baud tape tone you can capture here.',
  decodeSamples: (samples, sampleRate) => {
    const { data, warnings } = decodeCassette(samples, sampleRate);
    // Nothing on an Atari tape carries a name: the recorder is one device with
    // no directory, so the program is whatever the user was saving at the time.
    return { programName: '', source: detokenizeProgram(data), warnings };
  },
};
