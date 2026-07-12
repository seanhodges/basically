import { describe, expect, it } from 'vitest';
import { zx80 } from './index';
import { buildOFile } from './ofile';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { importRoundTrip, firstDifference } from '../roundTripHarness';

/**
 * Import-direction fixtures from foreign ZX80 byte patterns: a machine-code REM
 * (with trailing spaces), and keyword tokens plus control codes inside a string
 * (the ZX80 has no line-length field, so a REM body cannot contain 0x76). Each
 * must round-trip byte-exactly.
 */

const NEWLINE = 0x76;

/** Assemble a tokenized ZX80 program area (line number BE, body, NEWLINE). */
function programArea(lines: Array<{ no: number; body: number[] }>): Uint8Array {
  const out: number[] = [];
  for (const { no, body } of lines) {
    out.push((no >> 8) & 0xff, no & 0xff, ...body, NEWLINE);
  }
  return Uint8Array.from(out);
}

describe('zx80 foreign-image round-trip', () => {
  it('preserves a machine-code REM, tokens in a string and control codes', () => {
    const program = programArea([
      // 1 REM <control, keyword-as-data, quote-image-as-data, trailing spaces>
      { no: 1, body: [0xfe, 0x7f, 0xf4, 0x81, 0x00, 0x00] },
      // 2 PRINT "<GOTO/PRINT tokens as string data>"
      { no: 2, body: [0xf4, 0x01, 0xec, 0xf4, 0x01] },
      // 3 PRINT "<control / cursor codes as string data>"
      { no: 3, body: [0xf4, 0x01, 0x70, 0x7f, 0x01] },
    ]);
    const image = buildOFile(program);

    const outcome = importRoundTrip(zx80, image);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });

  it('accepts the 4K ROM GO TO / GO SUB spellings', () => {
    const spaced = tokenizeProgram('10 GO TO 20\n20 GO SUB 30\n30 RETURN\n');
    expect(spaced.errors).toEqual([]);
    const tight = tokenizeProgram('10 GOTO 20\n20 GOSUB 30\n30 RETURN\n');
    expect(Array.from(spaced.bytes)).toEqual(Array.from(tight.bytes));
    // GOTO (0xEC) and GOSUB (0xFB) tokens are present.
    expect(Array.from(spaced.bytes)).toContain(0xec);
    expect(Array.from(spaced.bytes)).toContain(0xfb);
    // Both canonicalize to the tight spelling on the way back out.
    expect(detokenizeProgram(spaced.bytes)).toContain('GOTO 20');
    expect(detokenizeProgram(spaced.bytes)).toContain('GOSUB 30');
  });

  it('does not treat GO inside an identifier as GO TO', () => {
    // "GOTOKEN" style: GO glued to more letters must not fire the alias.
    const { errors } = tokenizeProgram('10 LET GOT=1\n');
    expect(errors).toEqual([]);
  });
});
