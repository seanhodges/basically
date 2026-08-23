// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Decode an ACI tape back into the two memory ranges it carries, then into a
 * listing. LOMEM and HIMEM come out of the housekeeping range, which is what
 * says where the program area was.
 */
export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): { programName: string; data: Uint8Array } {
  throw new Error('apple1: not implemented');
}
