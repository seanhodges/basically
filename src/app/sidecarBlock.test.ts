import { describe, expect, it } from 'vitest';
import { parseSidecarFileName, sidecarBlock } from './sidecarBlock';
import type { MemoryBlock } from '../dialects/types';

describe('parseSidecarFileName', () => {
  it('parses a hex address (0x / $ / & prefixes)', () => {
    expect(parseSidecarFileName('sprite-0x8000.bin')).toEqual({
      name: 'sprite',
      address: 0x8000,
    });
    expect(parseSidecarFileName('sprite-$8000.bin')).toEqual({
      name: 'sprite',
      address: 0x8000,
    });
    expect(parseSidecarFileName('sprite-&8000.bin')).toEqual({
      name: 'sprite',
      address: 0x8000,
    });
  });

  it('parses a plain decimal address', () => {
    expect(parseSidecarFileName('data-32768.bin')).toEqual({
      name: 'data',
      address: 32768,
    });
  });

  it('keeps hyphens in the name (greedy name part)', () => {
    expect(parseSidecarFileName('my-code-0x4000.bin')).toEqual({
      name: 'my_code',
      address: 0x4000,
    });
  });

  it('sanitizes an invalid name (leading digit, bad chars)', () => {
    expect(parseSidecarFileName('9lives!-0x4000.bin')).toEqual({
      name: 'b_9lives_',
      address: 0x4000,
    });
  });

  it('matches the .bin extension case-insensitively', () => {
    expect(parseSidecarFileName('code-0x4000.BIN')?.address).toBe(0x4000);
  });

  it('returns null for a non-sidecar name', () => {
    expect(parseSidecarFileName('program.bin')).toBeNull(); // no -<addr>
    expect(parseSidecarFileName('code-0x8000.txt')).toBeNull(); // wrong ext
    expect(parseSidecarFileName('code-0x8000')).toBeNull(); // no ext
  });

  it('rejects an out-of-range address', () => {
    expect(parseSidecarFileName('code-0x10000.bin')).toBeNull(); // > 0xFFFF
    expect(parseSidecarFileName('code-99999999.bin')).toBeNull();
  });
});

describe('sidecarBlock', () => {
  const bytes = Uint8Array.of(1, 2, 3);

  it('builds a code block with a deterministic id', () => {
    const block = sidecarBlock({ name: 'sprite', address: 0x8000 }, bytes, []);
    expect(block).toEqual({
      id: 'sidecar-sprite',
      name: 'sprite',
      address: 0x8000,
      bytes,
      kind: 'code',
    });
  });

  it('makes the name unique against existing blocks', () => {
    const existing: MemoryBlock[] = [
      { id: 'x', name: 'sprite', address: 0x9000, bytes, kind: 'code' },
    ];
    const block = sidecarBlock(
      { name: 'sprite', address: 0x8000 },
      bytes,
      existing,
    );
    expect(block.name).toBe('sprite_2');
    expect(block.id).toBe('sidecar-sprite_2');
  });
});
