// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  buildRemRecord,
  insertListingBlock,
  removeListingBlock,
  writeBackListingBlock,
} from './listingBlockEdit';
import { deriveListingBlocks } from './listingBlocks';
import { formatBinaryDirective } from '../dialects/binaryDirective';
import { zx81ListingLayout } from '../dialects/zx81/listingLayout';
import { zx80ListingLayout } from '../dialects/zx80/listingLayout';
import { tokenizeProgram } from '../dialects/zx81/tokenizer';

const code = (bytes: number[]) => Uint8Array.from(bytes);

describe('buildRemRecord', () => {
  it('produces a ZX81 record the tokenizer accepts and re-splices', () => {
    const rec = buildRemRecord(1, code([0xcd, 0x21, 0xc9]), zx81ListingLayout);
    const source = formatBinaryDirective(rec);
    const { bytes, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual(Array.from(rec)); // byte-exact splice
  });

  it('rejects ZX80 code containing the 0x76 terminator', () => {
    expect(() =>
      buildRemRecord(1, code([0xcd, 0x76, 0xc9]), zx80ListingLayout),
    ).toThrow(/0x76/);
  });

  it('allows ZX81 code containing 0x76 (length-delimited)', () => {
    expect(() =>
      buildRemRecord(1, code([0x76]), zx81ListingLayout),
    ).not.toThrow();
  });
});

describe('writeBackListingBlock', () => {
  it('rewrites bytes in place, preserving the line number', () => {
    const original = formatBinaryDirective(
      buildRemRecord(1, code([0xc9]), zx81ListingLayout),
    );
    const source = `${original}\n2 RUN\n`;
    const newSource = writeBackListingBlock(
      source,
      0,
      code([0xcd, 0x21, 0xc9]),
      zx81ListingLayout,
    );
    const blocks = deriveListingBlocks(newSource, zx81ListingLayout);
    expect(blocks).toHaveLength(1);
    expect(Array.from(blocks[0]!.bytes)).toEqual([0xcd, 0x21, 0xc9]);
    expect(blocks[0]!.address).toBe(0x4082); // line number preserved → same slot
    // The rewritten program still tokenizes cleanly.
    expect(tokenizeProgram(newSource).errors).toEqual([]);
  });

  it('is a no-op for an out-of-range ordinal', () => {
    const source = `10 PRINT "HI"\n`;
    expect(
      writeBackListingBlock(source, 0, code([0xc9]), zx81ListingLayout),
    ).toBe(source);
  });
});

describe('insertListingBlock / removeListingBlock', () => {
  it('appends a block above the highest line and derives one more', () => {
    const source = `10 PRINT "HI"\n`;
    const { source: withBlock, ordinal } = insertListingBlock(
      source,
      zx81ListingLayout,
    );
    expect(ordinal).toBe(0);
    expect(tokenizeProgram(withBlock).errors).toEqual([]);
    const blocks = deriveListingBlocks(withBlock, zx81ListingLayout);
    expect(blocks).toHaveLength(1);
    expect(Array.from(blocks[0]!.bytes)).toEqual([0xc9]); // RET stub
  });

  it('removes the ordinal-th block, deriving one fewer', () => {
    const a = formatBinaryDirective(
      buildRemRecord(1, code([0xc9]), zx81ListingLayout),
    );
    const b = formatBinaryDirective(
      buildRemRecord(2, code([0x00]), zx81ListingLayout),
    );
    const source = `${a}\n${b}\n9 RUN\n`;
    expect(deriveListingBlocks(source, zx81ListingLayout)).toHaveLength(2);
    const after = removeListingBlock(source, 0);
    const blocks = deriveListingBlocks(after, zx81ListingLayout);
    expect(blocks).toHaveLength(1);
    expect(Array.from(blocks[0]!.bytes)).toEqual([0x00]); // the second survived
  });
});
