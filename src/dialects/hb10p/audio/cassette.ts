// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AudioDecodeResult } from '../../types';

/**
 * The MSX cassette signal: Kansas City Standard FSK at 1200 baud, where a 0
 * bit is one cycle of 1200Hz and a 1 bit two cycles of 2400Hz, behind a 2400Hz
 * leader. The BIOS detects 1200 against 2400 baud as it reads, so a recording
 * does not have to say which it is.
 */
export const CASSETTE_SAMPLE_RATE = 44100;

export function buildCassetteSamples(
  _source: string,
  _programName: string,
  _robust: boolean,
): Float32Array {
  throw new Error('hb10p: cassette encoder not implemented');
}

export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): AudioDecodeResult {
  throw new Error('hb10p: cassette decoder not implemented');
}
