import { describe, expect, it } from 'vitest';
import { zx80MemoryBlocks } from './memoryBlocks';

describe('zx80MemoryBlocks', () => {
  it('targets the Z80', () => {
    expect(zx80MemoryBlocks.cpu).toBe('z80');
  });

  it('covers the whole 16K RAM span', () => {
    expect(zx80MemoryBlocks.validRanges).toEqual([
      { start: 0x4000, end: 0x7fff },
    ]);
  });

  it('reserves the system variables below PROGRAM_BASE', () => {
    // 0x4000-0x4027, i.e. the 40-byte block below PROGRAM_BASE (0x4028).
    expect(zx80MemoryBlocks.reservedRanges).toEqual([
      { start: 0x4000, end: 0x4027 },
    ]);
  });

  it('suggests a high default address', () => {
    expect(zx80MemoryBlocks.defaultAddress).toBe(0x7000);
  });

  it('places the program area at PROGRAM_BASE with dynamic-area slack', () => {
    // A zero-length program still reserves 768 bytes of slack above 0x4028.
    expect(zx80MemoryBlocks.programArea(0)).toEqual({
      start: 0x4028,
      end: 0x4028 + 768 - 1,
    });
    // The area grows byte-for-byte with the program size.
    expect(zx80MemoryBlocks.programArea(100)).toEqual({
      start: 0x4028,
      end: 0x4028 + 100 + 768 - 1,
    });
  });
});
