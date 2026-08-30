// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Applesoft's keywords: one-byte tokens `$80`-`$EA` with the high bit set, in
 * the ROM's own order.
 *
 * A flat table, unlike the sibling's - Applesoft is Microsoft 6502 BASIC, the
 * family the Commodores, the TRS-80, the Altair and the PMD 85 also belong to,
 * so this is a scanner's table rather than a parser's.
 */
export const apple2plusKeywords: KeywordInfo[] = [];

/** Operator spellings, for the editor's highlighting and completion. */
export const apple2plusOperators: readonly string[] = [];
