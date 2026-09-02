import { describe, it, expect } from 'vitest';
import { readSamcoupeReport, SAMCOUPE_REPORTS } from './reports';
import { ERRNR, NMBUFF, PPC, TLBYTE } from './sysvars';

/** The last report `ERRMVAL` in the ROM's text.asm defines. */
const LAST_CODE = 55;

/** A machine that answers only the sysvars a report is read from. */
function stub(values: Record<number, number>) {
  const read = (addr: number) => values[addr] ?? 0;
  return {
    read,
    readWord: (addr: number) => read(addr) | (read(addr + 1) << 8),
  };
}

function withName(code: number, tl: number, name: string) {
  const values: Record<number, number> = { [ERRNR]: code, [TLBYTE]: tl };
  for (let i = 0; i < name.length; i++) values[NMBUFF + i] = name.charCodeAt(i);
  return stub(values);
}

describe('samcoupe reports', () => {
  it('covers every code the ROM defines, and stops where it stops', () => {
    for (let code = 0; code <= LAST_CODE; code++) {
      expect(SAMCOUPE_REPORTS[code], `report ${code}`).toBeTruthy();
    }
    // Codes above this belong to a disc operating system, which needs a table
    // that is not in the ROM.
    expect(SAMCOUPE_REPORTS[LAST_CODE + 1]).toBeUndefined();
  });

  it('reads the report number straight, not offset by one as the Sinclairs do', () => {
    expect(readSamcoupeReport(stub({ [ERRNR]: 0 }))).toMatchObject({
      isError: false,
      code: '0',
      message: 'OK',
    });
    expect(readSamcoupeReport(stub({ [ERRNR]: 5 }))).toMatchObject({
      code: '5',
      message: 'NEXT without FOR',
    });
  });

  it('calls a stop a stop and everything else an error', () => {
    const isError = (code: number) =>
      readSamcoupeReport(stub({ [ERRNR]: code })).isError;
    // OK, the two BREAKs and the two STOPs.
    for (const code of [0, 14, 15, 16, 17]) {
      expect(isError(code), SAMCOUPE_REPORTS[code]).toBe(false);
    }
    for (const code of [1, 13, 18, 22, 41]) {
      expect(isError(code), SAMCOUPE_REPORTS[code]).toBe(true);
    }
  });

  it('names the variable a "not found" report is about', () => {
    // A simple numeric name: TLBYTE's low bits hold one less than its length.
    expect(readSamcoupeReport(withName(2, 0x02, 'abc')).message).toBe(
      'ABC not found',
    );
    // A string, whose bit-6 name length is the true one, and an array.
    expect(readSamcoupeReport(withName(2, 0x41, 'q')).message).toBe(
      'Q$ not found',
    );
    expect(readSamcoupeReport(withName(2, 0x22, 'ab')).message).toBe(
      'AB() not found',
    );
    // Nothing legible in the buffer is not a reason to print rubbish.
    expect(readSamcoupeReport(stub({ [ERRNR]: 2 })).message).toBe(
      'Variable not found',
    );
  });

  it('reports a line only when the report is about one', () => {
    const at = (ppc: number) =>
      readSamcoupeReport(
        stub({ [ERRNR]: 5, [PPC]: ppc & 0xff, [PPC + 1]: ppc >> 8 }),
      ).line;
    expect(at(120)).toBe(120);
    // 0 is a direct command, and 0xFFFF is the edit line the ROM parks there.
    expect(at(0)).toBeUndefined();
    expect(at(0xffff)).toBeUndefined();
  });

  it('says what it saw when the code is not one the ROM defines', () => {
    // The boot leaves 80 here before the editor has run once.
    expect(readSamcoupeReport(stub({ [ERRNR]: 80 }))).toMatchObject({
      isError: true,
      code: '80',
      message: 'Report 80',
    });
  });
});
