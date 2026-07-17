import { describe, it, expect } from 'vitest';
import {
  serializeProject,
  parseProject,
  isProjectFile,
  serializeBlocks,
} from './projectFile';
import type { MemoryBlock } from '../dialects/types';

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

describe('serializeProject / parseProject round-trip', () => {
  it('round-trips source with no blocks', () => {
    const text = serializeProject('zx81', '10 PRINT "HI"\n', []);
    const parsed = parseProject(text);
    expect(parsed.dialect).toBe('zx81');
    expect(parsed.source).toBe('10 PRINT "HI"\n');
    expect(parsed.blocks).toEqual([]);
  });

  it('round-trips blocks, including bytes and the optional comment', () => {
    const text = serializeProject('zxspectrum', '10 PRINT "HI"', [
      BLOCK_A,
      BLOCK_B,
    ]);
    const parsed = parseProject(text);
    expect(parsed.dialect).toBe('zxspectrum');
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0]).toEqual(BLOCK_A);
    expect(parsed.blocks[1]).toEqual(BLOCK_B);
  });

  it('preserves byte values exactly, including 0x00 and 0xff', () => {
    const block: MemoryBlock = {
      id: 'x',
      name: 'B',
      address: 0,
      bytes: Uint8Array.from([0, 255, 128, 1]),
      kind: 'data',
    };
    const text = serializeProject('zx81', '', [block]);
    const parsed = parseProject(text);
    expect(Array.from(parsed.blocks[0]!.bytes)).toEqual([0, 255, 128, 1]);
  });

  it('produces human-readable, diffable JSON', () => {
    const text = serializeProject('zx81', '10 PRINT', []);
    expect(text).toContain('"format": "basically-project"');
    expect(text).toContain('"version": 1');
    // Pretty-printed, not minified.
    expect(text).toContain('\n');
  });

  it('omits the comment field on the wire when absent', () => {
    const text = serializeProject('zx81', '', [BLOCK_B]);
    const parsed: unknown = JSON.parse(text);
    const wireBlock = (parsed as { blocks: { comment?: string }[] }).blocks[0]!;
    expect('comment' in wireBlock).toBe(false);
  });
});

describe('parseProject error handling', () => {
  it('throws on malformed JSON', () => {
    expect(() => parseProject('{not json')).toThrow();
  });

  it('throws when format is missing', () => {
    const text = JSON.stringify({
      version: 1,
      dialect: 'zx81',
      source: '',
      blocks: [],
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws when format is wrong', () => {
    const text = JSON.stringify({
      format: 'something-else',
      version: 1,
      dialect: 'zx81',
      source: '',
      blocks: [],
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws on an unsupported version', () => {
    const text = JSON.stringify({
      format: 'basically-project',
      version: 2,
      dialect: 'zx81',
      source: '',
      blocks: [],
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws when dialect is missing', () => {
    const text = JSON.stringify({
      format: 'basically-project',
      version: 1,
      source: '',
      blocks: [],
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws when source is missing', () => {
    const text = JSON.stringify({
      format: 'basically-project',
      version: 1,
      dialect: 'zx81',
      blocks: [],
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws when blocks is not an array', () => {
    const text = JSON.stringify({
      format: 'basically-project',
      version: 1,
      dialect: 'zx81',
      source: '',
      blocks: 'nope',
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws when a block is missing a required field', () => {
    const text = JSON.stringify({
      format: 'basically-project',
      version: 1,
      dialect: 'zx81',
      source: '',
      blocks: [{ id: 'x', name: 'B', kind: 'data', bytes: 'AAA=' }], // no address
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws when a block has an invalid kind', () => {
    const text = JSON.stringify({
      format: 'basically-project',
      version: 1,
      dialect: 'zx81',
      source: '',
      blocks: [
        { id: 'x', name: 'B', address: 0, bytes: 'AAA=', kind: 'nonsense' },
      ],
    });
    expect(() => parseProject(text)).toThrow();
  });

  it('throws when a block has malformed base64 bytes', () => {
    const text = JSON.stringify({
      format: 'basically-project',
      version: 1,
      dialect: 'zx81',
      source: '',
      blocks: [
        {
          id: 'x',
          name: 'B',
          address: 0,
          bytes: '!!!not base64!!!',
          kind: 'data',
        },
      ],
    });
    expect(() => parseProject(text)).toThrow();
  });
});

describe('isProjectFile', () => {
  it('is true for a serialized project', () => {
    const text = serializeProject('zx81', '10 PRINT', []);
    expect(isProjectFile(text)).toBe(true);
  });

  it('is false for plain BASIC source', () => {
    expect(isProjectFile('10 PRINT "HI"\n20 GOTO 10')).toBe(false);
  });

  it('is false for unrelated JSON', () => {
    expect(isProjectFile(JSON.stringify({ hello: 'world' }))).toBe(false);
  });

  it('is false for malformed JSON', () => {
    expect(isProjectFile('{not json')).toBe(false);
  });

  it('is false for empty text', () => {
    expect(isProjectFile('')).toBe(false);
  });
});

describe('serializeBlocks', () => {
  it('base64-encodes bytes for the wire', () => {
    const [wire] = serializeBlocks([BLOCK_A]);
    expect(typeof wire!.bytes).toBe('string');
    expect(wire!.id).toBe('blk-1');
  });
});
