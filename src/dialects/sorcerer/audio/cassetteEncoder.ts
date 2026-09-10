// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Block } from '../../types';

/**
 * The Sorcerer's cassette signal. Not implemented yet.
 *
 * Frequency-shift keying - a high tone for a 1 bit, a low tone for a 0 - at
 * 1200 baud by default, with 300 baud selectable and, per the Software Manual,
 * far more reliable. The record itself (lead, header, 256-byte blocks and their
 * checksums) is `tapeFile.ts`; this file only turns those bytes into samples.
 */
export const CASSETTE_SAMPLE_RATE = 44100;

export function buildCassetteSamples(
  _source: string,
  _programName: string,
  _robust: boolean,
  _opts?: { blocks?: readonly Block[]; loader?: boolean },
): Float32Array {
  throw new Error('sorcerer: cassette encoder not implemented');
}
