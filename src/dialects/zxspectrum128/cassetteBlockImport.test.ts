// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { zxspectrum128 } from './index';
// The 128K reads the standard Spectrum tape format, so a multi-file tape is
// synthesised with the 48K encoder - exactly the real-world case of importing a
// CODE-carrying Spectrum tape on the 128K.
import { buildCassetteSamples } from '../zxspectrum/targets';

const audio = zxspectrum128.audio!;

// A program whose tokens are identical in 48K and 128K BASIC, so it detokenizes
// back the same under either dialect.
const source = '10 PRINT "HI"\n';
const block = {
  id: 'blk-engine',
  name: 'engine',
  address: 0x8000,
  bytes: Uint8Array.of(0x3e, 0x02, 0xd3, 0xfe, 0xc9),
  kind: 'code' as const,
};

describe('Spectrum 128K cassette import recovers memory blocks', () => {
  it('a recorded multi-file tape comes back with its CODE block', () => {
    const samples = buildCassetteSamples(source, 'prog', false, [block], false);
    const result = audio.decodeSamples!(samples, audio.sampleRate);

    expect(result.source).toBe(source);
    const blocks = result.blocks ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.address).toBe(0x8000);
    expect(Array.from(blocks[0]!.bytes)).toEqual(Array.from(block.bytes));
  });

  it('a plain program tape still decodes without blocks', () => {
    const samples = audio.buildSamples(source, 'prog', false);
    const result = audio.decodeSamples!(samples, audio.sampleRate);
    expect(result.source).toBe(source);
    expect(result.blocks).toBeUndefined();
  });
});
