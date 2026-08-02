// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport } from '../types';

/**
 * Where the Altair's {@link import('../types').MemoryBlock}s may legally live
 * (Stage 5), for the block linter in `src/app/blockLint.ts`.
 *
 * Two decisions Stage 5 has to make deliberately:
 *
 * 1. **`cpu`.** The field is typed `'z80' | '6502'`; there is no `'8080'`.
 *    Declare `'z80'`: the machine executes 8080 object code on the vendored Z80
 *    core, and 8080 assembly is a strict subset of Z80 assembly, so the block
 *    assembler will assemble any genuine 8080 routine correctly. Widening the
 *    union would ripple through every dialect for no behavioural gain - but say
 *    so in a comment, because "the Altair is a Z80 machine" is otherwise a
 *    reasonable thing for a future reader to conclude from this line.
 *
 * 2. **`validRanges`.** Blocks must sit above the RAM-resident interpreter and
 *    the BASIC program, and below the top of fitted RAM. Unlike every other
 *    machine here there is no ROM to exclude and no video page to reserve - but
 *    also no hardware floor protecting the interpreter, so the range's lower
 *    bound is the only thing stopping a block from overwriting BASIC itself.
 */
export function altair8800MemoryBlocks(): MemoryBlocksSupport {
  throw new Error('altair8800: not implemented');
}
