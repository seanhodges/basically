import { describe, expect, it } from 'vitest';
import { zxspectrum } from './index';
import { tokenizeProgram } from './tokenizer';
import { buildTap, parseTapWithReport, tapFromPayloads } from './tapfile';
import { encodeSpectrumNumber } from './numbers';
import { hasFatalErrors } from '../types';
import { importRoundTrip, firstDifference } from '../roundTripHarness';

/**
 * Import-direction fixtures built from *foreign* byte patterns real Spectrum
 * tapes carry but the app never authors: control codes and UDGs
 * outside strings, machine code stashed in a REM, a "protection" constant whose
 * stored 5-byte form disagrees with its printed digits, a `0 REM` protection
 * line, a multi-file compilation `.TAP`, and a bad parity byte.
 */

const PRINT = 0xf5;
const REM = 0xea;
const GOTO = 0xec;
const Q = 0x22;
const NUMBER_MARKER = 0x0e;
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

describe('zxspectrum foreign-image round-trip', () => {
  it('preserves control/UDG bytes, a machine-code REM and a fake constant', () => {
    const program = programArea([
      // 10 PRINT "<INK 2><UDG a>" - control + UDG inside a string.
      { no: 10, body: [PRINT, Q, 0x10, 0x02, 0x90, Q] },
      // 20 REM <0x00><UDG m><©> - non-printable machine code in a REM body.
      { no: 20, body: [REM, 0x00, 0x9c, 0x7f] },
      // 30 GO TO 20 but the stored form encodes 9999 (a protection trick).
      {
        no: 30,
        body: [GOTO, 0x32, 0x30, NUMBER_MARKER, ...encodeSpectrumNumber(9999)],
      },
      // 40 PRINT <PAPER 6><INK 0> "ok" - colour bytes before the operand.
      { no: 40, body: [PRINT, 0x11, 0x06, 0x10, 0x00, Q, 0x6f, 0x6b, Q] },
    ]);
    const image = buildTap(program);

    const outcome = importRoundTrip(zxspectrum, image);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });

  it('surfaces the fake constant and the machine code in the import report', () => {
    const program = programArea([
      { no: 10, body: [REM, 0x00, 0x9c] }, // control + UDG bytes
      {
        no: 20,
        body: [GOTO, 0x32, 0x30, NUMBER_MARKER, ...encodeSpectrumNumber(9999)],
      },
    ]);
    const { source, warnings } = zxspectrum.detokenizeWithReport!(
      buildTap(program),
    );
    expect(source).toContain('{=9999}');
    expect(source).toContain('{0x00}');
    // A raw escape was needed, so the fidelity note fires.
    expect(warnings.join(' ')).toMatch(/\{0xNN\} escapes/);
  });

  it('accepts a 0 REM protection line and re-exports it byte-exactly', () => {
    const image = buildTap(
      programArea([
        { no: 0, body: [REM, 0x48, 0x49] }, // 0 REM HI
        {
          no: 10,
          body: [PRINT, 0x31, NUMBER_MARKER, ...encodeSpectrumNumber(1)],
        },
      ]),
    );
    const outcome = importRoundTrip(zxspectrum, image);
    // Line 0 is outside 1-9999 so it warns, but the warning is non-fatal: the
    // program still builds and re-exports identically.
    expect(hasFatalErrors(outcome.errors)).toBe(false);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
  });

  it('imports the BASIC program from a multi-file .TAP and reports the rest', () => {
    const program = programArea([
      { no: 10, body: [PRINT, Q, 0x48, 0x49, Q] }, // 10 PRINT "HI"
    ]);
    // A CODE file appended after the BASIC program (a common compilation .TAP).
    const codeHeader = new Uint8Array(17);
    codeHeader[0] = 0x03; // CODE
    codeHeader.set(
      Uint8Array.from('loader'.split('').map((c) => c.charCodeAt(0))),
      1,
    );
    const codeData = Uint8Array.from([0x21, 0x00, 0x40, 0xc9]); // a little Z80
    const multiFile = new Uint8Array([
      ...buildTap(program),
      ...tapFromPayloads(codeHeader, codeData),
    ]);

    const { parsed, warnings } = parseTapWithReport(multiFile);
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
    expect(warnings.join(' ')).toMatch(/other file/);
    expect(warnings.join(' ')).toMatch(/CODE/);

    // The imported source still re-tokenizes to the BASIC program bytes.
    const reprog = tokenizeProgram(zxspectrum.detokenize(multiFile)).bytes;
    expect(Array.from(reprog)).toEqual(Array.from(program));
  });

  it('reports a bad parity byte', () => {
    const image = buildTap(
      programArea([
        {
          no: 10,
          body: [PRINT, 0x31, NUMBER_MARKER, ...encodeSpectrumNumber(1)],
        },
      ]),
    );
    // Corrupt the data block's trailing parity byte.
    const corrupt = Uint8Array.from(image);
    corrupt[corrupt.length - 1] ^= 0xff;
    const { warnings } = parseTapWithReport(corrupt);
    expect(warnings.join(' ')).toMatch(/checksum/);
  });
});
