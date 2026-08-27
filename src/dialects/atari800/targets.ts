// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';

/**
 * File exports, shared by both Atari dialects: the tokenized `.BAS` that SAVE
 * writes, the ATASCII `.LST` that LIST writes, and the cassette forms.
 *
 * Empty until the transfer layer lands; the tokenizer already produces the
 * bytes a `.BAS` target will hand over.
 */
export const atariBuildTargets: BuildTarget[] = [];
