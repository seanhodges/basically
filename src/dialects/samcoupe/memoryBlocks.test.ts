import { describe, it, expect } from 'vitest';
import { samcoupeMemoryBlocks } from './memoryBlocks';
import { SAMCOUPE_KALEIDO_BLOCK } from './samples';

const { validRanges, reservedRanges, programArea, defaultAddress } =
  samcoupeMemoryBlocks;

describe('samcoupe memoryBlocks', () => {
  it('offers section B, the half of the window paging does not move', () => {
    expect(samcoupeMemoryBlocks.cpu).toBe('z80');
    expect(validRanges).toEqual([{ start: 0x4000, end: 0x7fff }]);
    // Section A is ROM0 and section D is ROM1 whenever the ROM wants it, and
    // section C moves under the program the moment it pages the screen in.
    for (const address of [0x0000, 0x3fff, 0x8000, 0xc000, 0xffff]) {
      expect(
        validRanges.some((r) => address >= r.start && address <= r.end),
        `0x${address.toString(16)}`,
      ).toBe(false);
    }
  });

  it('reserves everything the ROM and the interpreter own below PROG', () => {
    // The ROM's buffers and its stack (SP sits at 0x4Exx on a booted machine),
    // then the system variables the interpreter reads on every statement.
    expect(reservedRanges.map((r) => [r.start, r.end])).toEqual([
      [0x4000, 0x59ff],
      [0x5a00, 0x5cd4],
    ]);
    for (const range of reservedRanges) {
      expect(
        validRanges.some((v) => range.start >= v.start && range.end <= v.end),
      ).toBe(true);
    }
  });

  it('grows the program area with the program and keeps its base', () => {
    expect(programArea(0).start).toBe(0x5cd5);
    expect(programArea(2000).start).toBe(0x5cd5);
    const small = programArea(100);
    const large = programArea(2000);
    expect(large.end - small.end).toBe(1900);
    // The slack is headroom for the three variable areas above the program,
    // which measure 0x25D bytes on a machine with no program at all.
    expect(programArea(0).end - programArea(0).start + 1).toBeGreaterThan(
      0x25d,
    );
  });

  it('suggests an address the program has to grow far to reach', () => {
    expect(defaultAddress).toBe(0x7000);
    expect(defaultAddress).toBeGreaterThan(programArea(0).end);
    // Three and a half kilobytes of program and variables clear of an empty
    // machine's program area, and still inside section B.
    expect(defaultAddress - programArea(0).end).toBeGreaterThan(3500);
    expect(defaultAddress).toBeLessThanOrEqual(validRanges[0]!.end);
  });

  it('holds the kaleidoscope routine the sample loads', () => {
    const { address } = SAMCOUPE_KALEIDO_BLOCK;
    expect(address).toBe(defaultAddress);
    expect(
      validRanges.some((r) => address >= r.start && address <= r.end),
    ).toBe(true);
    expect(
      reservedRanges.some((r) => address >= r.start && address <= r.end),
    ).toBe(false);
  });
});
