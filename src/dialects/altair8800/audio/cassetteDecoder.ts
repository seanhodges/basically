// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * 88-ACR cassette decoding (Stage 4): recorded audio -> program bytes, the
 * inverse of `cassetteEncoder.ts`.
 *
 * Throws when no valid signal is found, per the {@link import('../../types').Dialect}
 * `audio.decodeSamples` contract - a silent empty result would look to the
 * import dialog like a successfully-loaded empty program.
 */
export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): { programName: string; data: Uint8Array } {
  throw new Error('altair8800: not implemented');
}
