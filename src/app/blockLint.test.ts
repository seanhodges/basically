import { describe, expect, it } from 'vitest';
import type { Block, MemoryBlocksSupport } from '../dialects/types';
import { lintBlocks } from './blockLint';
import { programVocabulary } from './programVocabulary';
import { getDialect } from '../dialects/registry';
import { spectrumMemoryBlocks } from '../dialects/zxspectrum/memoryBlocks';
import { atomMemoryBlocks } from '../dialects/atom/memoryBlocks';
import { bbcMicroMemoryBlocks } from '../dialects/bbcmicro/memoryBlocks';

const atom = getDialect('atom');
const bbcmicro = getDialect('bbcmicro');
const spectrum = getDialect('zxspectrum');

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

function block(overrides: Partial<Block> = {}): Block {
  return {
    id: 'blk-1',
    name: 'FOO',
    address: 0x2000,
    bytes: Uint8Array.from([1, 2, 3, 4]),
    kind: 'memory',
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

    it('flags every block in every duplicate-name group, not just the first', () => {
      // Two separate duplicate groups: A/A and B/B. A fail-fast "first
      // duplicate only" check would report just the A pair and silently miss
      // B/B entirely.
      const a1 = block({ id: 'a1', name: 'A', address: 0x2000 });
      const a2 = block({ id: 'a2', name: 'A', address: 0x2010 });
      const b1 = block({ id: 'b1', name: 'B', address: 0x2020 });
      const b2 = block({ id: 'b2', name: 'B', address: 0x2030 });
      const issues = lintBlocks([a1, a2, b1, b2], SUPPORT, 0);
      for (const id of ['a1', 'a2', 'b1', 'b2']) {
        expect(
          issues.some(
            (i) =>
              i.blockId === id &&
              i.kind === 'duplicate-name' &&
              i.severity === 'error',
          ),
        ).toBe(true);
      }
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

  // Everything above uses SUPPORT, a fixture chosen for easy boundary math.
  // This wires the *real* dialect figures (`spectrumMemoryBlocks`) through the
  // linter, so the two agree on an actual machine's memory map, not just a
  // stand-in.
  describe('real ZX Spectrum figures (spectrumMemoryBlocks)', () => {
    it('reports no error issues for a valid code block at the suggested default address', () => {
      const b: Block = {
        id: 'blk-1',
        name: 'Code',
        address: spectrumMemoryBlocks.defaultAddress,
        bytes: Uint8Array.from([0x3e, 0x02, 0xd3, 0xfe, 0xc9]),
        kind: 'code',
      };
      const issues = lintBlocks([b], spectrumMemoryBlocks, 100);
      expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    });

    it('warns (not errors) on a block overlapping the reserved display area at 0x4000', () => {
      const b: Block = {
        id: 'blk-2',
        name: 'Screen',
        address: 0x4000,
        bytes: Uint8Array.from([1, 2, 3]),
        kind: 'memory',
      };
      const issues = lintBlocks([b], spectrumMemoryBlocks, 100);
      expect(issues).toContainEqual(
        expect.objectContaining({
          blockId: b.id,
          kind: 'reserved-overlap',
          severity: 'warning',
        }),
      );
      expect(
        issues.some((i) => i.blockId === b.id && i.severity === 'error'),
      ).toBe(false);
    });

    // The Spectrum declares no conditionally free region, and a vocabulary is
    // no reason to lint it differently: the whole feature is opt-in per machine.
    it('lints the same with a vocabulary as without one', () => {
      const b: Block = {
        id: 'blk-3',
        name: 'Screen',
        address: 0x4000,
        bytes: Uint8Array.from([1, 2, 3]),
        kind: 'memory',
      };
      const vocabulary = programVocabulary('10 PRINT "HI"', spectrum);
      expect(lintBlocks([b], spectrumMemoryBlocks, 100, vocabulary)).toEqual(
        lintBlocks([b], spectrumMemoryBlocks, 100),
      );
    });
  });

  /**
   * The Atom's video RAM: a region *outside* every valid range, so the met
   * condition is the only thing that permits the placement at all. The BBC's
   * band is the other shape - already valid, warned about blanketly - and gets
   * its own group below.
   */
  describe('conditionally free memory (real Atom figures)', () => {
    const videoBlock = (): Block => ({
      id: 'blk-v',
      name: 'Data',
      address: 0x8400,
      bytes: Uint8Array.from([1, 2, 3, 4]),
      kind: 'memory',
    });

    function lintAtom(source: string) {
      return lintBlocks(
        [videoBlock()],
        atomMemoryBlocks,
        100,
        programVocabulary(source, atom),
      );
    }

    it('accepts a block there while the program stays in text mode', () => {
      const issues = lintAtom('10 CLEAR 0;PRINT "HI"');
      expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(issues).toEqual([
        expect.objectContaining({
          kind: 'conditionally-free',
          severity: 'warning',
        }),
      ]);
    });

    // The condition is what the placement leans on, so the warning says it: a
    // program that later grows a graphics mode has a thread to pull rather than
    // a block silently overwritten at run time.
    it('names the condition the accepted placement depends on', () => {
      expect(lintAtom('10 CLEAR 0')[0]?.message).toContain(
        'free only while the program stays in text mode (CLEAR 0)',
      );
    });

    it('treats a program that selects no mode as being in the boot mode', () => {
      expect(lintAtom('10 PRINT "HI"').map((i) => i.kind)).toEqual([
        'conditionally-free',
      ]);
    });

    it('refuses the block when the program selects a graphics mode', () => {
      const issues = lintAtom('10 CLEAR 4');
      expect(issues.map((i) => i.kind)).toEqual(['outside-valid-range']);
      expect(issues[0]?.severity).toBe('error');
    });

    // The refusal names what would make the placement legal, which is the only
    // thing that makes it answerable rather than merely final.
    it('names the condition in the refusal too', () => {
      expect(lintAtom('10 CLEAR 4')[0]?.message).toContain(
        'would be free only while the program stays in text mode (CLEAR 0)',
      );
    });

    it('refuses the block when the mode is computed rather than written', () => {
      expect(lintAtom('10 CLEAR M').map((i) => i.kind)).toEqual([
        'outside-valid-range',
      ]);
    });

    // The loophole the write check closes: a program that never names a mode at
    // all, and pokes the region directly.
    it('refuses the block when the program writes inside the region', () => {
      expect(lintAtom('10 ?#8500=255').map((i) => i.kind)).toEqual([
        'outside-valid-range',
      ]);
    });

    it('refuses the block when no vocabulary is supplied', () => {
      // Absence of knowledge is not permission: with no program to read, there
      // is nothing to prove the region free with.
      const issues = lintBlocks([videoBlock()], atomMemoryBlocks, 100);
      expect(issues.map((i) => i.kind)).toEqual(['outside-valid-range']);
    });

    it('leaves a block in the ordinary RAM window alone either way', () => {
      const b: Block = { ...videoBlock(), address: 0x3800 };
      expect(
        lintBlocks(
          [b],
          atomMemoryBlocks,
          100,
          programVocabulary('10 CLEAR 4', atom),
        ),
      ).toEqual([]);
    });
  });

  describe('conditionally free memory (real BBC Micro figures)', () => {
    const bandBlock = (): Block => ({
      id: 'blk-b',
      name: 'Data',
      address: 0x3000,
      bytes: Uint8Array.from([1, 2, 3, 4]),
      kind: 'memory',
    });

    function lintBbc(source: string) {
      return lintBlocks(
        [bandBlock()],
        bbcMicroMemoryBlocks,
        100,
        programVocabulary(source, bbcmicro),
      );
    }

    // The band is valid RAM already, so what the met condition changes here is
    // the *warning*: the specific finding replaces the blanket screen one
    // rather than stacking on top of it.
    it('replaces the blanket screen warning while the program stays in MODE 7', () => {
      expect(lintBbc('10 MODE 7').map((i) => i.kind)).toEqual([
        'conditionally-free',
      ]);
    });

    it('keeps the blanket screen warning once a graphics mode is selected', () => {
      expect(lintBbc('10 MODE 1').map((i) => i.kind)).toEqual([
        'reserved-overlap',
      ]);
    });

    it('keeps the blanket screen warning when no program is read', () => {
      expect(
        lintBlocks([bandBlock()], bbcMicroMemoryBlocks, 100).map((i) => i.kind),
      ).toEqual(['reserved-overlap']);
    });

    // Above the band the teletext screen itself is live in every mode, so the
    // blanket warning is the right answer there and the condition does not
    // reach it.
    it('still warns about a block in the MODE 7 screen itself', () => {
      const b: Block = { ...bandBlock(), address: 0x7c00 };
      expect(
        lintBlocks(
          [b],
          bbcMicroMemoryBlocks,
          100,
          programVocabulary('10 MODE 7', bbcmicro),
        ).map((i) => i.kind),
      ).toEqual(['reserved-overlap']);
    });
  });
});
