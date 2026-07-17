import { describe, expect, it } from 'vitest';
import { zx81MemoryBlocks } from './memoryBlocks';

describe('zx81MemoryBlocks', () => {
  it('targets the Z80', () => {
    expect(zx81MemoryBlocks.cpu).toBe('z80');
  });

  it('covers the whole 16K RAM span below RAMTOP', () => {
    expect(zx81MemoryBlocks.validRanges).toEqual([
      { start: 0x4000, end: 0x7fff },
    ]);
  });

  it('reserves the system variables below PROGRAM_BASE', () => {
    // 0x4000-0x407C, i.e. everything below PROGRAM_BASE (0x407D).
    expect(zx81MemoryBlocks.reservedRanges).toEqual([
      { start: 0x4000, end: 0x407c },
    ]);
  });

  it('suggests a high default address', () => {
    expect(zx81MemoryBlocks.defaultAddress).toBe(0x7000);
  });

  it('places the program area at PROGRAM_BASE with display/variables slack', () => {
    // A zero-length program still reserves 768 bytes of slack above 0x407D.
    expect(zx81MemoryBlocks.programArea(0)).toEqual({
      start: 0x407d,
      end: 0x407d + 768 - 1,
    });
    // The area grows byte-for-byte with the program size.
    expect(zx81MemoryBlocks.programArea(100)).toEqual({
      start: 0x407d,
      end: 0x407d + 100 + 768 - 1,
    });
  });
});
