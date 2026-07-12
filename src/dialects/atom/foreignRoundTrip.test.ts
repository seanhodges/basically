import { describe, expect, it } from 'vitest';
import { atom } from './index';
import { buildAtm, ATM_HEADER_SIZE } from './atm';
import { detokenizeProgramWithReport } from './detokenizer';
import { importRoundTrip, firstDifference } from '../roundTripHarness';

/**
 * Import-direction fixtures built from *foreign* byte patterns a real Atom image
 * can hold but the app never authors from plain text: inverse-video (top-bit)
 * bytes inside a string, a `*CAT` COS command, and floating-point-ROM statements
 * (`%A=…`, `FPRINT`). Each must round-trip byte-exactly (Stage 8). A machine-code
 * `.atm` must be rejected loudly, not imported as an empty document.
 */

const LINE_MARK = 0x0d;
const END = [0x0d, 0xff];

/** Assemble the #2900 line-record image from per-line body bytes. */
function image(lines: Array<{ no: number; body: number[] }>): Uint8Array {
  const out: number[] = [];
  for (const { no, body } of lines) {
    out.push(LINE_MARK, (no >> 8) & 0xff, no & 0xff, ...body);
  }
  out.push(...END);
  return Uint8Array.from(out);
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('atom foreign-image round-trip', () => {
  it('preserves inverse-video bytes, a *CAT line and FP statements', () => {
    const img = image([
      // 10 PRINT "<inverse AB>" - top-bit bytes inside a string -> {0xNN}.
      { no: 10, body: [...ascii(' PRINT "'), 0xc1, 0xc2, 0x22] },
      { no: 20, body: ascii(' *CAT') }, // COS command
      { no: 30, body: ascii(' %A=1.5') }, // FP variable assignment
      { no: 40, body: ascii(' FPRINT %A') }, // FP statement
    ]);

    const outcome = importRoundTrip(atom, img);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(img, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);

    // The same content wrapped in an .atm detokenizes to the same source.
    const atm = buildAtm(img, 'FP');
    expect(detokenizeProgramWithReport(atm).source).toBe(outcome.source);
  });

  it('rejects a machine-code .atm instead of importing an empty document', () => {
    // A valid BASIC .atm but for the load address: BASIC text loads at #2900.
    const payload = Uint8Array.of(0xa9, 0x00, 0x60); // LDA #0 / RTS
    const atm = buildAtm(payload, 'CODE');
    atm[16] = 0x00; // load = #2A00, not #2900
    atm[17] = 0x2a;

    const { source, warnings } = detokenizeProgramWithReport(atm);
    expect(source).toBe('');
    expect(warnings.some((w) => /BASIC program/i.test(w))).toBe(true);
  });

  it('warns on a truncated image with no 0D FF marker', () => {
    const img = image([{ no: 10, body: ascii(' PRINT "HI"') }]);
    const truncated = img.subarray(0, img.length - END.length);
    const { warnings } = detokenizeProgramWithReport(truncated);
    expect(warnings.some((w) => /truncated/i.test(w))).toBe(true);
  });

  it('keeps a valid .atm payload after its header', () => {
    // Sanity: buildAtm + strip round-trips the bytes we expect.
    const img = image([{ no: 10, body: ascii(' END') }]);
    const atm = buildAtm(img, 'E');
    expect(atm.length).toBe(ATM_HEADER_SIZE + img.length);
    expect(detokenizeProgramWithReport(atm).warnings).toEqual([]);
  });
});
