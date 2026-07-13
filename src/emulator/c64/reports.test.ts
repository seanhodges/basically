import { describe, expect, it } from 'vitest';
import { readC64Report } from './reports';

const SCREEN = 0x0400;
const COLS = 40;

/** Build a fake screen-RAM reader from text rows (screen codes). */
function screenMem(rows: string[]) {
  const ram = new Uint8Array(COLS * 25).fill(32);
  rows.forEach((text, r) => {
    [...text].forEach((ch, c) => {
      let code = 32;
      if (ch >= 'A' && ch <= 'Z') code = ch.charCodeAt(0) - 64;
      else if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 63)
        code = ch.charCodeAt(0);
      ram[r * COLS + c] = code;
    });
  });
  return { read: (a: number) => ram[a - SCREEN] ?? 0 };
}

describe('readC64Report', () => {
  it('finds a "?...ERROR IN n" line and parses the line number', () => {
    const r = readC64Report(
      screenMem(['READY.', 'RUN', "?UNDEF'D STATEMENT  ERROR IN 10", 'READY.']),
    );
    expect(r).not.toBeNull();
    expect(r!.isError).toBe(true);
    expect(r!.message).toContain('ERROR');
    expect(r!.line).toBe(10);
  });

  it('returns null when there is no error line', () => {
    expect(readC64Report(screenMem(['READY.', 'HELLO', 'READY.']))).toBeNull();
  });

  it('ignores a line that says ERROR but does not start with "?"', () => {
    expect(readC64Report(screenMem(['THE ERROR WAS MINE']))).toBeNull();
  });

  it('scans a non-default screen layout (VIC-20: $1E00, 22×23)', () => {
    const vic = { screen: 0x1e00, cols: 22, rows: 23 };
    const ram = new Uint8Array(vic.cols * vic.rows).fill(32);
    // "?SYNTAX  ERROR IN 20" wrapped into the 22-column matrix on row 2.
    const text = '?SYNTAX  ERROR IN 20';
    [...text].forEach((ch, c) => {
      let code = 32;
      if (ch >= 'A' && ch <= 'Z') code = ch.charCodeAt(0) - 64;
      else if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 63)
        code = ch.charCodeAt(0);
      ram[2 * vic.cols + c] = code;
    });
    const mem = { read: (a: number) => ram[a - vic.screen] ?? 0 };
    const r = readC64Report(mem, vic);
    expect(r).not.toBeNull();
    expect(r!.line).toBe(20);
    // The default C64 layout must not see the VIC-20 screen.
    expect(readC64Report(mem)).toBeNull();
  });
});
