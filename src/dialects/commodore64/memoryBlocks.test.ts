import { describe, expect, it } from 'vitest';
import { c64MemoryBlocks } from './memoryBlocks';

describe('C64 memory-block support metadata', () => {
  it('targets the 6502', () => {
    expect(c64MemoryBlocks.cpu).toBe('6502');
  });

  it('spans RAM from $0800 to the top of the address space', () => {
    expect(c64MemoryBlocks.validRanges).toEqual([
      { start: 0x0800, end: 0xffff },
    ]);
  });

  it('flags the $D000-$DFFF I/O area as reserved (warning only)', () => {
    expect(c64MemoryBlocks.reservedRanges).toEqual([
      { start: 0xd000, end: 0xdfff },
    ]);
  });

  it('reserves the program area from $0801 with ~1KB variable slack', () => {
    // 100 program bytes + 1024 slack => [$0801, $0801 + 1124 - 1].
    expect(c64MemoryBlocks.programArea(100)).toEqual({
      start: 0x0801,
      end: 0x0801 + 100 + 1024 - 1,
    });
  });

  it('defaults new blocks to the always-RAM $C000', () => {
    expect(c64MemoryBlocks.defaultAddress).toBe(0xc000);
  });
});
