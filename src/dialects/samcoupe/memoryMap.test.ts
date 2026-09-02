import { describe, it, expect } from 'vitest';
import { samcoupeMemoryMap } from './memoryMap';
import { samcoupeMemoryBlocks } from './memoryBlocks';
import { ROM_BYTES, PAGE_BYTES } from './emulator/memory';

const { addressSpace, regions } = samcoupeMemoryMap;

/** Codes the font in RAM covers, from `POUDG` and the 25 UDGs above it. */
const FIRST_GLYPH = 0x20;
const FIRST_UDG = 0x90;
const LAST_UDG = 0xa8;
const GLYPH_BYTES = 8;

describe('samcoupeMemoryMap', () => {
  it('covers a 64K address space with contiguous ascending regions', () => {
    expect(addressSpace).toBe(0x10000);
    expect(regions[0]!.start).toBe(0);
    expect(regions[regions.length - 1]!.end).toBe(addressSpace - 1);
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i]!.start, regions[i]!.label).toBe(
        regions[i - 1]!.end + 1,
      );
      expect(regions[i]!.end).toBeGreaterThanOrEqual(regions[i]!.start);
    }
  });

  it('draws only the half of the 32K ROM the CPU sees at the bottom', () => {
    // ROM 1 is the other half, and it is paged into 0xC000-0xFFFF of the *CPU
    // window* - which is not this address space. PEEK 0xC000 reads RAM.
    const roms = regions.filter((r) => r.kind === 'rom');
    expect(roms.map((r) => r.label)).toEqual(['ROM 0']);
    expect(roms[0]!.end - roms[0]!.start + 1).toBe(ROM_BYTES / 2);
  });

  it("gives each of BASIC's first three pages a 16K span above the ROM", () => {
    const program = regions.filter((r) => r.kind === 'program');
    expect(program).toHaveLength(3);
    // The first is the tail of BASIC's own page, from PROG up; the two above it
    // are whole pages. Together they end at the top of the space, and the
    // fourth page runs on past it.
    expect(program[0]!.end).toBe(0x8000 - 1);
    expect(program[1]!.start).toBe(0x8000);
    expect(program[1]!.end - program[1]!.start + 1).toBe(PAGE_BYTES);
    expect(program[2]!.end - program[2]!.start + 1).toBe(PAGE_BYTES);
    expect(program[2]!.end).toBe(addressSpace - 1);
  });

  it('starts the program area where the block linter says the program begins', () => {
    // `memoryMapDetail`'s cross-dialect twin checks this for every registered
    // machine; asserted here too because this one is where the two spellings of
    // the same bytes could have drifted apart.
    const program = regions.find((r) => r.kind === 'program')!;
    expect(program.start).toBe(samcoupeMemoryBlocks.programArea(0).start);
  });

  it('reserves for blocks exactly what it draws as interpreter workspace', () => {
    const workspace = regions.filter(
      (r) => r.group === 'Interpreter workspace',
    );
    const reserved = samcoupeMemoryBlocks.reservedRanges;
    expect(workspace[0]!.start).toBe(reserved[0]!.start);
    expect(workspace[workspace.length - 1]!.end).toBe(
      reserved[reserved.length - 1]!.end,
    );
    // And a block may only be offered the page the workspace and the program
    // share, which is the one section the ROM's own paging never moves.
    expect(samcoupeMemoryBlocks.validRanges).toEqual([
      { start: workspace[0]!.start, end: 0x7fff },
    ]);
  });

  it('sizes the font and UDG bands to the glyphs they hold', () => {
    const font = regions.find((r) => r.label === 'Character set')!;
    const udg = regions.find((r) => r.label === 'User-defined graphics')!;
    // CHARS is biased so glyph c sits at CHARS + 8c, and the font starts at
    // code 32; the UDGs are simply the glyphs from code 144 up.
    expect(udg.start).toBe(
      font.start + (FIRST_UDG - FIRST_GLYPH) * GLYPH_BYTES,
    );
    expect(udg.end).toBe(
      font.start + (LAST_UDG + 1 - FIRST_GLYPH) * GLYPH_BYTES - 1,
    );
  });

  it('gives every region a note, and no region a borrowed colour', () => {
    for (const r of regions) {
      expect(r.note, r.label).toBeTruthy();
    }
    // The display lives in pages 14 and 15 of a 256K machine, four pages above
    // the top of this space, so there is no screen band to draw - and without
    // one an `attributes` band would mean something different here than
    // everywhere else.
    expect(regions.some((r) => r.kind === 'screen')).toBe(false);
    expect(regions.some((r) => r.kind === 'attributes')).toBe(false);
  });
});
