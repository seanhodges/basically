import { describe, expect, it } from 'vitest';
import { trs80 } from './index';
import { PROG_START } from './tokenizer';
import { buildCasImage } from './casfile';
import { detokenizeProgramWithReport } from './detokenizer';
import { importRoundTrip, firstDifference } from '../roundTripHarness';

/**
 * Import-direction fixtures built from *genuine* stored forms a real Model I
 * CSAVE tape contains but the app's own authoring rarely produces byte-for-byte:
 * the `:REM'` (3A 93 FB) apostrophe-comment form, the `:ELSE` (3A 95) form,
 * control/graphics/compression bytes inside a string, and preserved lower-case
 * text. Each must round-trip byte-exactly.
 */

/** Assemble the linked-line program layout (absolute links from 0x42E9). */
function programArea(lines: Array<{ no: number; body: number[] }>): Uint8Array {
  const out: number[] = [];
  let addr = PROG_START;
  for (const { no, body } of lines) {
    const recLen = 2 + 2 + body.length + 1;
    const next = addr + recLen;
    out.push(next & 0xff, (next >> 8) & 0xff);
    out.push(no & 0xff, (no >> 8) & 0xff);
    out.push(...body, 0x00);
    addr = next;
  }
  out.push(0x00, 0x00); // null link: end of program
  return Uint8Array.from(out);
}

describe('trs80 foreign-image round-trip', () => {
  it('preserves :REM’, :ELSE, controls/graphics/compression in strings and lower case', () => {
    const program = programArea([
      // 10 'hello  -> stored as :REM' (3A 93 FB) + lower-case comment text.
      { no: 10, body: [0x3a, 0x93, 0xfb, 0x68, 0x65, 0x6c, 0x6c, 0x6f] },
      // 20 IFA=1THEN100ELSE200 -> ELSE stored as :ELSE (3A 95).
      {
        no: 20,
        body: [
          0x8f, 0x41, 0xd5, 0x31, 0xca, 0x31, 0x30, 0x30, 0x3a, 0x95, 0x32,
          0x30, 0x30,
        ],
      },
      // 30 PRINT "<CLS><bell><graphics><blank><compression>x" -> escapes.
      {
        no: 30,
        body: [0xb2, 0x22, 0x0c, 0x07, 0x81, 0x80, 0xc5, 0x78, 0x22],
      },
    ]);

    const outcome = importRoundTrip(trs80, program);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(program, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });

  it('round-trips the same genuine forms wrapped in a Model I .cas image', () => {
    const program = programArea([
      { no: 10, body: [0x3a, 0x93, 0xfb, 0x6f, 0x6b] }, // 10 'ok
      { no: 20, body: [0x8f, 0x41, 0xca, 0x31, 0x30, 0x3a, 0x95, 0x32, 0x30] },
    ]);
    const cas = buildCasImage(program, 'F');

    const outcome = importRoundTrip(trs80, cas);
    expect(outcome.errors).toEqual([]);
    // Re-tokenize reproduces the bare program (the .cas wrapper is not part of
    // the tokenizer's output), so compare against the program area.
    expect(Array.from(outcome.reImage), `drift:\n${outcome.source}`).toEqual(
      Array.from(program),
    );
  });

  it('reports a truncated image through the import-report warning channel', () => {
    const program = programArea([
      { no: 10, body: [0xb2, 0x22, 0x48, 0x49, 0x22] }, // 10 PRINT "HI"
    ]);
    const truncated = program.subarray(0, program.length - 3);
    const { warnings } = detokenizeProgramWithReport(truncated);
    expect(warnings.some((w) => /truncated/i.test(w))).toBe(true);
  });

  it('warns instead of mis-decoding a Model III 1500-baud cassette', () => {
    // 0x55 leader, 0x7F sync - the Model III high-speed framing.
    const model3 = Uint8Array.from([0x55, 0x55, 0x55, 0x7f, 0xd3, 0x00]);
    const { source, warnings } = detokenizeProgramWithReport(model3);
    expect(source).toBe('');
    expect(warnings.some((w) => /Model III/i.test(w))).toBe(true);
  });
});
