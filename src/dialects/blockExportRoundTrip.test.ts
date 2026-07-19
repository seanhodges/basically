// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The whole-document export round trip: export a sample that bundles memory
 * blocks through the dialect's native container format, import the artifact
 * back, and assert the ENTIRE program - BASIC source and every block -
 * survived. One case per dialect with a block-aware export (ZX Spectrum
 * today; others join here as their Stage-6 export ships).
 */

import { describe, expect, it } from 'vitest';
import { getDialect } from './registry';
import { exportImportRoundTrip } from './exportRoundTripHarness';
import { materializeSampleBlocks } from '../app/sampleBlocks';
import type { MemoryBlock } from './types';

describe('zxspectrum kaleidoscope .TAP export round trip', () => {
  const dialect = getDialect('zxspectrum');
  const sample = dialect.samples.find((s) => s.name === 'kaleido.bas')!;
  const blocks = materializeSampleBlocks(dialect, sample);

  it('the sample bundles the machine-code block', () => {
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.name).toBe('kaleido');
    expect(blocks[0]!.address).toBe(0x8000);
    expect(blocks[0]!.bytes.length).toBeGreaterThan(0);
  });

  it('loader-off export preserves the entire program', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      sample.text,
      'kaleido',
      blocks,
      { targetId: 'tap-file', loader: false },
    );

    // The BASIC program re-tokenizes byte-exact with no errors...
    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    // ...and the machine-code block survives name, address and bytes intact.
    expect(outcome.blocks).toHaveLength(1);
    const block = outcome.blocks[0]!;
    expect(block.name).toBe('kaleido');
    expect(block.address).toBe(0x8000);
    expect(Array.from(block.bytes)).toEqual(Array.from(blocks[0]!.bytes));
    // Loader-off is the classic load-only layout: nothing auto-runs and no
    // extra tape files ride along.
    expect(outcome.autoStart).toBeNull();
    expect(outcome.tapeFiles).toEqual([]);
  });

  it('loader-on export re-imports with the loader preserved on tape', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      sample.text,
      'kaleido',
      blocks,
      { targetId: 'tap-file', loader: true },
    );

    // The (larger) main program is chosen for editing, byte-exact.
    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    // The block still round-trips...
    expect(outcome.blocks).toHaveLength(1);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(blocks[0]!.bytes),
    );
    // ...the auto-loader is preserved as a tape file (not silently dropped),
    // and the multi-part import says so.
    expect(outcome.tapeFiles).toHaveLength(1);
    expect(outcome.warnings.length).toBeGreaterThan(0);
    // The main program auto-starts at its first line, as the loader's final
    // LOAD "" expects.
    expect(outcome.autoStart).toBe(10);
  });
});

describe('commodore64 .d64 export round trip', () => {
  const dialect = getDialect('commodore64');
  // The C64 ships no sample bundling blocks, so build one inline: a short
  // routine at $C000 (the default block address), well clear of the program.
  const source = '10 POKE 53280,0\n20 PRINT "THE ACTUAL GAME"\n30 GOTO 20\n';
  const block: MemoryBlock = {
    id: 'sprite-1',
    name: 'sprites',
    address: 0xc000,
    bytes: Uint8Array.of(0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60),
    kind: 'code',
  };

  it('loader-off export preserves the entire program', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      source,
      'game',
      [block],
      {
        targetId: 'c64-d64',
        loader: false,
      },
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(outcome.blocks[0]!.address).toBe(0xc000);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    // Loader-off: nothing extra rides along on the tape image.
    expect(outcome.tapeFiles).toEqual([]);
  });

  it('loader-on export re-imports with the loader preserved', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      source,
      'game',
      [block],
      {
        targetId: 'c64-d64',
        loader: true,
      },
    );

    // The (larger) main program is chosen for editing, byte-exact...
    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    // ...the block still round-trips...
    expect(outcome.blocks).toHaveLength(1);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    // ...and the auto-loader is preserved as a tape file, not dropped.
    expect(outcome.tapeFiles).toHaveLength(1);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });
});
