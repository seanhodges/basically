import { describe, expect, it } from 'vitest';
import type { MemoryBlock, MemoryBlocksSupport } from '../dialects/types';
import { lintBlocks } from './blockLint';

/**
 * A small, easy-to-reason-about support fixture rather than the real Spectrum
 * figures - keeps boundary arithmetic in the tests obvious.
 *
 *   0x0000-0x0FFF  outside validRanges (below RAM)
 *   0x1000-0x1FFF  valid RAM, reserved (warn-only)
 *   0x2000-0x2FFF  valid RAM, free
 *   programArea(n) = [0x3000, 0x3000 + n - 1]  (no slack, for simple math)
 *   0x4000-0xFFFF  outside validRanges (above RAM)
 */
const SUPPORT: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: [{ start: 0x1000, end: 0x3fff }],
  reservedRanges: [{ start: 0x1000, end: 0x1fff }],
  programArea: (programByteSize: number) => ({
    start: 0x3000,
    end: 0x3000 + Math.max(programByteSize, 1) - 1,
  }),
  defaultAddress: 0x2000,
};

function block(overrides: Partial<MemoryBlock> = {}): MemoryBlock {
  return {
    id: 'blk-1',
    name: 'FOO',
    address: 0x2000,
    bytes: Uint8Array.from([1, 2, 3, 4]),
    kind: 'data',
    ...overrides,
  };
}

