// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Dartmouth BASIC's vocabulary as the fourth edition of the manual defines it.
 *
 * Not written yet. Every entry must cite the section of *BASIC, Fourth Edition*
 * (Dartmouth College Computation Center, 1 January 1968) that specifies it: no
 * compiler listing survives for this machine, so the manual is the only source
 * and the comments must not claim otherwise.
 *
 * As on the GE-235, `token` is an ordinal rather than a byte the machine
 * stores - this BASIC was compiled at RUN, so no keyword has a byte of its own.
 */
export const ge635Keywords: KeywordInfo[] = [];

/** The operators, which the keyword table cannot carry. Not written yet. */
export const ge635Operators: readonly string[] = [];
