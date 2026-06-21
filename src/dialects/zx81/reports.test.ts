import { describe, expect, it } from 'vitest';
import { readZx81Report } from './reports';
import { ERR_NR, OLDPPC } from './sysvars';

/** Tiny fake memory exposing just ERR_NR and OLDPPC. */
function mem(errNr: number, line: number) {
  return {
    read: (a: number) => (a === ERR_NR ? errNr : 0),
    readWord: (a: number) => (a === OLDPPC ? line : 0),
  };
}

describe('readZx81Report', () => {
  it('treats ERR_NR 0xFF as "0 OK" (not an error)', () => {
    const r = readZx81Report(mem(0xff, 0));
    expect(r.isError).toBe(false);
    expect(r.code).toBe('0');
  });

  it('decodes an error code and line (ERR_NR = code - 1)', () => {
    const r = readZx81Report(mem(1, 30)); // code 2 = undefined variable
    expect(r).toMatchObject({ isError: true, code: '2', line: 30 });
    expect(r.message).toMatch(/variable/i);
  });

  it('treats STOP (code 9) and BREAK (code D) as clean stops', () => {
    expect(readZx81Report(mem(8, 10)).code).toBe('9'); // STOP
    expect(readZx81Report(mem(8, 10)).isError).toBe(false);
    expect(readZx81Report(mem(12, 10)).code).toBe('D'); // BREAK
    expect(readZx81Report(mem(12, 10)).isError).toBe(false);
  });

  it('drops an out-of-range line number', () => {
    expect(readZx81Report(mem(1, 0)).line).toBeUndefined();
  });
});
