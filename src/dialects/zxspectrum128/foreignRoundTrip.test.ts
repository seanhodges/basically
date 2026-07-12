import { describe, expect, it } from 'vitest';
import { zxspectrum128 } from './index';
import { buildTap } from './tapfile';
import { hasFatalErrors } from '../types';
import { importRoundTrip, firstDifference } from '../roundTripHarness';

/**
 * Import-direction fixtures for the 128K's own code paths:
 * the SPECTRUM (0xA3) and PLAY (0xA4) tokens the 48K table omits, both as
 * statements and as raw bytes inside a string - where they have no UDG and
 * must round-trip via `\t`/`\u` with the tokenizer's non-fatal warning.
 * The shared tape layer is covered by ../zxspectrum/foreignRoundTrip.test.ts.
 */

const PRINT = 0xf5;
const SPECTRUM = 0xa3;
const PLAY = 0xa4;
const Q = 0x22;
const ENTER = 0x0d;

/** Assemble a tokenized program area from per-line body bytes. */
function programArea(lines: Array<{ no: number; body: number[] }>): Uint8Array {
  const out: number[] = [];
  for (const { no, body } of lines) {
    out.push((no >> 8) & 0xff, no & 0xff);
    const len = body.length + 1; // body + ENTER terminator
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push(...body, ENTER);
  }
  return Uint8Array.from(out);
}

describe('zxspectrum128 foreign-image round-trip', () => {
  it('detokenizes SPECTRUM and PLAY statements and re-exports byte-exactly', () => {
    const image = buildTap(
      programArea([
        { no: 10, body: [SPECTRUM] },
        { no: 20, body: [PLAY, Q, 0x63, 0x64, 0x65, Q] }, // PLAY "cde"
      ]),
    );

    const outcome = importRoundTrip(zxspectrum128, image);
    expect(outcome.source).toContain('SPECTRUM');
    expect(outcome.source).toContain('PLAY');
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });

  it('keeps 0xA3/0xA4 inside a string as \\t/\\u with a non-fatal warning', () => {
    const image = buildTap(
      programArea([
        // 10 PRINT "<0xA3><0xA4>" - token bytes as string data.
        { no: 10, body: [PRINT, Q, SPECTRUM, PLAY, Q] },
      ]),
    );

    const outcome = importRoundTrip(zxspectrum128, image);
    expect(outcome.source).toContain('\\t');
    expect(outcome.source).toContain('\\u');
    // No such UDGs on the 128, so the tokenizer flags them - but non-fatally,
    // and the bytes still round-trip exactly.
    expect(outcome.errors.length).toBeGreaterThan(0);
    expect(hasFatalErrors(outcome.errors)).toBe(false);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });
});
