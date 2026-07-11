import { describe, expect, it } from 'vitest';
import { zx81 } from './index';
import { buildPFile } from './pfile';
import { encodeZxFloat } from './zxfloat';
import { importRoundTrip, firstDifference } from '../roundTripHarness';

/**
 * Import-direction fixtures built from *foreign* byte patterns real ZX81 tapes
 * contain but the app never authors: machine code stashed in a REM (with an
 * embedded 0x76 and trailing spaces), keyword tokens and control codes inside a
 * string, and a "protection" number whose stored float disagrees with its
 * printed digits. Each must round-trip byte-exactly (Stage 2/3).
 */

const NEWLINE = 0x76;

/** Assemble a tokenized program area from per-line body bytes. */
function programArea(lines: Array<{ no: number; body: number[] }>): Uint8Array {
  const out: number[] = [];
  for (const { no, body } of lines) {
    out.push((no >> 8) & 0xff, no & 0xff);
    const len = body.length + 1; // body + NEWLINE terminator
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push(...body, NEWLINE);
  }
  return Uint8Array.from(out);
}

describe('zx81 foreign-image round-trip', () => {
  it('preserves a machine-code REM, tokens in a string, controls and a fake float', () => {
    const program = programArea([
      // 1 REM <machine code>: space, control, keyword-as-data, embedded NEWLINE,
      // quote-image-as-data, two trailing spaces.
      { no: 1, body: [0xea, 0x00, 0x7f, 0xf5, 0x76, 0xc0, 0x00, 0x00] },
      // 2 PRINT "<GOTO PRINT tokens as string data>"
      { no: 2, body: [0xf5, 0x0b, 0xec, 0xf5, 0x0b] },
      // 3 PRINT "<cursor / control / RND codes as string data>"
      { no: 3, body: [0xf5, 0x0b, 0x70, 0x7f, 0x40, 0x0b] },
      // 4 GOTO 20 but the stored float is 9999 (protection trick)
      { no: 4, body: [0xec, 0x1e, 0x1c, 0x7e, ...encodeZxFloat(9999)] },
    ]);
    const image = buildPFile(program);

    const outcome = importRoundTrip(zx81, image);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });

  it('surfaces the fake float and the machine code in the import report', () => {
    const program = programArea([
      { no: 1, body: [0xea, 0x7f, 0xf5] }, // REM with control + token bytes
      { no: 2, body: [0xec, 0x1e, 0x1c, 0x7e, ...encodeZxFloat(9999)] },
    ]);
    const { source, warnings } = zx81.detokenizeWithReport!(
      buildPFile(program),
    );
    expect(source).toContain('\\{=9999}');
    expect(source).toContain('\\{7F}');
    // Raw escapes were needed, so the fidelity note fires.
    expect(warnings.join(' ')).toMatch(/\\\{NN\} escapes/);
  });
});
