import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync } from 'fflate';
import {
  serializeProjectZip,
  parseProjectZip,
  serializeBlocks,
  isValidBlockName,
  findDuplicateBlockName,
} from './projectFile';
import type { MemoryBlock, TapeFile } from '../dialects/types';

const enc = new TextEncoder();

const BLOCK_A: MemoryBlock = {
  id: 'blk-1',
  name: 'SPRITES',
  address: 0x8000,
  bytes: Uint8Array.from([1, 2, 3, 4, 255]),
  kind: 'data',
  comment: 'Player sprite table',
};

const BLOCK_B: MemoryBlock = {
  id: 'blk-2',
  name: 'ROUTINE',
  address: 0x9000,
  bytes: Uint8Array.from([0x21, 0x00, 0x80, 0xc9]),
  kind: 'code',
};

// Open synthesises a block id from the (unique) name, so a parsed block's id
// differs from the input's - see `parseProjectZip`.
const opened = (b: MemoryBlock): MemoryBlock => ({
  ...b,
  id: `block-${b.name}`,
});

/** Read the entry paths in a serialized project zip. */
const entryNames = (zip: Uint8Array): string[] =>
  Object.keys(unzipSync(zip)).sort();

/** Build a raw zip from a path -> text map (for crafting invalid archives). */
const rawZip = (files: Record<string, string>): Uint8Array => {
  const map: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) map[k] = enc.encode(v);
  return zipSync(map);
};

