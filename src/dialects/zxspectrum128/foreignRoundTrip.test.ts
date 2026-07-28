import { describe, expect, it } from 'vitest';
import { zxspectrum128 } from './index';
import { buildTap } from './tapfile';
import { tapFromPayloads } from '../zxspectrum/tapfile';
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

  it('keeps 0xA3/0xA4 inside a string as the T/U UDGs with a non-fatal warning', () => {
    const image = buildTap(
      programArea([
        // 10 PRINT "<0xA3><0xA4>" - token bytes as string data.
        { no: 10, body: [PRINT, Q, SPECTRUM, PLAY, Q] },
      ]),
    );

    const outcome = importRoundTrip(zxspectrum128, image);
    expect(outcome.source).toContain('\u{1F143}');
    expect(outcome.source).toContain('\u{1F144}');
    // No such UDGs on the 128, so the tokenizer flags them - but non-fatally,
    // and the bytes still round-trip exactly.
    expect(outcome.errors.length).toBeGreaterThan(0);
    expect(hasFatalErrors(outcome.errors)).toBe(false);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });

  it('detokenizeWithReport surfaces a CODE file as a memory block (shared tape layer)', () => {
    const image = buildTap(
      programArea([{ no: 10, body: [PRINT, Q, 0x48, 0x49, Q] }]),
    );
    const header = new Uint8Array(17);
    header[0] = 0x03; // CODE
    header.set(
      Uint8Array.from('code'.split('').map((c) => c.charCodeAt(0))),
      1,
    );
    header[11] = 0x02; // declared length
    header[13] = 0x00; // load address 0x8000 low
    header[14] = 0x80; // load address 0x8000 high
    const data = Uint8Array.from([0xc9, 0x00]);
    const multiFile = new Uint8Array([
      ...image,
      ...tapFromPayloads(header, data),
    ]);

    const { blocks } = zxspectrum128.detokenizeWithReport!(multiFile);
    expect(blocks).toHaveLength(1);
    expect(blocks![0]!.address).toBe(0x8000);
    expect(Array.from(blocks![0]!.bytes)).toEqual([0xc9, 0x00]);
    expect(blocks![0]!.kind).toBe('code');
    expect(blocks![0]!.name).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
  });
});
