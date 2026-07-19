import { describe, expect, it } from 'vitest';
import { isD64, parseD64, buildD64 } from './d64';
import { detokenizeD64WithReport } from './detokenizer';
import { exportD64Entries } from './targets';
import { tokenizeProgram } from './tokenizer';
import type { MemoryBlock } from '../types';

const LOADER_SOURCE = '10 PRINT "LOADING"\n';
const GAME_SOURCE = '10 POKE 53280,0\n20 PRINT "THE ACTUAL GAME"\n30 GOTO 20\n';

/** Bare tokenized program bytes (no load-address word), as a file stores them. */
function programBytes(source: string): Uint8Array {
  return tokenizeProgram(source).program;
}

describe('isD64 / parseD64', () => {
  it('recognises a 35-track image and rejects other sizes', () => {
    const image = buildD64([
      { name: 'GAME', start: 0x0801, bytes: programBytes(GAME_SOURCE) },
    ]);
    expect(image).toHaveLength(174848);
    expect(isD64(image)).toBe(true);
    expect(isD64(new Uint8Array(174848 + 1))).toBe(false);
    expect(isD64(new Uint8Array(10))).toBe(false);
    expect(() => parseD64(new Uint8Array(10))).toThrow(/not a .d64/i);
  });

  it('reads entries with their name, start address and payload', () => {
    const game = programBytes(GAME_SOURCE);
    const code = Uint8Array.of(0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60);
    const image = buildD64([
      { name: 'GAME', start: 0x0801, bytes: game },
      { name: 'SPRITES', start: 0xc000, bytes: code },
    ]);
    const { entries, warnings } = parseD64(image);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ name: 'GAME', start: 0x0801 });
    expect(Array.from(entries[0]!.bytes)).toEqual(Array.from(game));
    expect(entries[1]).toMatchObject({ name: 'SPRITES', start: 0xc000 });
    expect(Array.from(entries[1]!.bytes)).toEqual(Array.from(code));
  });

  it('round-trips a file that spans several sectors', () => {
    // > 254 data bytes forces a multi-sector chain, exercising the links.
    const big = new Uint8Array(1000);
    for (let i = 0; i < big.length; i++) big[i] = i & 0xff;
    const image = buildD64([{ name: 'BIG', start: 0xc000, bytes: big }]);
    const { entries } = parseD64(image);
    expect(entries).toHaveLength(1);
    expect(Array.from(entries[0]!.bytes)).toEqual(Array.from(big));
  });

  it('reflects used blocks in the BAM free counts', () => {
    const image = buildD64([
      { name: 'GAME', start: 0x0801, bytes: programBytes(GAME_SOURCE) },
    ]);
    // BAM sits at track 18, sector 0. Track 1, sector 0 holds the file data, so
    // track 1's free count (byte $04) is one below its 21 sectors.
    const bam = 17 * 21 * 256; // track 18 starts after 17 tracks of 21 sectors
    expect(image[bam]).toBe(18); // first directory sector track
    expect(image[bam + 1]).toBe(1); // first directory sector
    expect(image[bam + 2]).toBe(0x41); // DOS version 'A'
    expect(image[bam + 4]).toBe(20); // track 1: 21 sectors, one used
  });
});

describe('detokenizeD64WithReport', () => {
  it('opens the largest BASIC entry, preserving the loader and code', () => {
    const loader = programBytes(LOADER_SOURCE);
    const game = programBytes(GAME_SOURCE);
    const code = Uint8Array.of(0xa9, 0x00, 0x60);
    const image = buildD64([
      { name: 'LOADER', start: 0x0801, bytes: loader },
      { name: 'GAME', start: 0x0801, bytes: game },
      { name: 'SPRITES', start: 0xc000, bytes: code },
    ]);
    const report = detokenizeD64WithReport(image);
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]).toMatchObject({
      name: 'SPRITES',
      address: 0xc000,
      kind: 'code',
    });
    expect(report.tapeFiles).toHaveLength(1);
    expect(report.tapeFiles![0]!.name).toBe('LOADER');
    // The preserved payload is a ready .prg: load address word + program.
    expect(Array.from(report.tapeFiles![0]!.tap)).toEqual([
      0x01,
      0x08,
      ...loader,
    ]);
    expect(report.warnings.some((w) => /Multi-file disk image/.test(w))).toBe(
      true,
    );
  });

  it('imports a code-only .d64 as blocks with an explanatory warning', () => {
    const image = buildD64([
      { name: 'RASTER', start: 0xc000, bytes: Uint8Array.of(0x60) },
    ]);
    const report = detokenizeD64WithReport(image);
    expect(report.source).toBe('');
    expect(report.blocks).toHaveLength(1);
    expect(report.warnings.some((w) => /no C64 BASIC program/.test(w))).toBe(
      true,
    );
  });

  it('keeps a single-program .d64 clean of multi-part warnings', () => {
    const image = buildD64([
      { name: 'GAME', start: 0x0801, bytes: programBytes(GAME_SOURCE) },
    ]);
    const report = detokenizeD64WithReport(image);
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.warnings).toEqual([]);
    expect(report.blocks).toBeUndefined();
    expect(report.tapeFiles).toBeUndefined();
  });
});

describe('buildD64 export', () => {
  const block: MemoryBlock = {
    id: 'b1',
    name: 'SPRITES',
    address: 0xc000,
    bytes: Uint8Array.of(0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60),
    kind: 'code',
  };

  it('round-trips a program + block through detokenizeD64WithReport', () => {
    const image = buildD64(exportD64Entries(GAME_SOURCE, 'GAME', [block]));
    const report = detokenizeD64WithReport(image);
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]).toMatchObject({ address: 0xc000, kind: 'code' });
    expect(Array.from(report.blocks![0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(report.tapeFiles ?? []).toEqual([]);
  });

  it('with a loader, keeps the main program and preserves the loader', () => {
    const image = buildD64(
      exportD64Entries(GAME_SOURCE, 'GAME', [block], true),
    );
    const report = detokenizeD64WithReport(image);
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.blocks).toHaveLength(1);
    expect(Array.from(report.blocks![0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(report.tapeFiles).toHaveLength(1);
  });
});
