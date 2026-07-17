import { describe, expect, it } from 'vitest';
import { bbcMicroMemoryBlocks } from './memoryBlocks';

describe('bbcMicroMemoryBlocks', () => {
  it('reports the 6502 CPU', () => {
    expect(bbcMicroMemoryBlocks.cpu).toBe('6502');
  });

  it('exposes user RAM from PAGE (0x1900) to the top of main RAM as the only valid range', () => {
    expect(bbcMicroMemoryBlocks.validRanges).toEqual([
      { start: 0x1900, end: 0x7fff },
    ]);
  });

  it('reserves the graphics-mode screen band (down to 0x3000)', () => {
    expect(bbcMicroMemoryBlocks.reservedRanges).toEqual([
      { start: 0x3000, end: 0x7fff },
    ]);
  });

  it('suggests 0x2E00 as the default block address', () => {
    expect(bbcMicroMemoryBlocks.defaultAddress).toBe(0x2e00);
  });

  describe('programArea', () => {
    it('starts at PAGE (0x1900) regardless of program size', () => {
      expect(bbcMicroMemoryBlocks.programArea(0).start).toBe(0x1900);
      expect(bbcMicroMemoryBlocks.programArea(1000).start).toBe(0x1900);
    });

    it('reserves 512 bytes of slack for a sample program', () => {
      const programByteSize = 100;
      const area = bbcMicroMemoryBlocks.programArea(programByteSize);
      expect(area).toEqual({
        start: 0x1900,
        end: 0x1900 + programByteSize + 512 - 1,
      });
    });

    it('grows as programByteSize grows', () => {
      const small = bbcMicroMemoryBlocks.programArea(100);
      const large = bbcMicroMemoryBlocks.programArea(2000);
      expect(large.end).toBeGreaterThan(small.end);
      expect(large.end - large.start).toBe(small.end - small.start + 1900);
    });
  });
});
