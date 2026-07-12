import { describe, expect, it } from 'vitest';
import { bbcmaster } from './index';
import {
  importRoundTrip,
  isAcceptableImport,
  firstDifference,
} from '../roundTripHarness';

/**
 * Import-direction fixtures for the Master's own BASIC IV code paths (Stage 9
 * rollup): EDIT (0xCE, absent from BASIC II) and the TIME$= statement form,
 * alongside a teletext escape in a string. The shared BASIC II layer is
 * covered by the Stage 5 fixtures in ../bbcmicro/tokenizer.test.ts.
 */

describe('bbcmaster foreign-image round-trip (BASIC IV)', () => {
  it('EDIT, TIME$= and a teletext string round-trip byte-exactly', () => {
    const source = [
      '10 TIME$="12:00:00"',
      '20 PRINT "{RED}"+TIME$',
      '30 EDIT 10',
    ].join('\n');
    const { image, errors } = bbcmaster.tokenize(source);
    expect(errors).toEqual([]);
    expect(Array.from(image)).toContain(0xce); // the BASIC IV EDIT token

    const outcome = importRoundTrip(bbcmaster, image);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
    expect(isAcceptableImport(outcome)).toBe(true);
    expect(outcome.source).toBe(source + '\n');
  });

  it('a truncated Master .bbc is reported, not silently shortened', () => {
    const { image } = bbcmaster.tokenize('10 EDIT 20\n20 PRINT TIME$\n');
    const truncated = image.slice(0, image.length - 2);
    const outcome = importRoundTrip(bbcmaster, truncated);
    expect(outcome.warnings.length).toBeGreaterThan(0);
    expect(isAcceptableImport(outcome)).toBe(true);
  });
});
