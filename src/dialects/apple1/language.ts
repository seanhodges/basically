// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * Editor language support. Integer BASIC has no hex literal, no type-suffix
 * characters and no floating point, so the BasicLanguageOptions this builds are
 * the sparsest in the project.
 */
export function apple1LanguageSupport(): Extension {
  throw new Error('apple1: not implemented');
}

export const apple1CompletionSource: CompletionSource = () => {
  throw new Error('apple1: not implemented');
};

/** True once the entry-time tokenizer is confirmed to crunch spaces. */
export const apple1Crunched = true;
