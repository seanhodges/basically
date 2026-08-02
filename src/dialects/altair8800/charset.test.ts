// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it } from 'vitest';

/**
 * Stage 1 fills these in. The totality and injectivity cases are the ones
 * `src/dialects/charsetProbes.test.ts` will also enforce across all 256 bytes
 * once the dialect is registered and gains a probe entry.
 */
describe('altair8800 charset', () => {
  it.todo('maps printable ASCII 0x20-0x7E to itself');
  it.todo('spells every control code as a {0xNN} escape');
  it.todo('spells the unused top-bit range 0x80-0xFF as a {0xNN} escape');
  it.todo('gives every byte 0x00-0xFF exactly one text form (totality)');
  it.todo('re-encodes each canonical text form to its own byte (injectivity)');
  it.todo('emits no characters outside ASCII, so needs no bundled font glyphs');
});
