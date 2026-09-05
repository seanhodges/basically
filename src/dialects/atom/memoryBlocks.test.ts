import { describe, expect, it } from 'vitest';
import { atomMemoryBlocks } from './memoryBlocks';
import { VIDEO_BASE, VIDEO_TEXT_TOP, VIDEO_TOP } from './addresses';

describe('atomMemoryBlocks', () => {
  it('reports the 6502 CPU', () => {
    expect(atomMemoryBlocks.cpu).toBe('6502');
  });

  // The internal RAM stops at #3BFF on a fully expanded Atom; above it is the
  // off-board expansion nothing here has, where a block would not be written.
  it('exposes the internal RAM (#2900-#3BFF) as the only valid range', () => {
    expect(atomMemoryBlocks.validRanges).toEqual([
      { start: 0x2900, end: 0x3bff },
    ]);
  });

  it('reserves nothing inside the user-RAM window', () => {
    expect(atomMemoryBlocks.reservedRanges).toEqual([]);
  });

  it('suggests 0x3800 as the default block address', () => {
    expect(atomMemoryBlocks.defaultAddress).toBe(0x3800);
  });

  describe('conditionally free video RAM', () => {
    const region = atomMemoryBlocks.conditionallyFree?.[0];

    // Bounds against the machine's own address constants rather than literals:
    // the text screen is the first page of video RAM, and the region is
    // everything above it up to the last byte the board actually fits.
    it('runs from above the text screen to the top of the fitted video RAM', () => {
      expect(atomMemoryBlocks.conditionallyFree).toHaveLength(1);
      expect(region?.range).toEqual({
        start: VIDEO_TEXT_TOP,
        end: VIDEO_TOP - 1,
      });
      expect(VIDEO_TEXT_TOP - VIDEO_BASE).toBe(0x400);
    });

    it('is 5K, the six the board holds less the text screen page', () => {
      expect(VIDEO_TOP - VIDEO_TEXT_TOP).toBe(5 * 1024);
    });

    // CLEAR 0 is text mode, and the only mode that leaves the region alone.
    // Every other CLEAR draws into it, which is what makes this conditional
    // rather than valid.
    it('is free only while every selected mode is the text mode', () => {
      expect(region?.condition).toEqual({ kind: 'screen-modes', modes: [0] });
    });

    it('selects modes with CLEAR, powering on in the text mode', () => {
      expect(atomMemoryBlocks.screenModeCommand).toEqual({
        keyword: 'CLEAR',
        bootMode: 0,
      });
    });

    // The region sits above every valid range: on this machine the condition
    // does not soften a warning, it is the only thing that permits the block.
    it('lies outside the ranges a block may occupy unconditionally', () => {
      const inValid = atomMemoryBlocks.validRanges.some(
        (r) => region !== undefined && r.end >= region.range.start,
      );
      expect(inValid).toBe(false);
    });
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
