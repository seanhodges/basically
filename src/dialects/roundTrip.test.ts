// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Import-direction round-trip: for every registered dialect, every bundled
 * sample's binary image must decode to text that re-tokenizes to the exact
 * same bytes with no errors. This pins the app-authored baseline; per-dialect
 * foreign-image fixtures (real-hardware byte patterns) live in each dialect's
 * foreignRoundTrip tests, built on the same harness.
 */

import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import { firstDifference, importRoundTrip } from './roundTripHarness';

for (const dialect of dialects) {
  describe(`${dialect.id} import round-trip`, () => {
    for (const sample of dialect.samples) {
      it(`${sample.name} re-tokenizes byte-exactly`, () => {
        const first = dialect.tokenize(sample.text);
        expect(first.errors).toEqual([]);
        expect(first.image.length).toBeGreaterThan(0);

        const outcome = importRoundTrip(dialect, first.image);
        expect(outcome.errors).toEqual([]);
        expect(
          outcome.byteExact,
          `detokenize→tokenize drifted (${firstDifference(
            first.image,
            outcome.reImage,
          )}):\n${outcome.source}`,
        ).toBe(true);
      });
    }
  });
}
