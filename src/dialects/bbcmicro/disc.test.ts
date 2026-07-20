// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { buildBbcDiscImage } from './disc';
import { detokenizeBbcDiscWithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { buildBbcDisc, type BbcFile } from '../../emulator/bbc/bbcDisc';
import { isBbcDisc } from '../../emulator/bbc/bbcDisc';
import type { MemoryBlock } from '../types';

const SOURCE = '10 PRINT "HELLO"\n20 CALL &2E00\n';

/** PAGE on a DFS Model B - where a CHAINed BASIC file loads. */
const PAGE = 0x1900;

/** The tokenized bytes of a tiny BASIC loader, for a synthetic game disc. */
function basicFile(name: string): BbcFile {
  const { bytes } = tokenizeProgram('10 PRINT "LOAD"\n');
  return { name, load: PAGE, exec: PAGE, bytes };
}

const BLOCK: MemoryBlock = {
  id: 'b1',
  name: 'sprite',
  address: 0x2e00,
  bytes: Uint8Array.from({ length: 16 }, (_, i) => 0xa9 + (i & 0x0f)),
  kind: 'code',
  entry: 0x2e00,
};

describe('bbcmicro .ssd export/import', () => {
  it('round-trips a BASIC program plus a memory block', () => {
    const ssd = buildBbcDiscImage(SOURCE, 'DEMO', [BLOCK], true);
    expect(isBbcDisc(ssd)).toBe(true);

    const { source, blocks } = detokenizeBbcDiscWithReport(ssd);
    expect(source).toBe(SOURCE);
    expect(blocks).toBeDefined();
    expect(blocks!).toHaveLength(1);
    expect(blocks![0]!.address).toBe(0x2e00);
    expect([...blocks![0]!.bytes]).toEqual([...BLOCK.bytes]);
  });

  it('does not treat the generated !BOOT as a block', () => {
    const ssd = buildBbcDiscImage(SOURCE, 'DEMO', [BLOCK], true);
    const { blocks } = detokenizeBbcDiscWithReport(ssd);
    expect(blocks!.every((b) => b.name.toUpperCase() !== 'BOOT')).toBe(true);
    expect(blocks!).toHaveLength(1);
  });

  it('exports a pure-BASIC document with no blocks', () => {
    const ssd = buildBbcDiscImage(SOURCE, 'DEMO', [], false);
    const { source, blocks } = detokenizeBbcDiscWithReport(ssd);
    expect(source).toBe(SOURCE);
    expect(blocks).toBeUndefined();
  });

  it('carries a machine-code-only document (no BASIC) with an entry block', () => {
    const ssd = buildBbcDiscImage('', 'CODE', [BLOCK], true);
    const { source, blocks } = detokenizeBbcDiscWithReport(ssd);
    expect(source).toBe('');
    expect(blocks!).toHaveLength(1);
    expect(blocks![0]!.address).toBe(0x2e00);
  });

  it('a representable disc carries no verbatim boot image', () => {
    const ssd = buildBbcDiscImage(SOURCE, 'DEMO', [BLOCK], true);
    const { bootDisc } = detokenizeBbcDiscWithReport(ssd);
    expect(bootDisc).toBeUndefined();
  });
});

describe('bbcmicro .ssd import of a disc the block model cannot represent', () => {
  it('preserves the whole image to boot when a file loads below PAGE', () => {
    // A real game disc: the BASIC loader at PAGE plus a code file the loader
    // *LOADs at &1100 (below PAGE) - which the memory-block model rejects.
    const files: BbcFile[] = [
      basicFile('LOADER'),
      {
        name: 'CODE',
        load: 0x1100,
        exec: 0x8023,
        bytes: new Uint8Array(0x400),
      },
    ];
    const image = buildBbcDisc(files, { title: 'GAME' });
    const { source, blocks, bootDisc } = detokenizeBbcDiscWithReport(image);
    expect(bootDisc).toBeDefined();
    expect([...bootDisc!]).toEqual([...image]); // the verbatim disc, unchanged
    expect(blocks).toBeUndefined(); // not decomposed into blocks
    expect(source).toContain('PRINT'); // the loader listing is still recovered
  });

  it('preserves the image when two code files overlap in RAM', () => {
    const files: BbcFile[] = [
      basicFile('LOADER'),
      { name: 'A', load: 0x2000, exec: 0x2000, bytes: new Uint8Array(0x2000) },
      { name: 'B', load: 0x3000, exec: 0x3000, bytes: new Uint8Array(0x2000) },
    ];
    const image = buildBbcDisc(files, { title: 'GAME' });
    const { blocks, bootDisc } = detokenizeBbcDiscWithReport(image);
    expect(bootDisc).toBeDefined();
    expect(blocks).toBeUndefined();
  });
});
