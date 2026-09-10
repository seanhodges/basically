// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Exidy Standard BASIC's reserved words and the token byte each is stored as.
 * Not populated yet.
 *
 * Exidy Standard BASIC is a Microsoft 8K BASIC, so the *shape* is the Altair's -
 * single high-bit tokens from 0x80 up, in the interpreter's own reserved-word
 * order - but the bytes are this ROM's and must be read out of the ROM PAC
 * image, then confirmed a second way by typing each keyword at the interpreter
 * and reading the stored program text back. Do not copy the Altair's table.
 */
export const sorcererKeywords: KeywordInfo[] = [];

/**
 * Operator spellings the ROM stores as characters rather than as a token, which
 * the keyword table above therefore cannot carry. On this family `<=` is two
 * operator tokens rather than one.
 */
export const sorcererOperators: readonly string[] = [];
