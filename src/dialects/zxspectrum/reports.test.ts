import { describe, expect, it } from 'vitest';
import { readSpectrumReport } from './reports';
import { ERR_NR, PPC } from './sysvars';

function mem(errNr: number, line: number) {
  return {
    read: (a: number) => (a === ERR_NR ? errNr : 0),
    readWord: (a: number) => (a === PPC ? line : 0),
  };
}

describe('readSpectrumReport', () => {
  it('treats ERR_NR 0xFF as "0 OK"', () => {
    const r = readSpectrumReport(mem(0xff, 0));
    expect(r.isError).toBe(false);
    expect(r.code).toBe('0');
  });

  it('decodes "2 Variable not found"', () => {
    const r = readSpectrumReport(mem(1, 30));
    expect(r).toMatchObject({ isError: true, code: '2', line: 30 });
    expect(r.message).toMatch(/variable not found/i);
  });

  it('treats STOP (9), BREAK (D) and BREAK-into (L) as clean stops', () => {
    expect(readSpectrumReport(mem(8, 1)).isError).toBe(false); // 9 STOP
    expect(readSpectrumReport(mem(12, 1)).isError).toBe(false); // D BREAK
    expect(readSpectrumReport(mem(20, 1)).code).toBe('L'); // BREAK into program
    expect(readSpectrumReport(mem(20, 1)).isError).toBe(false);
  });
});
