// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import { fatalErrors } from './types';

/**
 * Every dialect that offers cassette audio must be able to import what it
 * exports: encode a real program to tape audio and decode it back, and the
 * recovered source must re-tokenize into a runnable image (no fatal errors).
 * This is the dialect-agnostic guard that "importing from cassette audio is
 * fully supported" - a dialect that grows export but forgets a working
 * `decodeSamples` fails here.
 */
const audioDialects = dialects.filter(
  (d) => d.audio && typeof d.audio.decodeSamples === 'function',
);

// Sanity: catch the case where a refactor drops audio from every dialect.
it('has dialects with cassette audio import', () => {
  expect(audioDialects.length).toBeGreaterThan(0);
});

describe.each(audioDialects.map((d) => [d.name, d] as const))(
  '%s cassette round trip',
  (_name, dialect) => {
    const audio = dialect.audio!;
    // The smallest bundled sample keeps the decoded waveform short and fast.
    const sample = dialect.samples.reduce((a, b) =>
      b.text.length < a.text.length ? b : a,
    );

    it('decodes its own exported program back into a runnable image', () => {
      const samples = audio.buildSamples(sample.text, 'TEST', false);
      const { source } = audio.decodeSamples!(samples, audio.sampleRate);

      expect(source.trim().length).toBeGreaterThan(0);
      // The recovered text must tokenize back cleanly - the same bar the run and
      // export paths use - so the import is genuinely usable, not just non-empty.
      const { errors } = dialect.tokenize(source);
      expect(fatalErrors(errors)).toEqual([]);
    });
  },
);
