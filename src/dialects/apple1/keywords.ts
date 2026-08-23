// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Apple 1 Integer BASIC's keywords and operators.
 *
 * Derived from the Apple-1 BASIC Users Manual and cross-checked against the
 * token table in the supplied interpreter image. The near-miss to avoid is Apple
 * II Integer BASIC, which added GR, PLOT, HLIN, VLIN, COLOR and the paddle
 * functions this machine has none of.
 */
export const apple1Keywords: KeywordInfo[] = [];

export const apple1Operators: readonly string[] = [];
