import { describe, expect, it } from 'vitest';
import { vic20MemoryBlocks } from './memoryBlocks';

describe('VIC-20 memory-block support metadata', () => {
  it('targets the 6502', () => {
    expect(vic20MemoryBlocks.cpu).toBe('6502');
  });

  it('spans the unexpanded user BASIC RAM from $1000 to $1DFF', () => {
    expect(vic20MemoryBlocks.validRanges).toEqual([
      { start: 0x1000, end: 0x1dff },
    ]);
  });

  it('flags the $1E00-$1FFF screen as reserved (warning only)', () => {
    expect(vic20MemoryBlocks.reservedRanges).toEqual([
      { start: 0x1e00, end: 0x1fff },
    ]);
  });

  it('reserves the program area from $1001 with ~512B variable slack', () => {
    expect(vic20MemoryBlocks.programArea(64)).toEqual({
      start: 0x1001,
      end: 0x1001 + 64 + 512 - 1,
    });
  });

  it('defaults new blocks below the screen at $1C00', () => {
    expect(vic20MemoryBlocks.defaultAddress).toBe(0x1c00);
  });
});
