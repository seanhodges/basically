// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';

/** Program bytes back to MSX BASIC text, walking the line links. */
export function detokenizeProgram(_bytes: Uint8Array): DetokenizeResult {
  throw new Error('hb10p: detokenizer not implemented');
}
