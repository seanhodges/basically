// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import type { MemoryBlock } from '../../types';
import { pet } from '../index';

/**
 * End-to-end cassette round trip for a PET document that carries memory blocks:
 * encode to tape audio with the dialect's `buildSamples`, decode it back through
 * `decodeSamples`, and confirm the main program, the CODE blocks and (with an
 * auto-loader) the preserved loader all survive - the PET counterpart to the
 * C64's `audio/blockRoundTrip.test.ts`.
 */
const audio = pet.audio!;

const SPRITES: MemoryBlock = {
  id: 'b1',
  name: 'SPRITES',
  address: 0x6000,
  bytes: Uint8Array.of(0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60),
  kind: 'code',
};
const MUSIC: MemoryBlock = {
  id: 'b2',
  name: 'MUSIC',
  address: 0x7000,
  bytes: Uint8Array.of(0x01, 0x02, 0x03, 0x04),
  kind: 'code',
};

// A main program comfortably larger than the generated auto-loader, so the
// "largest BASIC program is the source" rule picks it and not the loader.
const source =
  '10 PRINT "HELLO WORLD FROM THE MAIN PROGRAM"\n' +
  '20 SYS 24576\n' +
  '30 FOR I=1 TO 100\n' +
  '40 PRINT "COUNTING ";I\n' +
  '50 NEXT I\n' +
  '60 PRINT "DONE, LOOPING BACK"\n' +
  '70 GOTO 20\n';

describe('PET cassette round trip with memory blocks', () => {
  it('recovers the program and blocks (loader off)', () => {
    const samples = audio.buildSamples(source, 'GAME', false, {
      blocks: [SPRITES, MUSIC],
    });
    const result = audio.decodeSamples!(samples, audio.sampleRate);

    expect(result.source).toBe(source);
    const blocks = result.blocks ?? [];
    expect(blocks.map((b) => b.address)).toEqual([0x6000, 0x7000]);
    expect(Array.from(blocks[0]!.bytes)).toEqual(Array.from(SPRITES.bytes));
    expect(Array.from(blocks[1]!.bytes)).toEqual(Array.from(MUSIC.bytes));
  });

  it('recovers the program and blocks and preserves the loader (loader on)', () => {
    const samples = audio.buildSamples(source, 'GAME', false, {
      blocks: [SPRITES, MUSIC],
      loader: true,
    });
    const result = audio.decodeSamples!(samples, audio.sampleRate);

    // The main program - not the leading auto-loader - is chosen as the source.
    expect(result.source).toBe(source);
    expect((result.blocks ?? []).map((b) => b.address)).toEqual([
      0x6000, 0x7000,
    ]);
    // The generated loader rides along as a preserved tape file.
    expect(result.tapeFiles ?? []).toHaveLength(1);
  });

  it('a plain single-program tape still decodes without blocks', () => {
    const samples = audio.buildSamples(source, 'GAME', false);
    const result = audio.decodeSamples!(samples, audio.sampleRate);
    expect(result.source).toBe(source);
    expect(result.blocks).toBeUndefined();
    expect(result.tapeFiles).toBeUndefined();
  });
});
