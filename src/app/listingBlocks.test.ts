// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { deriveListingBlocks, walkRecords } from './listingBlocks';
import { formatBinaryDirective } from '../dialects/binaryDirective';
import { zx81ListingLayout } from '../dialects/zx81/listingLayout';
import { zx80ListingLayout } from '../dialects/zx80/listingLayout';

const NEWLINE = 0x76;
const REM81 = 0xea;
const REM80 = 0xfe;

/** A ZX81 line record: `[lineNo BE][len LE][body][NEWLINE]`. */
function zx81Record(no: number, body: number[]): Uint8Array {
  const len = body.length + 1; // body + terminator
  return Uint8Array.from([
    (no >> 8) & 0xff,
    no & 0xff,
    len & 0xff,
    (len >> 8) & 0xff,
    ...body,
    NEWLINE,
  ]);
}

/** A ZX80 line record: `[lineNo BE][body][NEWLINE]` (no length field). */
function zx80Record(no: number, body: number[]): Uint8Array {
  return Uint8Array.from([(no >> 8) & 0xff, no & 0xff, ...body, NEWLINE]);
}

/** Non-newline machine-code-looking bytes. */
function code(n: number): number[] {
  const opcodes = [0xcd, 0x21, 0xc9, 0xd5, 0xe5, 0xf1, 0xfe, 0x18];
  return Array.from({ length: n }, (_, i) => opcodes[i % opcodes.length]!);
}

const bin = (rec: Uint8Array) => formatBinaryDirective(rec);

describe('deriveListingBlocks - ZX81', () => {
  it('places a line-1 REM block at the classic 16514', () => {
    const body = code(20);
    const rec = zx81Record(1, [REM81, ...body]);
    const blocks = deriveListingBlocks(bin(rec), zx81ListingLayout);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.address).toBe(0x4082); // 16514
    expect(Array.from(blocks[0]!.bytes)).toEqual(body);
    expect(blocks[0]!.kind).toBe('code');
    expect(blocks[0]!.name).toBe('bin1');
    expect(blocks[0]!.id).toBe('listing-0');
  });

  it('shifts the address when a BASIC line sits above the block', () => {
    const rec1 = zx81Record(1, [REM81, ...code(10)]);
    const rec2 = zx81Record(9, [REM81, ...code(30)]);
    // A #BIN then a plain BASIC line then another #BIN.
    const source = `${bin(rec1)}\n5 PRINT "HI"\n${bin(rec2)}\n`;
    const blocks = deriveListingBlocks(source, zx81ListingLayout);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.address).toBe(0x4082);
    // The second block sits past rec1 plus the intervening tokenized
    // "5 PRINT ..." record, so its gap above the first exceeds rec1 alone.
    expect(blocks[1]!.address - blocks[0]!.address).toBeGreaterThan(
      rec1.length,
    );
    expect(blocks[1]!.name).toBe('bin2');
    expect(Array.from(blocks[1]!.bytes)).toEqual(code(30));
  });

  it('maps multiple #BIN lines by ordinal, duplicates included', () => {
    const rec = zx81Record(1, [REM81, ...code(50)]);
    const source = `${bin(rec)}\n${bin(rec)}\n2 RUN\n`;
    const blocks = deriveListingBlocks(source, zx81ListingLayout);
    expect(blocks.map((b) => b.name)).toEqual(['bin1', 'bin2']);
    // Two identical records: the second lands one record-width above the first.
    expect(blocks[1]!.address).toBe(blocks[0]!.address + rec.length);
  });

  it('returns no blocks for a pure-BASIC program', () => {
    expect(deriveListingBlocks('10 PRINT "HI"\n', zx81ListingLayout)).toEqual(
      [],
    );
  });
});

describe('deriveListingBlocks - ZX80', () => {
  it('places a line-1 REM block at 0x402B', () => {
    const body = code(16);
    const rec = zx80Record(1, [REM80, ...body]);
    const blocks = deriveListingBlocks(bin(rec), zx80ListingLayout);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.address).toBe(0x402b);
    expect(Array.from(blocks[0]!.bytes)).toEqual(body);
  });
});

describe('walkRecords', () => {
  it('walks ZX81 length-delimited records in order', () => {
    const a = zx81Record(1, [REM81, ...code(8)]);
    const b = zx81Record(2, [0xf7]); // 2 RUN
    const recs = walkRecords(Uint8Array.from([...a, ...b]), zx81ListingLayout);
    expect(recs.map((r) => r.start)).toEqual([0, a.length]);
    expect(recs.map((r) => r.lineNo)).toEqual([1, 2]);
  });

  it('walks ZX80 newline-delimited records in order', () => {
    const a = zx80Record(1, [REM80, ...code(6)]);
    const b = zx80Record(2, [0xf3]);
    const recs = walkRecords(Uint8Array.from([...a, ...b]), zx80ListingLayout);
    expect(recs.map((r) => r.start)).toEqual([0, a.length]);
    expect(recs.map((r) => r.lineNo)).toEqual([1, 2]);
  });
});
