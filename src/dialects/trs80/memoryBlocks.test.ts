import { describe, expect, it } from 'vitest';
import { trs80MemoryBlocks } from './memoryBlocks';

describe('trs80MemoryBlocks', () => {
  it('targets the Z80 with a single 16K RAM valid range above the video page', () => {
    expect(trs80MemoryBlocks.cpu).toBe('z80');
    expect(trs80MemoryBlocks.validRanges).toEqual([
      { start: 0x4000, end: 0x7fff },
    ]);
  });

  it('reserves nothing: the video RAM sits below the RAM base, outside the range', () => {
    expect(trs80MemoryBlocks.reservedRanges).toEqual([]);
  });

  it('suggests a default address inside the valid range', () => {
    expect(trs80MemoryBlocks.defaultAddress).toBe(0x7000);
    const [range] = trs80MemoryBlocks.validRanges;
    expect(trs80MemoryBlocks.defaultAddress).toBeGreaterThanOrEqual(
      range!.start,
    );
    expect(trs80MemoryBlocks.defaultAddress).toBeLessThanOrEqual(range!.end);
  });

  it('starts the program area at TXTTAB (0x42E9) with 768 bytes of slack', () => {
    expect(trs80MemoryBlocks.programArea(0)).toEqual({
      start: 0x42e9,
      end: 0x42e9 + 768 - 1,
    });
    expect(trs80MemoryBlocks.programArea(100)).toEqual({
      start: 0x42e9,
      end: 0x42e9 + 100 + 768 - 1,
    });
  });
});
