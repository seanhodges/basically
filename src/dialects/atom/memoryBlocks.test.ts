import { describe, expect, it } from 'vitest';
import { atomMemoryBlocks } from './memoryBlocks';

describe('atomMemoryBlocks', () => {
  it('reports the 6502 CPU', () => {
    expect(atomMemoryBlocks.cpu).toBe('6502');
  });

  it('exposes user RAM (#2900-#7FFF) as the only valid range', () => {
    expect(atomMemoryBlocks.validRanges).toEqual([
      { start: 0x2900, end: 0x7fff },
    ]);
  });

  it('reserves nothing inside the user-RAM window', () => {
    expect(atomMemoryBlocks.reservedRanges).toEqual([]);
  });

  it('suggests 0x5000 as the default block address', () => {
    expect(atomMemoryBlocks.defaultAddress).toBe(0x5000);
  });

  describe('programArea', () => {
    it('starts at TEXT_START (#2900) regardless of program size', () => {
      expect(atomMemoryBlocks.programArea(0).start).toBe(0x2900);
      expect(atomMemoryBlocks.programArea(1000).start).toBe(0x2900);
    });

    it('includes a slack margin of at least 768 bytes beyond the program', () => {
      const programByteSize = 100;
      const area = atomMemoryBlocks.programArea(programByteSize);
      const totalSize = area.end - area.start + 1;
      expect(totalSize).toBeGreaterThanOrEqual(programByteSize + 768);
    });

    it('grows as programByteSize grows', () => {
      const small = atomMemoryBlocks.programArea(100);
      const large = atomMemoryBlocks.programArea(2000);
      expect(large.end).toBeGreaterThan(small.end);
      expect(large.end - large.start).toBe(small.end - small.start + 1900);
    });

    it('is a single byte range when programByteSize is 0 plus the slack', () => {
      const area = atomMemoryBlocks.programArea(0);
      expect(area.end - area.start + 1).toBe(768);
    });
  });
});
