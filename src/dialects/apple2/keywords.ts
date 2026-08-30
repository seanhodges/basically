// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Apple II Integer BASIC's keywords.
 *
 * The interpreter has no reserved-word table: it has a syntax table, and a token
 * is an ordinal counting keyword boundaries down through it, so the same keyword
 * takes different tokens in different grammatical positions. The table is read
 * off this machine's own image by walking it the way `LIST` does - not copied
 * from `../apple1/keywords.ts`, whose interpreter is an earlier revision with a
 * different table.
 */
export const apple2Keywords: KeywordInfo[] = [];

/** Operator spellings, for the editor's highlighting and completion. */
export const apple2Operators: readonly string[] = [];
