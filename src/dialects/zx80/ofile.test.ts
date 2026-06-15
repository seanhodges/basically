import { describe, expect, it } from 'vitest';
import { buildOFile, parseOFile } from './ofile';
import { tokenizeProgram } from './tokenizer';
import * as sv from './sysvars';

describe('zx80 .O image', () => {
  it('lays out sysvars + program + variables marker from 0x4000', () => {
    const { bytes } = tokenizeProgram('10 PRINT 1');
    const image = buildOFile(bytes);

    // Image runs 0x4000 .. E_LINE-1 = sysvars(0x28) + program + 0x80 marker.
    expect(image.length).toBe(sv.SYSVARS_LENGTH + bytes.length + 1);

    const word = (addr: number) =>
      image[addr - sv.SYSVARS_BASE]! |
      (image[addr - sv.SYSVARS_BASE + 1]! << 8);
    const vars = word(sv.VARS);
    expect(vars).toBe(sv.PROGRAM_BASE + bytes.length);
    expect(word(sv.E_LINE)).toBe(vars + 1);
    // The variables area begins with the 0x80 end marker.
    expect(image[vars - sv.SYSVARS_BASE]).toBe(0x80);
  });

  it('round-trips the program through parseOFile', () => {
    const { bytes } = tokenizeProgram('10 LET A=1\n20 PRINT A\n');
    const parsed = parseOFile(buildOFile(bytes));
    expect(Array.from(parsed.program)).toEqual(Array.from(bytes));
  });

  it('rejects a truncated image', () => {
    expect(() => parseOFile(new Uint8Array(8))).toThrow();
  });
});
