import { describe, expect, it } from 'vitest';
import { spectrumMemoryBlocks } from './memoryBlocks';

describe('spectrumMemoryBlocks', () => {
  it('reports the z80 CPU', () => {
    expect(spectrumMemoryBlocks.cpu).toBe('z80');
  });

  it('exposes the full 48K RAM span as the only valid range', () => {
    expect(spectrumMemoryBlocks.validRanges).toEqual([
      { start: 0x4000, end: 0xffff },
    ]);
  });

  it('reserves the display file + colour attributes', () => {
    expect(spectrumMemoryBlocks.reservedRanges).toContainEqual({
      start: 0x4000,
      end: 0x5aff,
    });
  });

  it('reserves the printer buffer', () => {
    expect(spectrumMemoryBlocks.reservedRanges).toContainEqual({
      start: 0x5b00,
      end: 0x5bff,
    });
  });

  it('reserves the system variables + channel information', () => {
    expect(spectrumMemoryBlocks.reservedRanges).toContainEqual({
      start: 0x5c00,
      end: 0x5cca,
    });
  });

  it('suggests 0x8000 as the default block address', () => {
    expect(spectrumMemoryBlocks.defaultAddress).toBe(0x8000);
  });

  describe('programArea', () => {
    it('starts at PROG (0x5CCB) regardless of program size', () => {
      expect(spectrumMemoryBlocks.programArea(0).start).toBe(0x5ccb);
      expect(spectrumMemoryBlocks.programArea(1000).start).toBe(0x5ccb);
    });

    it('includes a slack margin of at least 768 bytes beyond the program', () => {
      const programByteSize = 100;
      const area = spectrumMemoryBlocks.programArea(programByteSize);
      const totalSize = area.end - area.start + 1;
      expect(totalSize).toBeGreaterThanOrEqual(programByteSize + 768);
    });

    it('grows as programByteSize grows', () => {
      const small = spectrumMemoryBlocks.programArea(100);
      const large = spectrumMemoryBlocks.programArea(2000);
      expect(large.end).toBeGreaterThan(small.end);
      expect(large.end - large.start).toBe(small.end - small.start + 1900);
    });

    it('is a single byte range when programByteSize is 0 plus the slack', () => {
      const area = spectrumMemoryBlocks.programArea(0);
      expect(area.end - area.start + 1).toBe(768);
    });
  });
});
