// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { ListingLayout } from '../types';
import { tokenizeProgram } from './tokenizer';

/**
 * ZX80 program-area line-record layout for the listing-backed memory blocks
 * (see {@link ListingLayout} and `src/app/listingBlocks.ts`). A record is
 * `[u16 BE lineNo][body…][0x76]` with NO length field; a hidden-code line's
 * body is `[REM 0xFE][code…]`, so the code payload starts at
 * `base + recordStart + 3` (a line-1 REM lands at 0x4028 + 3 = 0x402B). A ZX80
 * record is NEWLINE-delimited, so its code bytes must never contain 0x76.
 */
export const zx80ListingLayout: ListingLayout = {
  base: 0x4028,
  headerLen: 2,
  hasLengthField: false,
  remToken: 0xfe,
  terminator: 0x76,
  tokenize: tokenizeProgram,
};
