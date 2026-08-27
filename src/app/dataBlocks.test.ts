import { beforeEach, describe, expect, it } from 'vitest';
import type { MachineFileEntry } from '../dialects/types';
import { getDialect } from '../dialects/registry';
import { emulatorVfs } from '../storage/vfs/vfsStore';
import {
  projectDataBlocks,
  resetDataBlockCacheForTests,
  selectDataBlocks,
} from './dataBlocks';
import { tapFromPayloads } from '../dialects/zxspectrum/tapfile';

const entry = (
  name: string,
  size: number,
  updatedAt = 1,
  kind?: string,
): MachineFileEntry => ({ name, size, updatedAt, ...(kind ? { kind } : {}) });

const bytes = (...v: number[]) => Uint8Array.from(v);

describe('projectDataBlocks', () => {
  it('maps entries to blocks in the order the store lists them', () => {
    const files = new Map([
      ['SCORES', bytes(1, 2, 3)],
      ['LOG', bytes(9)],
    ]);
    const blocks = projectDataBlocks(
      [entry('SCORES', 3, 10, 'data-num'), entry('LOG', 1, 20)],
      (name) => files.get(name) ?? null,
    );
    expect(blocks.map((b) => b.name)).toEqual(['SCORES', 'LOG']);
    expect(Array.from(blocks[0]!.bytes)).toEqual([1, 2, 3]);
    expect(blocks[0]!.kind).toBe('data-num');
    expect(blocks[0]!.updatedAt).toBe(10);
    // No tag from the machine means no tag, rather than an invented one.
    expect(blocks[1]!.kind).toBeUndefined();
  });

  it('applies the unwrap per entry', () => {
    const files = new Map([
      ['A', bytes(0xaa, 0xbb, 0xcc)],
      ['B', bytes(0x01, 0x02)],
    ]);
    const blocks = projectDataBlocks(
      [entry('A', 3), entry('B', 2)],
      (name) => files.get(name) ?? null,
      // A container of exactly one leading byte, so a projection that unwrapped
      // once and reused the result would show B starting at 0x01.
      (b) => ({ payload: b.slice(1), container: b.slice(0, 1) }),
    );
    expect(Array.from(blocks[0]!.bytes)).toEqual([0xbb, 0xcc]);
    expect(Array.from(blocks[1]!.bytes)).toEqual([0x02]);
  });

  it('drops an entry whose bytes have gone', () => {
    const blocks = projectDataBlocks(
      [entry('GONE', 3), entry('HERE', 1)],
      (name) => (name === 'HERE' ? bytes(7) : null),
    );
    expect(blocks.map((b) => b.name)).toEqual(['HERE']);
  });

  it('returns the same empty array for an empty store', () => {
    const a = projectDataBlocks([], () => null);
    const b = projectDataBlocks([], () => null);
    expect(a).toEqual([]);
    expect(a).toBe(b);
  });
});

describe('selectDataBlocks', () => {
  const spectrum = getDialect('zxspectrum');
  const bbc = getDialect('bbcmicro');

  /** A two-block tape image, as the Spectrum deck stores a `SAVE … DATA`. */
  const tapeImage = (payload: Uint8Array): Uint8Array => {
    const header = new Uint8Array(17).fill(0x20);
    header[0] = 1; // number array
    header[11] = payload.length & 0xff;
    return tapFromPayloads(header, payload);
  };

  beforeEach(() => {
    emulatorVfs.clear('zxspectrum');
    resetDataBlockCacheForTests();
  });

  it('shows the file a program saved, not the machine container', () => {
    emulatorVfs.save('SCORES', tapeImage(bytes(10, 20, 30)), {
      kind: 'data-num',
    });
    const [block] = selectDataBlocks(spectrum);
    expect(block!.name).toBe('SCORES');
    expect(Array.from(block!.bytes)).toEqual([10, 20, 30]);
  });

  // The memo is what lets React bail out of a re-render, so identity is the
  // assertion, not equality.
  it('hands back the same array while the store is unchanged', () => {
    emulatorVfs.save('SCORES', tapeImage(bytes(1)));
    const first = selectDataBlocks(spectrum);
    expect(selectDataBlocks(spectrum)).toBe(first);

    // A rewrite of the same file under the same name is a change: `save`
    // stamps `updatedAt`, which the snapshot key covers.
    emulatorVfs.save('SCORES', tapeImage(bytes(1, 2)));
    const second = selectDataBlocks(spectrum);
    expect(second).not.toBe(first);
    expect(Array.from(second[0]!.bytes)).toEqual([1, 2]);
  });

  it('re-unwraps when the machine changes', () => {
    const image = tapeImage(bytes(5, 6));
    emulatorVfs.save('SCORES', image);
    expect(Array.from(selectDataBlocks(spectrum)[0]!.bytes)).toEqual([5, 6]);
    // The BBC declares no container, so its stored bytes are the file - the
    // same bytes read whole rather than split.
    expect(Array.from(selectDataBlocks(bbc)[0]!.bytes)).toEqual(
      Array.from(image),
    );
  });

  it('is empty once the store is cleared', () => {
    emulatorVfs.save('SCORES', tapeImage(bytes(1)));
    expect(selectDataBlocks(spectrum)).toHaveLength(1);
    emulatorVfs.clear();
    expect(selectDataBlocks(spectrum)).toEqual([]);
  });
});
