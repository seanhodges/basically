// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * Editor language support for MSX BASIC: &H and &B literals, the four type
 * suffixes (%, !, #, $) that no other Microsoft BASIC shipped here carries,
 * and the block templates the completion source offers.
 */
export function hb10pLanguageSupport(): Extension {
  throw new Error('hb10p: language support not implemented');
}

export const hb10pCompletionSource: CompletionSource = () => {
  throw new Error('hb10p: completion source not implemented');
};
