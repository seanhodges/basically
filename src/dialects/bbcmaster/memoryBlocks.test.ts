import { describe, expect, it } from 'vitest';
import { bbcMasterMemoryBlocks } from './memoryBlocks';

describe('bbcMasterMemoryBlocks', () => {
  it('reports the 6502 CPU', () => {
    expect(bbcMasterMemoryBlocks.cpu).toBe('6502');
  });

  it('exposes user RAM from PAGE (0x0E00) to the top of main RAM as the only valid range', () => {
    expect(bbcMasterMemoryBlocks.validRanges).toEqual([
      { start: 0x0e00, end: 0x7fff },
    ]);
  });

  it('reserves the graphics-mode screen band (down to 0x3000)', () => {
    expect(bbcMasterMemoryBlocks.reservedRanges).toEqual([
      { start: 0x3000, end: 0x7fff },
    ]);
  });

  it('suggests 0x2E00 as the default block address', () => {
    expect(bbcMasterMemoryBlocks.defaultAddress).toBe(0x2e00);
  });

  describe('programArea', () => {
    it('starts at PAGE (0x0E00) regardless of program size', () => {
      expect(bbcMasterMemoryBlocks.programArea(0).start).toBe(0x0e00);
      expect(bbcMasterMemoryBlocks.programArea(1000).start).toBe(0x0e00);
    });

    it('reserves 512 bytes of slack for a sample program', () => {
      const programByteSize = 100;
      const area = bbcMasterMemoryBlocks.programArea(programByteSize);
      expect(area).toEqual({
        start: 0x0e00,
        end: 0x0e00 + programByteSize + 512 - 1,
      });
    });

    it('grows as programByteSize grows', () => {
      const small = bbcMasterMemoryBlocks.programArea(100);
      const large = bbcMasterMemoryBlocks.programArea(2000);
      expect(large.end).toBeGreaterThan(small.end);
      expect(large.end - large.start).toBe(small.end - small.start + 1900);
    });
  });
});
