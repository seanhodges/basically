// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { ListingLayout } from '../types';
import { tokenizeProgram } from './tokenizer';

/**
 * ZX81 program-area line-record layout for the listing-backed memory blocks
 * (see {@link ListingLayout} and `src/app/listingBlocks.ts`). A record is
 * `[u16 BE lineNo][u16 LE len][body…][0x76]`; a hidden-code line's body is
 * `[REM 0xEA][code…]`, so the code payload starts at `base + recordStart + 5`
 * (a line-1 REM lands at 0x407D + 5 = 0x4082 = 16514, the classic address).
 */
export const zx81ListingLayout: ListingLayout = {
  base: 0x407d,
  headerLen: 4,
  hasLengthField: true,
  remToken: 0xea,
  terminator: 0x76,
  tokenize: tokenizeProgram,
};
