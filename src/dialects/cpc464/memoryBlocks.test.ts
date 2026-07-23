import { describe, expect, it } from 'vitest';
import { cpc464MemoryBlocks } from './memoryBlocks';

describe('cpc464MemoryBlocks', () => {
  it('reports the z80 CPU', () => {
    expect(cpc464MemoryBlocks.cpu).toBe('z80');
  });

  it('exposes all RAM above the restart page as the valid range', () => {
    expect(cpc464MemoryBlocks.validRanges).toEqual([
      { start: 0x0040, end: 0xffff },
    ]);
  });

  it('reserves the firmware/BASIC low workspace', () => {
    expect(cpc464MemoryBlocks.reservedRanges).toContainEqual({
      start: 0x0040,
      end: 0x016f,
    });
  });

  it('reserves the high BASIC workspace + firmware jumpblocks', () => {
    expect(cpc464MemoryBlocks.reservedRanges).toContainEqual({
      start: 0xab80,
      end: 0xbfff,
    });
  });

  it('reserves the screen memory', () => {
    expect(cpc464MemoryBlocks.reservedRanges).toContainEqual({
      start: 0xc000,
      end: 0xffff,
    });
  });

  it('suggests 0x8000 as the default block address (below HIMEM)', () => {
    expect(cpc464MemoryBlocks.defaultAddress).toBe(0x8000);
  });

  describe('programArea', () => {
    it('starts at &0170 regardless of program size', () => {
      expect(cpc464MemoryBlocks.programArea(0).start).toBe(0x0170);
      expect(cpc464MemoryBlocks.programArea(1000).start).toBe(0x0170);
    });

    it('includes a slack margin of at least 768 bytes beyond the program', () => {
      const programByteSize = 100;
      const area = cpc464MemoryBlocks.programArea(programByteSize);
      const totalSize = area.end - area.start + 1;
      expect(totalSize).toBeGreaterThanOrEqual(programByteSize + 768);
    });

    it('grows as programByteSize grows', () => {
      const small = cpc464MemoryBlocks.programArea(100);
      const large = cpc464MemoryBlocks.programArea(2000);
      expect(large.end - large.start).toBe(small.end - small.start + 1900);
    });

    it('stays clear of the default block address for a typical program', () => {
      // A modest program's area must not swallow the &8000 default block slot.
      expect(cpc464MemoryBlocks.programArea(4000).end).toBeLessThan(0x8000);
    });
  });
});
