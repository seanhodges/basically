// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * 88-ACR cassette encoding (Stage 4): program bytes -> Kansas City Standard
 * audio at 300 baud.
 *
 * KCS is already implemented in this project for the Acorn machines (the BBC's
 * CFS and the Atom's tapes are both 300-baud KCS FSK), so start from those
 * encoders rather than the Sinclair pulse scheme, which is a different animal.
 * What differs for the Altair is the framing above the modulation - the ACR
 * carried a plain byte stream with no Acorn-style named file header - so
 * `programName` may have nowhere to go; if so, say that in `saveInstructions`
 * rather than inventing a header the hardware never wrote.
 */

/** Sample rate the encoder emits at. */
export const CASSETTE_SAMPLE_RATE = 44_100;

export function buildCassetteSamples(
  _source: string,
  _programName: string,
  _robust: boolean,
): Float32Array {
  throw new Error('altair8800: not implemented');
}
