import { describe, expect, it } from 'vitest';
import { hb10pMemoryMap } from './memoryMap';
import { hb10pMemoryBlocks } from './memoryBlocks';
import { TXTTAB } from './addresses';
import { memoryBands } from '../../components/memoryBands';

/**
 * The map's own shape, and the agreement it has to keep with the block linter.
 *
 * The cross-dialect invariants (tiling, one screen region, group collapse) are
 * checked for every registered dialect in `src/dialects/memoryMap.test.ts`;
 * what is here is what only this machine can say - where its ROM, its two RAM
 * pools and its system area actually sit, and that a memory block cannot be
 * placed on top of any of them.
 */
const regions = hb10pMemoryMap.regions;
const labelled = (label: string) => regions.find((r) => r.label === label)!;

describe('hb10p memory map', () => {
  it('tiles the whole 64K address space', () => {
    expect(hb10pMemoryMap.addressSpace).toBe(0x10000);
    expect(regions[0]!.start).toBe(0);
    expect(regions[regions.length - 1]!.end).toBe(0xffff);
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i]!.start).toBe(regions[i - 1]!.end + 1);
    }
  });

  it('names the BIOS, BASIC ROM, program area and system variables', () => {
    // Slot 0's two ROM pages fill the bottom 32K; the rest is slot 3's RAM.
    expect(labelled('MSX BIOS')).toMatchObject({
      start: 0x0000,
      end: 0x3fff,
      kind: 'rom',
    });
    expect(labelled('MSX BASIC')).toMatchObject({
      start: 0x4000,
      end: 0x7fff,
      kind: 'rom',
    });
    expect(labelled('Available memory')).toMatchObject({
      start: 0x8000,
      kind: 'program',
    });
    // Both RAM pools a program spends are drawn, and both are program RAM.
    expect(labelled('String space')).toMatchObject({
      start: 0xf0a0,
      end: 0xf167,
      kind: 'program',
    });
    expect(labelled('Slot handling and USR table').start).toBe(0xf380);
    expect(labelled('BIOS hooks')).toMatchObject({
      start: 0xfd9a,
      end: 0xffc9,
    });
  });

  it('draws no screen or attribute region, because the picture is elsewhere', () => {
    // The VDP's 16K is a second address space no CPU address reaches, so a
    // screen band here would be a lie a reader would POKE into.
    expect(regions.some((r) => r.kind === 'screen')).toBe(false);
    expect(regions.some((r) => r.kind === 'attributes')).toBe(false);
    expect(labelled('Available memory').note).toContain('VPOKE');
  });

  it('opens its grouping bands into sub-regions when zoomed in', () => {
    const coarse = memoryBands(hb10pMemoryMap, false).map((b) => b.label);
    const detailed = memoryBands(hb10pMemoryMap, true).map((b) => b.label);
    expect(coarse).toContain('System variables');
    expect(coarse).not.toContain('BIOS hooks');
    expect(detailed).toContain('BIOS hooks');
    expect(detailed.length).toBeGreaterThan(coarse.length);
  });

  it('agrees with memoryBlocks about where the program area starts', () => {
    // The viewer derives its load base from the first `program` region, and the
    // linter its program area from TXTTAB; a machine cannot have two answers.
    const program = regions.find((r) => r.kind === 'program')!;
    expect(program.start).toBe(TXTTAB - 1);
    expect(hb10pMemoryBlocks.programArea(0).start).toBe(program.start);
  });

  it('reserves every region a block would clobber', () => {
    // Valid RAM is exactly the half of the address space the ROMs do not
    // answer in, and everything from the string space up is spoken for.
    expect(hb10pMemoryBlocks.validRanges).toEqual([
      { start: 0x8000, end: 0xffff },
    ]);
    const reserved = hb10pMemoryBlocks.reservedRanges;
    expect(reserved).toEqual([{ start: 0xf0a0, end: 0xffff }]);
    expect(reserved[0]!.start).toBe(labelled('String space').start);

    const free = (addr: number) =>
      reserved.every((r) => addr < r.start || addr > r.end);
    expect(free(hb10pMemoryBlocks.defaultAddress)).toBe(true);
    for (const label of ['File buffers', 'BIOS hooks', 'Top of memory']) {
      expect(free(labelled(label).start), label).toBe(false);
    }
  });
});
