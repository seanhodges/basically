import { describe, expect, it } from 'vitest';
import { bbcMicroMemoryBlocks } from './memoryBlocks';
import { SCREEN_FLOOR, SCREEN_MODE7_BASE } from '../../emulator/bbc/addresses';

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

  describe('conditionally free screen band', () => {
    const region = bbcMicroMemoryBlocks.conditionallyFree?.[0];

    it('runs from the graphics screens floor up to the teletext screen', () => {
      expect(bbcMicroMemoryBlocks.conditionallyFree).toHaveLength(1);
      expect(region?.range).toEqual({
        start: SCREEN_FLOOR,
        end: SCREEN_MODE7_BASE - 1,
      });
    });

    it('is the 19K the bitmap modes reach down into', () => {
      expect(SCREEN_MODE7_BASE - SCREEN_FLOOR).toBe(19 * 1024);
    });

    it('is free only while every selected mode is the teletext mode', () => {
      expect(region?.condition).toEqual({ kind: 'screen-modes', modes: [7] });
    });

    it('selects modes with MODE, powering on in the teletext mode', () => {
      expect(bbcMicroMemoryBlocks.screenModeCommand).toEqual({
        keyword: 'MODE',
        bootMode: 7,
      });
    });

    // Unlike the Atom's, this band is already a valid range: what the condition
    // buys here is the removal of the blanket screen warning, not the placement.
    it('sits inside the ranges a block may occupy unconditionally', () => {
      const valid = bbcMicroMemoryBlocks.validRanges[0]!;
      expect(region!.range.start).toBeGreaterThanOrEqual(valid.start);
      expect(region!.range.end).toBeLessThanOrEqual(valid.end);
    });
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
