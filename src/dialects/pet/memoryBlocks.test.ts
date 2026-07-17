import { describe, expect, it } from 'vitest';
import { petMemoryBlocks } from './memoryBlocks';

describe('PET memory-block support metadata', () => {
  it('targets the 6502', () => {
    expect(petMemoryBlocks.cpu).toBe('6502');
  });

  it('spans the base 32K RAM from $0400 to $7FFF', () => {
    expect(petMemoryBlocks.validRanges).toEqual([
      { start: 0x0400, end: 0x7fff },
    ]);
  });

  it('reserves nothing within the base RAM', () => {
    expect(petMemoryBlocks.reservedRanges).toEqual([]);
  });

  it('reserves the program area from $0401 with ~1KB variable slack', () => {
    expect(petMemoryBlocks.programArea(200)).toEqual({
      start: 0x0401,
      end: 0x0401 + 200 + 1024 - 1,
    });
  });

  it('defaults new blocks high in the 32K RAM at $7000', () => {
    expect(petMemoryBlocks.defaultAddress).toBe(0x7000);
  });
});
