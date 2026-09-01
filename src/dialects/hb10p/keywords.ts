// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * MSX BASIC 1.0's keyword table.
 *
 * Statements and most functions are single bytes in 0x80-0xFE; the remaining
 * functions are two, a 0xFF prefix followed by a second byte. Derived from the
 * BASIC ROM's own keyword strings rather than from a published list.
 */
export const hb10pKeywords: KeywordInfo[] = [];