describe('serializeProjectZip / parseProjectZip round-trip', () => {
  it('round-trips source with no blocks', () => {
    const parsed = parseProjectZip(
      serializeProjectZip('zx81', '10 PRINT "HI"\n', []),
    );
    expect(parsed.dialect).toBe('zx81');
    expect(parsed.source).toBe('10 PRINT "HI"\n');
    expect(parsed.blocks).toEqual([]);
    expect(parsed.autoStart).toBeNull();
  });

  it('lays the parts out as first-class zip entries', () => {
    const zip = serializeProjectZip('zx81', '10 PRINT', [BLOCK_A, BLOCK_B]);
    expect(entryNames(zip)).toEqual([
      // BLOCK_B is a code block with a stub asmSource? No - it has none here,
      // so only its .bin appears; BLOCK_A is data (.bin only).
      'blocks/ROUTINE.bin',
      'blocks/SPRITES.bin',
      'program.bas',
      'project.json',
    ]);
  });

  it('writes a code block asmSource as its own .asm entry', () => {
    const withAsm: MemoryBlock = { ...BLOCK_B, asmSource: 'start:\n  RET\n' };
    const zip = serializeProjectZip('zx81', '', [withAsm]);
    expect(entryNames(zip)).toContain('blocks/ROUTINE.asm');
    const files = unzipSync(zip);
    expect(new TextDecoder().decode(files['blocks/ROUTINE.asm'])).toBe(
      'start:\n  RET\n',
    );
  });

  it('round-trips an auto-start line, and defaults to null when absent', () => {
    const withLine = parseProjectZip(
      serializeProjectZip('zxspectrum', '10 PRINT "HI"', [], 40),
    );
    expect(withLine.autoStart).toBe(40);
    const without = parseProjectZip(
      serializeProjectZip('zxspectrum', '10 X', []),
    );
    expect(without.autoStart).toBeNull();
  });

  it('round-trips tape files, and defaults to [] when absent', () => {
    const tapeFiles: TapeFile[] = [
      {
        name: 'LOADER',
        kind: 'program',
        tap: Uint8Array.from([1, 2, 0, 255, 128]),
      },
      { name: 'NUMS', kind: 'data-num', tap: Uint8Array.from([0, 255]) },
    ];
    const parsed = parseProjectZip(
      serializeProjectZip('zxspectrum', '10 PRINT "HI"', [], null, tapeFiles),
    );
    expect(parsed.tapeFiles).toHaveLength(2);
    expect(parsed.tapeFiles[0]).toEqual(tapeFiles[0]);
    expect(Array.from(parsed.tapeFiles[0]!.tap)).toEqual([1, 2, 0, 255, 128]);
    expect(parsed.tapeFiles[1]!.kind).toBe('data-num');
    const without = parseProjectZip(
      serializeProjectZip('zxspectrum', '10 X', []),
    );
    expect(without.tapeFiles).toEqual([]);
  });

  it('round-trips a verbatim boot-disc image', () => {
    const disc = Uint8Array.from({ length: 40 }, (_, i) => (i * 7) & 0xff);
    const parsed = parseProjectZip(
      serializeProjectZip('bbcmicro', '10 REM loader', [], null, [], {}, disc),
    );
    expect(parsed.bootDisc).not.toBeNull();
    expect(Array.from(parsed.bootDisc!)).toEqual(Array.from(disc));
    const without = parseProjectZip(
      serializeProjectZip('bbcmicro', '10 X', []),
    );
    expect(without.bootDisc).toBeNull();
  });

  it('round-trips per-ordinal listing block metadata', () => {
    const meta = { 0: { name: 'LOADER', comment: 'hi', asmSource: 'RET' } };
    const parsed = parseProjectZip(
      serializeProjectZip('zx81', '10 REM', [], null, [], meta),
    );
    expect(parsed.listingBlockMeta[0]).toEqual({
      name: 'LOADER',
      comment: 'hi',
      asmSource: 'RET',
    });
  });

  it('round-trips blocks, including bytes and the optional comment', () => {
    const parsed = parseProjectZip(
      serializeProjectZip('zxspectrum', '10 PRINT "HI"', [BLOCK_A, BLOCK_B]),
    );
    expect(parsed.dialect).toBe('zxspectrum');
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0]).toEqual(opened(BLOCK_A));
    expect(parsed.blocks[1]).toEqual(opened(BLOCK_B));
  });

  it('preserves byte values exactly, including 0x00 and 0xff', () => {
    const block: MemoryBlock = {
      id: 'x',
      name: 'B',
      address: 0,
      bytes: Uint8Array.from([0, 255, 128, 1]),
      kind: 'data',
    };
    const parsed = parseProjectZip(serializeProjectZip('zx81', '', [block]));
    expect(Array.from(parsed.blocks[0]!.bytes)).toEqual([0, 255, 128, 1]);
  });

  it('round-trips the optional entry address and omits it when absent', () => {
    const withEntry: MemoryBlock = { ...BLOCK_B, entry: 0x9010 };
    const parsed = parseProjectZip(
      serializeProjectZip('atom', '', [withEntry]),
    );
    expect(parsed.blocks[0]!.entry).toBe(0x9010);
    const without = parseProjectZip(serializeProjectZip('atom', '', [BLOCK_B]));
    expect('entry' in without.blocks[0]!).toBe(false);
  });

  it('round-trips scratch buffers as their own .bas entries', () => {
    const buffers = [
      { name: 'Scratch 1', text: '10 PRINT "A"' },
      { name: 'Notes', text: '20 REM keep me' },
    ];
    const zip = serializeProjectZip(
      'zx81',
      '10 REM program',
      [],
      null,
      [],
      {},
      null,
      buffers,
    );
    expect(entryNames(zip)).toContain('scratch/0.bas');
    expect(entryNames(zip)).toContain('scratch/1.bas');
    const parsed = parseProjectZip(zip);
    expect(parsed.scratch).toEqual(buffers);
    expect(parsed.source).toBe('10 REM program');
  });

  // Scratch names are free-form and non-unique, which is why entries are named
  // by ordinal rather than by name as block entries are.
  it('keeps both buffers when two share a name', () => {
    const buffers = [
      { name: 'Scratch 1', text: 'first' },
      { name: 'Scratch 1', text: 'second' },
    ];
    const parsed = parseProjectZip(
      serializeProjectZip('zx81', '', [], null, [], {}, null, buffers),
    );
    expect(parsed.scratch).toEqual(buffers);
  });

  it('parses a bundle with no scratch field to no buffers', () => {
    const zip = serializeProjectZip('zx81', '10 X', []);
    expect(entryNames(zip).some((n) => n.startsWith('scratch/'))).toBe(false);
    expect(parseProjectZip(zip).scratch).toEqual([]);
  });

  it('round-trips the optional asmSource and omits it when absent', () => {
    const source = 'start:\n  LD HL,$8000 ; comment survives verbatim\n  RET';
    const withAsm: MemoryBlock = { ...BLOCK_B, asmSource: source };
    const parsed = parseProjectZip(serializeProjectZip('zx81', '', [withAsm]));
    expect(parsed.blocks[0]!.asmSource).toBe(source);
    const without = parseProjectZip(serializeProjectZip('zx81', '', [BLOCK_B]));
    expect('asmSource' in without.blocks[0]!).toBe(false);
  });
});

