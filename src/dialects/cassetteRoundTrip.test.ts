// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import { fatalErrors } from './types';
import type { Block, Dialect } from './types';

/**
 * Every dialect that offers cassette audio must be able to import what it
 * exports: encode a real program to tape audio and decode it back, and the
 * recovered source must re-tokenize into a runnable image (no fatal errors).
 * This is the dialect-agnostic guard that "importing from cassette audio is
 * fully supported" - a dialect that grows export but forgets a working
 * `decodeSamples` fails here.
 */
const audioDialects = dialects.filter(
  (d) => d.audio && typeof d.audio.decodeSamples === 'function',
);

// Sanity: catch the case where a refactor drops audio from every dialect.
it('has dialects with cassette audio import', () => {
  expect(audioDialects.length).toBeGreaterThan(0);
});

describe.each(audioDialects.map((d) => [d.name, d] as const))(
  '%s cassette round trip',
  (_name, dialect) => {
    const audio = dialect.audio!;
    // The smallest bundled sample keeps the decoded waveform short and fast.
    const sample = dialect.samples.reduce((a, b) =>
      b.text.length < a.text.length ? b : a,
    );

    it('decodes its own exported program back into a runnable image', () => {
      const samples = audio.buildSamples(sample.text, 'TEST', false);
      const { source } = audio.decodeSamples!(samples, audio.sampleRate);

      expect(source.trim().length).toBeGreaterThan(0);
      // The recovered text must tokenize back cleanly - the same bar the run and
      // export paths use - so the import is genuinely usable, not just non-empty.
      const { errors } = dialect.tokenize(source);
      expect(fatalErrors(errors)).toEqual([]);
    });
  },
);

/**
 * The same round trip for a document that carries memory blocks.
 *
 * Four machines recover blocks from their own tape audio and the rest return
 * none - established by encoding a block for every dialect with `decodeSamples`
 * and reading back what survived, not from what the formats are said to do. The
 * four had a copy of this file each under `<dialect>/audio/`, differing only in
 * the addresses and the program that calls them.
 *
 * The program is larger than the generated auto-loader on purpose: the decoder
 * picks the largest BASIC program on the tape as the source, and a short one
 * would let the loader win.
 */
interface BlockTape {
  /** Blocks to encode, at addresses the machine can actually hold them at. */
  blocks: Block[];
  /** A program that calls the first block, longer than the auto-loader. */
  source: string;
}

const bytes = {
  first: Uint8Array.of(0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60),
  second: Uint8Array.of(0x01, 0x02, 0x03, 0x04),
};

/** A CBM program calling `first` through SYS, in the decimal that machine needs. */
const cbmSource = (call: number): string =>
  '10 PRINT "HELLO WORLD FROM THE MAIN PROGRAM"\n' +
  `20 SYS ${call}\n` +
  '30 FOR I=1 TO 100\n' +
  '40 PRINT "COUNTING ";I\n' +
  '50 NEXT I\n' +
  '60 PRINT "DONE, LOOPING BACK"\n' +
  '70 GOTO 20\n';

const block = (
  id: string,
  name: string,
  address: number,
  b: Uint8Array,
): Block => ({
  id,
  name,
  address,
  bytes: b,
  kind: 'code',
});

const BLOCK_TAPES: Record<string, BlockTape> = {
  commodore64: {
    blocks: [
      block('b1', 'SPRITES', 0xc000, bytes.first),
      block('b2', 'MUSIC', 0xd000, bytes.second),
    ],
    source: cbmSource(0xc000),
  },
  pet: {
    blocks: [
      block('b1', 'SPRITES', 0x6000, bytes.first),
      block('b2', 'MUSIC', 0x7000, bytes.second),
    ],
    source: cbmSource(0x6000),
  },
  vic20: {
    blocks: [
      block('b1', 'SPRITES', 0x1b00, bytes.first),
      block('b2', 'MUSIC', 0x1c00, bytes.second),
    ],
    source: cbmSource(0x1b00),
  },
  // One block, and Z80 bytes rather than 6502: the Spectrum reaches its block
  // through RANDOMIZE USR rather than SYS.
  zxspectrum: {
    blocks: [
      block(
        'blk-engine',
        'engine',
        0x8000,
        Uint8Array.of(0x3e, 0x02, 0xd3, 0xfe, 0xc9),
      ),
    ],
    source:
      '10 PRINT "HI"\n' +
      '20 RANDOMIZE USR 32768\n' +
      '30 FOR N=1 TO 100\n' +
      '40 PRINT N\n' +
      '50 NEXT N\n' +
      '60 GO TO 20\n',
  },
};

const blockTapeDialects: [string, Dialect, BlockTape][] = Object.entries(
  BLOCK_TAPES,
).map(([id, tape]) => {
  const dialect = audioDialects.find((d) => d.id === id);
  if (!dialect) throw new Error(`${id} is not a dialect with cassette import`);
  return [dialect.name, dialect, tape];
});

describe('cassette round trip with memory blocks', () => {
  it('names only dialects that can import from cassette audio', () => {
    expect(blockTapeDialects).toHaveLength(Object.keys(BLOCK_TAPES).length);
  });

  it.each(blockTapeDialects)(
    '%s recovers the program and its blocks (loader off)',
    (id, dialect, tape) => {
      const audio = dialect.audio!;
      const samples = audio.buildSamples(tape.source, 'GAME', false, {
        blocks: tape.blocks,
        loader: false,
      });
      const result = audio.decodeSamples!(samples, audio.sampleRate);

      expect(result.source, `${id} lost the program`).toBe(tape.source);
      const got = result.blocks ?? [];
      expect(
        got.map((b) => b.address),
        `${id} lost a block`,
      ).toEqual(tape.blocks.map((b) => b.address));
      got.forEach((b, i) => {
        expect(Array.from(b.bytes), `${id} corrupted block ${i}`).toEqual(
          Array.from(tape.blocks[i]!.bytes),
        );
      });
    },
  );

  it.each(blockTapeDialects)(
    '%s keeps the generated loader as a tape file (loader on)',
    (id, dialect, tape) => {
      const audio = dialect.audio!;
      const samples = audio.buildSamples(tape.source, 'GAME', false, {
        blocks: tape.blocks,
        loader: true,
      });
      const result = audio.decodeSamples!(samples, audio.sampleRate);

      // The main program, not the leading auto-loader, is chosen as the source.
      expect(result.source, `${id} opened the loader instead`).toBe(
        tape.source,
      );
      expect(
        (result.blocks ?? []).map((b) => b.address),
        `${id} lost a block`,
      ).toEqual(tape.blocks.map((b) => b.address));
      expect(result.tapeFiles ?? [], `${id} dropped the loader`).toHaveLength(
        1,
      );
    },
  );

  it.each(blockTapeDialects)(
    '%s decodes a plain tape with no blocks on it',
    (id, dialect, tape) => {
      const audio = dialect.audio!;
      const samples = audio.buildSamples(tape.source, 'GAME', false);
      const result = audio.decodeSamples!(samples, audio.sampleRate);
      expect(result.source, `${id} lost the program`).toBe(tape.source);
      expect(result.blocks, `${id} invented blocks`).toBeUndefined();
    },
  );
});
