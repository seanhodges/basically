import { describe, expect, it } from 'vitest';
import { bbcMasterMemoryBlocks } from './memoryBlocks';
import { bbcMicroMemoryBlocks } from '../bbcmicro/memoryBlocks';
import { SCREEN_FLOOR, SCREEN_MODE7_BASE } from '../../emulator/bbc/addresses';

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

  describe('conditionally free screen band', () => {
    const region = bbcMasterMemoryBlocks.conditionallyFree?.[0];

    it('runs from the graphics screens floor up to the teletext screen', () => {
      expect(bbcMasterMemoryBlocks.conditionallyFree).toHaveLength(1);
      expect(region?.range).toEqual({
        start: SCREEN_FLOOR,
        end: SCREEN_MODE7_BASE - 1,
      });
    });

    it('is free only while every selected mode is the teletext mode', () => {
      expect(region?.condition).toEqual({ kind: 'screen-modes', modes: [7] });
    });

    it('selects modes with MODE, powering on in the teletext mode', () => {
      expect(bbcMasterMemoryBlocks.screenModeCommand).toEqual({
        keyword: 'MODE',
        bootMode: 7,
      });
    });

    // The two BBCs differ in where the program starts and in nothing above it,
    // so the band and the words describing it have to be the same on both.
    it('matches the Model B byte for byte, wording included', () => {
      expect(bbcMasterMemoryBlocks.conditionallyFree).toEqual(
        bbcMicroMemoryBlocks.conditionallyFree,
      );
    });
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