describe('parseProjectZip error handling', () => {
  const validMeta = {
    format: 'basically-project',
    version: 2,
    dialect: 'zx81',
    source: 'program.bas',
    blocks: [],
  };
  const zipWithMeta = (meta: unknown, extra: Record<string, string> = {}) =>
    rawZip({
      'program.bas': '10 PRINT',
      'project.json': JSON.stringify(meta),
      ...extra,
    });

  it('throws when the bytes are not a zip', () => {
    expect(() => parseProjectZip(enc.encode('not a zip'))).toThrow(
      /could not read the archive/i,
    );
  });

  it('throws when project.json is missing', () => {
    expect(() => parseProjectZip(rawZip({ 'program.bas': '10 X' }))).toThrow(
      /project\.json/,
    );
  });

  it('throws when project.json is malformed', () => {
    expect(() =>
      parseProjectZip(rawZip({ 'project.json': '{not json' })),
    ).toThrow();
  });

  it('throws when format is wrong', () => {
    expect(() =>
      parseProjectZip(zipWithMeta({ ...validMeta, format: 'other' })),
    ).toThrow();
  });

  it('throws on an unsupported version', () => {
    expect(() =>
      parseProjectZip(zipWithMeta({ ...validMeta, version: 1 })),
    ).toThrow(/version/i);
  });

  it('throws when dialect is missing', () => {
    const { dialect: _drop, ...noDialect } = validMeta;
    void _drop;
    expect(() => parseProjectZip(zipWithMeta(noDialect))).toThrow();
  });

  it('throws when the source entry is missing from the archive', () => {
    // Metadata names program.bas but the entry is absent.
    const zip = rawZip({ 'project.json': JSON.stringify(validMeta) });
    expect(() => parseProjectZip(zip)).toThrow(/source entry/);
  });

  it('throws when blocks is not an array', () => {
    expect(() =>
      parseProjectZip(zipWithMeta({ ...validMeta, blocks: 'nope' })),
    ).toThrow();
  });

  it("throws when a block's referenced .bin entry is missing", () => {
    const meta = {
      ...validMeta,
      blocks: [{ name: 'B', address: 0, kind: 'data', bin: 'blocks/B.bin' }],
    };
    // No blocks/B.bin entry in the archive.
    expect(() => parseProjectZip(zipWithMeta(meta))).toThrow(/missing entry/);
  });

  it('throws when a block has an invalid kind', () => {
    const meta = {
      ...validMeta,
      blocks: [
        { name: 'B', address: 0, kind: 'nonsense', bin: 'blocks/B.bin' },
      ],
    };
    expect(() =>
      parseProjectZip(zipWithMeta(meta, { 'blocks/B.bin': 'x' })),
    ).toThrow();
  });

  it('throws when a block name is invalid', () => {
    const meta = {
      ...validMeta,
      blocks: [
        { name: '1foo', address: 0, kind: 'data', bin: 'blocks/1foo.bin' },
      ],
    };
    expect(() =>
      parseProjectZip(zipWithMeta(meta, { 'blocks/1foo.bin': 'x' })),
    ).toThrow();
  });

  it('throws when "scratch" is not an array', () => {
    expect(() =>
      parseProjectZip(zipWithMeta({ ...validMeta, scratch: 'nope' })),
    ).toThrow(/malformed "scratch"/i);
  });

  it('throws when a scratch buffer references a missing entry', () => {
    const meta = {
      ...validMeta,
      scratch: [{ name: 'Scratch 1', file: 'scratch/0.bas' }],
    };
    expect(() => parseProjectZip(zipWithMeta(meta))).toThrow(/missing entry/i);
  });

  it('throws when a scratch buffer is missing its name', () => {
    const meta = { ...validMeta, scratch: [{ file: 'scratch/0.bas' }] };
    expect(() =>
      parseProjectZip(zipWithMeta(meta, { 'scratch/0.bas': 'x' })),
    ).toThrow(/scratch buffer 0 is missing a "name"/i);
  });

  it('throws when two blocks share a name', () => {
    const meta = {
      ...validMeta,
      blocks: [
        { name: 'SAME', address: 0, kind: 'data', bin: 'blocks/SAME.bin' },
        { name: 'SAME', address: 1, kind: 'data', bin: 'blocks/SAME.bin' },
      ],
    };
    expect(() =>
      parseProjectZip(zipWithMeta(meta, { 'blocks/SAME.bin': 'x' })),
    ).toThrow(/more than one/i);
  });
});

describe('serializeBlocks', () => {
  it('base64-encodes bytes for the wire (autosave codec)', () => {
    const [wire] = serializeBlocks([BLOCK_A]);
    expect(typeof wire!.bytes).toBe('string');
    expect(wire!.id).toBe('blk-1');
  });
});

describe('isValidBlockName', () => {
  it('accepts a single letter', () => {
    expect(isValidBlockName('A')).toBe(true);
  });

  it('accepts letters, digits, and underscores after the first letter', () => {
    expect(isValidBlockName('Sprite_Table2')).toBe(true);
  });

  it('rejects a name starting with a digit', () => {
    expect(isValidBlockName('1foo')).toBe(false);
  });

  it('rejects a name starting with an underscore', () => {
    expect(isValidBlockName('_foo')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidBlockName('has spaces')).toBe(false);
  });

  it('rejects punctuation', () => {
    expect(isValidBlockName('foo-bar')).toBe(false);
    expect(isValidBlockName('foo.bar')).toBe(false);
    expect(isValidBlockName('foo$')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidBlockName('')).toBe(false);
  });
});

describe('findDuplicateBlockName', () => {
  it('returns null when all names are unique', () => {
    expect(
      findDuplicateBlockName([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
    ).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findDuplicateBlockName([])).toBeNull();
  });

  it('returns the repeated name when two entries share one', () => {
    expect(
      findDuplicateBlockName([{ name: 'A' }, { name: 'B' }, { name: 'A' }]),
    ).toBe('A');
  });
});
