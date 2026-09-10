// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AudioDecodeResult } from '../../types';

/**
 * Recorded cassette audio back into an editable program.
 * Not implemented yet.
 */
export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): AudioDecodeResult {
  throw new Error('sorcerer: cassette decoder not implemented');
}
