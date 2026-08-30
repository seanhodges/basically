// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a document's blocks survive when the user keeps their program across a
 * target-machine switch.
 *
 * A block keeps the address it was given: nothing here relocates, re-assembles
 * or translates it for the new machine. A block that no longer fits is the
 * block linter's to report (`./blockLint.ts`), the same way BASIC the new
 * machine cannot run is the tokenizer's - keeping the user's work and telling
 * them what is wrong with it beats deleting it to spare them the diagnostic.
 *
 * The rule is phrased in what a dialect declares (`memoryBlocks`, and whether
 * its blocks live in the listing), never in machine names, so a machine
 * registered later is covered without being enumerated.
 */

import type { Block, Dialect } from '../dialects/types';
import type { ListingBlockMeta } from './listingBlocks';

/** What survives a switch: the same shape the store holds these in. */
export interface RetainedBlocks {
  blocks: readonly Block[];
  listingBlockMeta: Readonly<Record<number, ListingBlockMeta>>;
}

const NOTHING: RetainedBlocks = { blocks: [], listingBlockMeta: {} };

/**
 * Whether a document's blocks mean anything on the machine being switched to:
 * it holds blocks at all, and holds them the same way the machine being left
 * did. Exported so the question put to the user and the switch that follows it
 * cannot disagree about what is going to happen.
 */
export function blocksSurviveSwitch(from: Dialect, to: Dialect): boolean {
  if (!to.memoryBlocks) return false;
  return (
    (from.memoryBlocks?.inListing === true) ===
    (to.memoryBlocks.inListing === true)
  );
}

/**
 * The blocks and listing metadata a document keeps moving from `from` to `to`.
 *
 * Three outcomes, and the boundary between the two block models decides which:
 *
 * - Fixed-address to fixed-address: the blocks themselves travel, verbatim.
 * - Listing to listing (the ZX80/ZX81 `#BIN` model): the blocks are derived
 *   from `source`, which the user is keeping, so there are none to carry - only
 *   the ordinal-keyed overrides the records cannot hold. The ordinals still line
 *   up because the text is unchanged; a layout difference between the two
 *   machines can leave an override on a record that no longer exists, which
 *   `applyListingMeta` ignores.
 * - Anything else - a target with no block support, or a switch across the two
 *   models - carries neither. Crossing the boundary would mean inventing an
 *   address for a block the other model cannot express, which is exactly the
 *   cross-machine re-targeting this app does not do. Nothing is destroyed by
 *   the listing side of that: the `#BIN` records ride inside the kept text.
 */
export function retainBlocksAcross(
  from: Dialect,
  to: Dialect,
  blocks: readonly Block[],
  listingBlockMeta: Readonly<Record<number, ListingBlockMeta>>,
): RetainedBlocks {
  if (!blocksSurviveSwitch(from, to)) return NOTHING;
  if (to.memoryBlocks?.inListing) return { blocks: [], listingBlockMeta };
  return { blocks, listingBlockMeta: {} };
}
