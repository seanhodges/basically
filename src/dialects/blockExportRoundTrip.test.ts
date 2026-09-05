// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The whole-document export round trip: export a sample that bundles memory
 * blocks through the dialect's native container format, import the artifact
 * back, and assert the ENTIRE program - BASIC source and every block -
 * survived. One case per dialect with a block-aware export; a dialect joins
 * here as its block-aware export ships.
 */

import { describe, expect, it } from 'vitest';
import { getDialect } from './registry';
import { exportImportRoundTrip } from './exportRoundTripHarness';
import { materializeSampleBlocks } from '../app/sampleBlocks';
import type { Block } from './types';
import { exportTapBlockList as spectrumTape } from './zxspectrum/targets';
import { exportTapBlockList as spectrum128Tape } from './zxspectrum128/targets';
import { headerName, type TapBlock } from './zxspectrum/tapfile';

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

describe('zxspectrum128 kaleidoscope .TAP export round trip', () => {
  const dialect = getDialect('zxspectrum128');
  const sample = dialect.samples.find((s) => s.name === 'kaleido.bas')!;
  const blocks = materializeSampleBlocks(dialect, sample);

  it('the sample bundles the 48K machine-code block verbatim', () => {
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

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
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

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(blocks[0]!.bytes),
    );
    expect(outcome.tapeFiles).toHaveLength(1);
    expect(outcome.warnings.length).toBeGreaterThan(0);
    expect(outcome.autoStart).toBe(10);
  });

  // The two machines write the same tape format from separate layout
  // functions, each over its own tokenizer. A round trip cannot see them
  // drifting - a re-ordered tape still imports perfectly and only fails on
  // real hardware - so compare the tape shape directly.
  it('writes the same tape shape as the 48K for the same document', () => {
    const shape = (list: TapBlock[]) =>
      // Each tape file is a header block then a data block, so the headers sit
      // at even indices. Type, name and param1 (load address, or auto-start
      // line for a program) are what "same shape" means.
      list
        .filter((_, i) => i % 2 === 0)
        .map((b) => {
          const header = b.bytes.slice(1, 18);
          return {
            type: header[0]!,
            name: headerName(header.slice(1, 11)),
            param1: header[13]! | (header[14]! << 8),
          };
        });

    for (const loader of [false, true]) {
      expect(
        shape(spectrum128Tape(sample.text, 'kaleido', blocks, loader)),
      ).toEqual(shape(spectrumTape(sample.text, 'kaleido', blocks, loader)));
    }
  });
});

describe('atom .dsk export round trip', () => {
  const dialect = getDialect('atom');
  // A short routine at #5000 (the Atom's default block address), well clear of
  // the BASIC program area at #2900.
  const source = '10 PRINT "THE ACTUAL GAME"\n20 GOTO 10\n';
  const block: Block = {
    id: 'sprite-1',
    name: 'sprites',
    address: 0x5000,
    bytes: Uint8Array.of(0xa9, 0x00, 0x60),
    kind: 'code',
  };

  it('preserves the entire program (BASIC + block)', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      source,
      'game',
      [block],
      { targetId: 'atom-dsk', loader: false },
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(outcome.blocks[0]!.address).toBe(0x5000);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(outcome.tapeFiles).toEqual([]);
  });
});

describe('trs80 .dsk export round trip', () => {
  const dialect = getDialect('trs80');
  // A short routine at 0x7000 (the TRS-80's default block address), well clear
  // of the BASIC program area at 0x42E9. The program is comfortably larger than
  // anything else so the "largest BASIC program" rule opens it.
  const source =
    '10 PRINT "THE ACTUAL GAME, NOT A LOADER"\n' +
    '20 FOR I=1 TO 100\n' +
    '30 PRINT "COUNTING ";I\n' +
    '40 NEXT I\n' +
    '50 GOTO 20\n';
  const block: Block = {
    id: 'sprite-1',
    name: 'sprites',
    address: 0x7000,
    bytes: Uint8Array.of(0x21, 0x00, 0x3c, 0x36, 0xff, 0xc9),
    kind: 'code',
  };

  it('preserves the entire program (BASIC + block)', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      source,
      'game',
      [block],
      { targetId: 'trs80-dsk', loader: false },
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(outcome.blocks[0]!.address).toBe(0x7000);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(outcome.tapeFiles).toEqual([]);
  });
});

describe('commodore64 .d64 export round trip', () => {
  const dialect = getDialect('commodore64');
  // The C64 ships no sample bundling blocks, so build one inline: a short
  // routine at $C000 (the default block address), well clear of the program.
  const source = '10 POKE 53280,0\n20 PRINT "THE ACTUAL GAME"\n30 GOTO 20\n';
  const block: Block = {
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

describe('pet .d64 export round trip', () => {
  const dialect = getDialect('pet');
  // A short routine high in the PET's 32K RAM ($7000, the default block address),
  // well clear of the program area at $0401. The program is comfortably larger
  // than the generated auto-loader so the "largest BASIC program" rule opens it.
  const source =
    '10 PRINT "THE ACTUAL GAME, NOT THE LOADER"\n' +
    '20 FOR I=1 TO 100\n' +
    '30 PRINT "COUNTING ";I\n' +
    '40 NEXT I\n' +
    '50 GOTO 20\n';
  const block: Block = {
    id: 'sprite-1',
    name: 'sprites',
    address: 0x7000,
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
        targetId: 'pet-d64',
        loader: false,
      },
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(outcome.blocks[0]!.address).toBe(0x7000);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(outcome.tapeFiles).toEqual([]);
  });

  it('loader-on export re-imports with the loader preserved', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      source,
      'game',
      [block],
      {
        targetId: 'pet-d64',
        loader: true,
      },
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(outcome.tapeFiles).toHaveLength(1);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });
});

describe('vic20 .d64 export round trip', () => {
  const dialect = getDialect('vic20');
  // A short routine near the top of the unexpanded VIC-20's user RAM ($1C00, the
  // default block address, below the $1E00 screen), clear of the program at $1001.
  // The program is comfortably larger than the generated auto-loader so the
  // "largest BASIC program" rule opens it.
  const source =
    '10 PRINT "THE ACTUAL GAME, NOT THE LOADER"\n' +
    '20 FOR I=1 TO 100\n' +
    '30 PRINT "COUNTING ";I\n' +
    '40 NEXT I\n' +
    '50 GOTO 20\n';
  const block: Block = {
    id: 'sprite-1',
    name: 'sprites',
    address: 0x1c00,
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
        targetId: 'vic20-d64',
        loader: false,
      },
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(outcome.blocks[0]!.address).toBe(0x1c00);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(outcome.tapeFiles).toEqual([]);
  });

  it('loader-on export re-imports with the loader preserved', async () => {
    const outcome = await exportImportRoundTrip(
      dialect,
      source,
      'game',
      [block],
      {
        targetId: 'vic20-d64',
        loader: true,
      },
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.programByteExact).toBe(true);
    expect(outcome.blocks).toHaveLength(1);
    expect(Array.from(outcome.blocks[0]!.bytes)).toEqual(
      Array.from(block.bytes),
    );
    expect(outcome.tapeFiles).toHaveLength(1);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });
});
