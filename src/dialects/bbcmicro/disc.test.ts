// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { buildBbcDiscImage } from './disc';
import { detokenizeBbcDiscWithReport } from './detokenizer';
import { isBbcDisc } from '../../emulator/bbc/bbcDisc';
import type { MemoryBlock } from '../types';

const SOURCE = '10 PRINT "HELLO"\n20 CALL &2E00\n';

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
});
