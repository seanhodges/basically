// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { zxspectrum } from '../index';

/**
 * End-to-end cassette round trip for a Spectrum document with a CODE block:
 * encode to tape audio, decode it back through the dialect's `decodeSamples`,
 * and confirm the program, the block and (with an auto-loader) the preserved
 * loader survive - the audio path recovers the same content the `.TAP` file
 * import does.
 */
const audio = zxspectrum.audio!;

// A main program comfortably larger than the generated auto-loader, so the
// "largest BASIC program is the game" rule opens it and not the loader.
const source =
  '10 PRINT "HI"\n' +
  '20 RANDOMIZE USR 32768\n' +
  '30 FOR N=1 TO 100\n' +
  '40 PRINT N\n' +
  '50 NEXT N\n' +
  '60 GO TO 20\n';
const block = {
  id: 'blk-engine',
  name: 'engine',
  address: 0x8000,
  bytes: Uint8Array.of(0x3e, 0x02, 0xd3, 0xfe, 0xc9),
  kind: 'code' as const,
};

describe('Spectrum cassette round trip with memory blocks', () => {
  it('recovers the program and CODE block (loader off)', () => {
    const samples = audio.buildSamples(source, 'prog', false, {
      blocks: [block],
      loader: false,
    });
    const result = audio.decodeSamples!(samples, audio.sampleRate);

    expect(result.source).toBe(source);
    const blocks = result.blocks ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.address).toBe(0x8000);
    expect(Array.from(blocks[0]!.bytes)).toEqual(Array.from(block.bytes));
  });

  it('recovers the block and preserves the loader (loader on)', () => {
    const samples = audio.buildSamples(source, 'prog', false, {
      blocks: [block],
      loader: true,
    });
    const result = audio.decodeSamples!(samples, audio.sampleRate);

    expect(result.source).toBe(source);
    expect((result.blocks ?? []).map((b) => b.address)).toEqual([0x8000]);
    expect(result.tapeFiles ?? []).toHaveLength(1); // the loader
  });

  it('a plain program tape still decodes without blocks', () => {
    const samples = audio.buildSamples(source, 'prog', false);
    const result = audio.decodeSamples!(samples, audio.sampleRate);
    expect(result.source).toBe(source);
    expect(result.blocks).toBeUndefined();
  });
});