describe('lintBlocks', () => {
  it('reports no issues for a single valid, non-colliding block', () => {
    const issues = lintBlocks([block()], SUPPORT, 100);
    expect(issues).toEqual([]);
  });

  describe('outside validRanges', () => {
    it('errors when a block starts below every valid range', () => {
      const b = block({ address: 0x0000, bytes: Uint8Array.from([1, 2]) });
      const issues = lintBlocks([b], SUPPORT, 100);
      expect(issues).toContainEqual(
        expect.objectContaining({ blockId: b.id, severity: 'error' }),
      );
    });

    it('errors when a block ends past the end of validRanges', () => {
      // valid ends at 0x3FFF inclusive; this block's last byte is 0x4000.
      const b = block({
        address: 0x3ffe,
        bytes: Uint8Array.from([1, 2, 3]),
      });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(
        issues.some((i) => i.blockId === b.id && i.severity === 'error'),
      ).toBe(true);
    });

    it('does not error when a block ends exactly at the last valid byte', () => {
      // valid = [0x1000, 0x3FFF]; block occupies [0x3FFD, 0x3FFF].
      const b = block({
        address: 0x3ffd,
        bytes: Uint8Array.from([1, 2, 3]),
      });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(issues.filter((i) => i.blockId === b.id)).toEqual([]);
    });

    it('does not error when a block starts exactly at a valid range start', () => {
      const b = block({ address: 0x1000, bytes: Uint8Array.from([1]) });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(
        issues.filter((i) => i.blockId === b.id && i.severity === 'error'),
      ).toEqual([]);
    });
  });

  describe('block-block overlap', () => {
    it('errors on two blocks whose byte ranges overlap', () => {
      const a = block({
        id: 'a',
        name: 'A',
        address: 0x2000,
        bytes: Uint8Array.from(new Array(16).fill(0)),
      });
      const b = block({
        id: 'b',
        name: 'B',
        address: 0x2008,
        bytes: Uint8Array.from(new Array(16).fill(0)),
      });
      const issues = lintBlocks([a, b], SUPPORT, 0);
      expect(
        issues.some((i) => i.blockId === 'a' && i.severity === 'error'),
      ).toBe(true);
      expect(
        issues.some((i) => i.blockId === 'b' && i.severity === 'error'),
      ).toBe(true);
    });

    it('does not error on adjacent-but-not-overlapping blocks', () => {
      // a occupies [0x2000, 0x200F]; b starts immediately after at 0x2010.
      const a = block({
        id: 'a',
        name: 'A',
        address: 0x2000,
        bytes: Uint8Array.from(new Array(16).fill(0)),
      });
      const b = block({
        id: 'b',
        name: 'B',
        address: 0x2010,
        bytes: Uint8Array.from(new Array(16).fill(0)),
      });
      const issues = lintBlocks([a, b], SUPPORT, 0);
      expect(issues).toEqual([]);
    });

    it('errors when one block ends exactly on the byte the other starts on', () => {
      // a occupies [0x2000, 0x2010] (17 bytes) - its last byte is b's first.
      const a = block({
        id: 'a',
        name: 'A',
        address: 0x2000,
        bytes: Uint8Array.from(new Array(17).fill(0)),
      });
      const b = block({
        id: 'b',
        name: 'B',
        address: 0x2010,
        bytes: Uint8Array.from(new Array(16).fill(0)),
      });
      const issues = lintBlocks([a, b], SUPPORT, 0);
      expect(
        issues.some((i) => i.blockId === 'a' && i.severity === 'error'),
      ).toBe(true);
      expect(
        issues.some((i) => i.blockId === 'b' && i.severity === 'error'),
      ).toBe(true);
    });
  });

  describe('program-area overlap', () => {
    it('errors when a block overlaps the program area', () => {
      // programArea(0x100) = [0x3000, 0x30FF]
      const b = block({ address: 0x30f0, bytes: Uint8Array.from([1, 2]) });
      const issues = lintBlocks([b], SUPPORT, 0x100);
      expect(issues).toContainEqual(
        expect.objectContaining({ blockId: b.id, severity: 'error' }),
      );
    });

    it('does not error just below the program-area boundary', () => {
      // programArea(0x100) = [0x3000, 0x30FF]; block ends at 0x2FFF.
      const b = block({ address: 0x2ffe, bytes: Uint8Array.from([1, 2]) });
      const issues = lintBlocks([b], SUPPORT, 0x100);
      expect(issues.filter((i) => i.blockId === b.id)).toEqual([]);
    });

    it('errors exactly at the program-area start boundary', () => {
      const b = block({ address: 0x3000, bytes: Uint8Array.from([1]) });
      const issues = lintBlocks([b], SUPPORT, 0x100);
      expect(
        issues.some((i) => i.blockId === b.id && i.severity === 'error'),
      ).toBe(true);
    });

    it('respects a larger programByteSize (grows the program-area boundary)', () => {
      // With a bigger program, the same block address now collides.
      const b = block({ address: 0x30f0, bytes: Uint8Array.from([1]) });
      const smallProgram = lintBlocks([b], SUPPORT, 0x10);
      const bigProgram = lintBlocks([b], SUPPORT, 0x200);
      expect(smallProgram.filter((i) => i.blockId === b.id)).toEqual([]);
      expect(
        bigProgram.some((i) => i.blockId === b.id && i.severity === 'error'),
      ).toBe(true);
    });
  });

  describe('reserved-range overlap', () => {
    it('warns (not errors) when a block overlaps a reserved range', () => {
      const b = block({ address: 0x1500, bytes: Uint8Array.from([1, 2]) });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(issues).toContainEqual(
        expect.objectContaining({ blockId: b.id, severity: 'warning' }),
      );
      expect(
        issues.some((i) => i.blockId === b.id && i.severity === 'error'),
      ).toBe(false);
    });

    it('does not warn just past the reserved range', () => {
      // reserved = [0x1000, 0x1FFF]; block occupies [0x2000, 0x2001].
      const b = block({ address: 0x2000, bytes: Uint8Array.from([1, 2]) });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(issues).toEqual([]);
    });

    it('warns when a block ends exactly on the reserved range boundary', () => {
      // reserved ends at 0x1FFF; block occupies [0x1FFE, 0x1FFF].
      const b = block({ address: 0x1ffe, bytes: Uint8Array.from([1, 2]) });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(issues).toContainEqual(
        expect.objectContaining({ blockId: b.id, severity: 'warning' }),
      );
    });
  });

  describe('duplicate/invalid names', () => {
    it('errors on a duplicate block name', () => {
      const a = block({ id: 'a', name: 'SAME', address: 0x2000 });
      const b = block({ id: 'b', name: 'SAME', address: 0x2100 });
      const issues = lintBlocks([a, b], SUPPORT, 0);
      expect(
        issues.some((i) => i.blockId === 'a' && i.severity === 'error'),
      ).toBe(true);
      expect(
        issues.some((i) => i.blockId === 'b' && i.severity === 'error'),
      ).toBe(true);
    });

    it('errors on an invalid block name', () => {
      const b = block({ name: '1BAD' });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(issues).toContainEqual(
        expect.objectContaining({ blockId: b.id, severity: 'error' }),
      );
    });

    it('does not flag a valid, unique name', () => {
      const b = block({ name: 'Valid_Name1' });
      const issues = lintBlocks([b], SUPPORT, 0);
      expect(issues).toEqual([]);
    });
  });

  describe('zero-length blocks', () => {
    it('never collides with anything, even outside validRanges', () => {
      const b = block({ address: 0x0000, bytes: new Uint8Array(0) });
      const issues = lintBlocks([b], SUPPORT, 100);
      expect(issues).toEqual([]);
    });

    it('still gets name validation', () => {
      const b = block({ name: '9bad', bytes: new Uint8Array(0) });
      const issues = lintBlocks([b], SUPPORT, 100);
      expect(issues).toContainEqual(
        expect.objectContaining({ blockId: b.id, severity: 'error' }),
      );
    });
  });

  it('reports multiple distinct issues for one badly-placed, badly-named block', () => {
    // Outside validRanges AND an invalid name.
    const b = block({ name: '0bad', address: 0x0000 });
    const issues = lintBlocks([b], SUPPORT, 0);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
