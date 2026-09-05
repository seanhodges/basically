import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from '../dialects/registry';
import type { Block, Dialect } from '../dialects/types';
import { retainBlocksAcross } from './blockRetention';
import type { ListingBlockMeta } from './listingBlocks';

const BLOCK: Block = {
  id: 'b1',
  name: 'kaleido',
  kind: 'code',
  address: 0x8000,
  bytes: new Uint8Array([0x21, 0x00, 0x40, 0xc9]),
  comment: 'draws the pattern',
  entry: 0x8000,
  asmSource: '  ORG $8000\n  LD HL,$4000\n  RET\n',
};

const META: Readonly<Record<number, ListingBlockMeta>> = {
  0: { name: 'plot', kind: 'code', comment: 'plots a point' },
};

/** The registered dialects, split by how they hold blocks. */
const fixedAddress = dialects.filter(
  (d) => d.memoryBlocks && !d.memoryBlocks.inListing,
);
const listing = dialects.filter((d) => d.memoryBlocks?.inListing);
/**
 * A machine that declares no block support. `Dialect.memoryBlocks` is optional
 * and every registered machine currently sets it, so this case is synthesized
 * rather than found - the rule still has to answer for it, and a machine added
 * later may well leave it unset.
 */
const blockless: Dialect = { ...getDialect('pet'), memoryBlocks: undefined };

const zxspectrum = getDialect('zxspectrum');
const commodore64 = getDialect('commodore64');
const zx81 = getDialect('zx81');
const zx80 = getDialect('zx80');

describe('retainBlocksAcross', () => {
  it('carries fixed-address blocks between fixed-address machines', () => {
    const kept = retainBlocksAcross(zxspectrum, commodore64, [BLOCK], {});
    expect(kept.blocks).toEqual([BLOCK]);
    expect(kept.listingBlockMeta).toEqual({});
  });

  it('carries them whole - bytes, address, entry and assembly source', () => {
    const [kept] = retainBlocksAcross(
      zxspectrum,
      commodore64,
      [BLOCK],
      {},
    ).blocks;
    expect(kept).toBeDefined();
    // A different CPU is not a reason to drop the user's work: the block
    // linter and the assembler report what does not fit on the new machine.
    expect(commodore64.memoryBlocks?.cpu).not.toBe(
      zxspectrum.memoryBlocks?.cpu,
    );
    expect(kept?.name).toBe(BLOCK.name);
    expect(kept?.address).toBe(BLOCK.address);
    expect(kept?.bytes).toBe(BLOCK.bytes);
    expect(kept?.entry).toBe(BLOCK.entry);
    expect(kept?.comment).toBe(BLOCK.comment);
    expect(kept?.asmSource).toBe(BLOCK.asmSource);
  });

  it('carries the listing overrides between the listing machines', () => {
    for (const [from, to] of [
      [zx81, zx80],
      [zx80, zx81],
    ] as const) {
      const kept = retainBlocksAcross(from, to, [], META);
      // A listing dialect derives its blocks from the source the user is
      // keeping, so there are none to carry - only the overrides.
      expect(kept.blocks).toEqual([]);
      expect(kept.listingBlockMeta).toBe(META);
    }
  });

  it('carries nothing across the two block models, either way', () => {
    expect(retainBlocksAcross(zxspectrum, zx81, [BLOCK], META)).toEqual({
      blocks: [],
      listingBlockMeta: {},
    });
    expect(retainBlocksAcross(zx81, zxspectrum, [BLOCK], META)).toEqual({
      blocks: [],
      listingBlockMeta: {},
    });
  });

  it('carries nothing onto a machine that declares no block support', () => {
    expect(retainBlocksAcross(zxspectrum, blockless, [BLOCK], META)).toEqual({
      blocks: [],
      listingBlockMeta: {},
    });
  });

  it('carries blocks off a machine that declares no block support', () => {
    // Such a machine offers no block editor, so its documents normally hold
    // none - but a project opened under it keeps the blocks it was saved with,
    // and those are fixed-address records like any other.
    expect(retainBlocksAcross(blockless, zxspectrum, [BLOCK], META)).toEqual({
      blocks: [BLOCK],
      listingBlockMeta: {},
    });
  });

  it('holds for every registered pair of machines', () => {
    // The rule is a property of what a dialect declares, so assert it over the
    // whole registry rather than the handful of pairs named above.
    const supports = (d: Dialect) => d.memoryBlocks !== undefined;
    const isListing = (d: Dialect) => d.memoryBlocks?.inListing === true;
    for (const from of dialects) {
      for (const to of dialects) {
        const kept = retainBlocksAcross(from, to, [BLOCK], META);
        const sameModel = supports(to) && isListing(from) === isListing(to);
        expect(kept.blocks).toEqual(sameModel && !isListing(to) ? [BLOCK] : []);
        expect(kept.listingBlockMeta).toEqual(
          sameModel && isListing(to) ? META : {},
        );
      }
    }
  });

  it('has both block models represented in the registry', () => {
    // Guards the pair cases above: were the registry to lose one of these
    // groups, the assertions for it would pass vacuously.
    expect(fixedAddress.length).toBeGreaterThan(1);
    expect(listing.length).toBeGreaterThan(1);
  });
});
