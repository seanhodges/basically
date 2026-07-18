import { describe, expect, it } from 'vitest';
import { codeFilesToBlocks, sanitizeBlockName } from './importBlocks';
import { isValidBlockName } from '../storage/projectFile';
import type { ImportedCodeFile } from './importBlocks';

describe('sanitizeBlockName', () => {
  it('passes through an already-valid name unchanged', () => {
    expect(sanitizeBlockName('screen', 'code1')).toBe('screen');
  });

  it('replaces spaces with underscores', () => {
    const name = sanitizeBlockName('my code', 'code1');
    expect(isValidBlockName(name)).toBe(true);
    expect(name).toBe('my_code');
  });

  it('prefixes a leading digit', () => {
    const name = sanitizeBlockName('2048', 'code1');
    expect(isValidBlockName(name)).toBe(true);
    expect(name).toMatch(/2048$/);
  });

  it('falls back to the given name when the header name is empty', () => {
    expect(sanitizeBlockName('', 'code1')).toBe('code1');
  });

  it('falls back to the given name when the header name is all spaces', () => {
    expect(sanitizeBlockName('   ', 'code1')).toBe('code1');
  });

  it('replaces punctuation with underscores', () => {
    const name = sanitizeBlockName('A-B!.C', 'code1');
    expect(isValidBlockName(name)).toBe(true);
  });
});

describe('codeFilesToBlocks', () => {
  function codeFile(name: string, address = 0x8000): ImportedCodeFile {
    return { name, address, bytes: Uint8Array.from([0xc9]) };
  }

  it('threads an entry address through to the block', () => {
    const blocks = codeFilesToBlocks([
      { ...codeFile('boot'), entry: 0x8210 },
      codeFile('plain'),
    ]);
    expect(blocks[0]!.entry).toBe(0x8210);
    expect('entry' in blocks[1]!).toBe(false);
  });

  it('builds a MemoryBlock per CodeFile with kind "code"', () => {
    const blocks = codeFilesToBlocks([codeFile('screen$', 0x8000)]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('code');
    expect(blocks[0]!.address).toBe(0x8000);
    expect(Array.from(blocks[0]!.bytes)).toEqual([0xc9]);
    expect(isValidBlockName(blocks[0]!.name)).toBe(true);
  });

  it('gives every block a valid, non-empty name even from a blank header name', () => {
    const blocks = codeFilesToBlocks([codeFile(''), codeFile('   ')]);
    for (const b of blocks) expect(isValidBlockName(b.name)).toBe(true);
  });

  it('disambiguates two CODE files that share the same header name', () => {
    const blocks = codeFilesToBlocks([codeFile('loader'), codeFile('loader')]);
    expect(blocks[0]!.name).not.toBe(blocks[1]!.name);
    expect(isValidBlockName(blocks[0]!.name)).toBe(true);
    expect(isValidBlockName(blocks[1]!.name)).toBe(true);
  });

  it('gives every block a stable, deterministic id', () => {
    const blocks = codeFilesToBlocks([codeFile('a'), codeFile('b')]);
    expect(blocks[0]!.id).not.toBe(blocks[1]!.id);
    expect(blocks.map((b) => b.id)).toEqual(
      codeFilesToBlocks([codeFile('a'), codeFile('b')]).map((b) => b.id),
    );
  });
});
