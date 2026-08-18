// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * BASIC-G's keyword table, empty while nobody has established the token values.
 *
 * They have to come from a real program dump or the interpreter image. BASIC-G
 * is a Czechoslovak implementation rather than a Microsoft port, so its tokens
 * cannot be inferred from the Microsoft-family dialects here, however much the
 * 8080 CPU suggests otherwise.
 */
export const pmd85Keywords: KeywordInfo[] = [];

/** Operator spellings BASIC-G stores as characters rather than tokens. */
export const pmd85Operators: readonly string[] = [];
